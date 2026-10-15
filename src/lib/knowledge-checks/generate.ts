// Generation orchestration -- Parts 7 and 11 of the feature spec. Two
// halves, deliberately separated:
//   - `planGeneration` is pure and synchronous: given already-computed
//     depth/coverage/change-detection results, it decides *whether* to
//     generate anything and *how much* -- no I/O, fully unit-testable
//     without touching the network or a database.
//   - `generateQuestionsForSection` is the one function in this whole
//     directory that calls the model, and it's a thin wrapper: build a
//     retrieval query, build a prompt, call generateObject, validate every
//     candidate, return only what passed.

import { generateObject } from "ai";
import { z } from "zod";

import { structuredOutputModel } from "@/lib/ai/model";
import { retrieveRelevantContent } from "@/lib/ai/retrieval";
import type { Section } from "@/lib/sections";

import { buildQuestionGenerationPrompt } from "@/lib/knowledge-checks/prompts";
import { validateCandidate } from "@/lib/knowledge-checks/validate";
import type {
  ChangeClassification,
  ConceptCandidate,
  ConceptCoverage,
  DepthAssessment,
  ExistingQuestionSummary,
  GeneratedQuestionCandidate,
  GenerationPlan,
  ValidationIssue,
} from "@/lib/knowledge-checks/types";

const MAX_TOP_UP_FOR_UNCOVERED_CONCEPTS = 3;

// Pure decision: what should happen to this section's knowledge check,
// given everything already computed about it. See this file's own header
// and the migration's header comment for why "unchanged" and "cosmetic"
// still check for a pre-existing gap instead of always skipping outright.
export function planGeneration(params: {
  assessment: DepthAssessment;
  coverage: ConceptCoverage;
  change: ChangeClassification;
  existingQuestions: ExistingQuestionSummary[];
}): GenerationPlan {
  const { assessment, coverage, change, existingQuestions } = params;
  const activeCount = existingQuestions.length;
  const numericGap = Math.max(0, assessment.recommendedQuestions - activeCount);
  const coverageGap = Math.min(coverage.uncovered.length, MAX_TOP_UP_FOR_UNCOVERED_CONCEPTS);
  const questionsNeeded = Math.max(numericGap, numericGap > 0 ? numericGap : coverageGap);

  const flaggedQuestionIds =
    change.kind === "material"
      ? existingQuestions
          .filter((q) => !q.locked)
          .filter((q) => {
            const conceptStillExists = q.concepts.length === 0 || q.concepts.some((slug) => coverage.concepts.some((c) => c.slug === slug));
            const majorRewrite = change.changedWordRatio > 0.3;
            return majorRewrite || !conceptStillExists;
          })
          .map((q) => q.id)
      : [];

  if (change.kind === "new") {
    return {
      action: questionsNeeded > 0 ? "new" : "skip",
      reason: questionsNeeded > 0 ? "No stored fingerprint yet -- first automated pass over this section." : "No stored fingerprint, but already at or above the recommended question count and full concept coverage.",
      questionsNeeded,
      targetConcepts: coverage.uncovered,
      cognitiveLevelTargets: assessment.cognitiveLevelTargets,
      flaggedQuestionIds: [],
    };
  }

  if (change.kind === "unchanged") {
    return {
      action: questionsNeeded > 0 ? "top_up" : "skip",
      reason: questionsNeeded > 0 ? "Content unchanged, but question count/coverage is below the current target (e.g. the depth model itself was updated)." : "Content unchanged and already meets the target count and coverage.",
      questionsNeeded,
      targetConcepts: coverage.uncovered,
      cognitiveLevelTargets: assessment.cognitiveLevelTargets,
      flaggedQuestionIds: [],
    };
  }

  if (change.kind === "cosmetic") {
    return {
      action: questionsNeeded > 0 ? "top_up" : "cosmetic_refresh",
      reason: `Change is cosmetic (${(change.changedWordRatio * 100).toFixed(1)}% of words touched) -- fingerprint refreshed, no regeneration triggered by the edit itself.`,
      questionsNeeded,
      targetConcepts: coverage.uncovered,
      cognitiveLevelTargets: assessment.cognitiveLevelTargets,
      flaggedQuestionIds: [],
    };
  }

  // material
  return {
    action: questionsNeeded > 0 ? "new" : flaggedQuestionIds.length > 0 ? "top_up" : "skip",
    reason: `Content changed materially (${(change.changedWordRatio * 100).toFixed(1)}% of words touched).`,
    questionsNeeded,
    targetConcepts: coverage.uncovered,
    cognitiveLevelTargets: assessment.cognitiveLevelTargets,
    flaggedQuestionIds,
  };
}

function candidateSchema(conceptSlugs: [string, ...string[]]) {
  const optionIds = ["a", "b", "c", "d"] as const;
  return z.object({
    questions: z
      .array(
        z.object({
          question: z.string(),
          options: z.array(z.object({ id: z.enum(optionIds), text: z.string() })).length(4),
          correctOptionId: z.enum(optionIds),
          explanation: z.string(),
          difficulty: z.enum(["foundational", "intermediate", "advanced"]),
          cognitiveLevel: z.enum(["recall", "understand", "apply", "reason"]),
          concepts: z.array(z.enum(conceptSlugs)).min(1).max(2),
        }),
      )
      .min(1),
  });
}

export type GenerationOutcome = {
  accepted: GeneratedQuestionCandidate[];
  rejected: { candidate: GeneratedQuestionCandidate; issues: ValidationIssue[] }[];
};

// The one function in this directory that makes a network call. Returns an
// empty outcome (never throws) if the plan calls for nothing, the section
// has no concepts to constrain the schema against, or the model call fails
// -- matching this codebase's existing convention (run-search.ts,
// admin/questions/actions.ts) of treating a generation failure as
// non-fatal to the surrounding feature rather than crashing a batch run
// over one section.
// Requesting a large batch of fully-structured questions (options, ids,
// explanation, difficulty, cognitiveLevel, concepts -- per question) in one
// generateObject call turns out to fail more often the bigger the ask gets:
// gpt-oss-20b (the model Groq's structured-output allowlist limits this
// project to, see src/lib/ai/model.ts) occasionally returns JSON its own
// schema validator rejects once a response gets large enough, and Groq's
// own error message for that ("Failed to validate JSON... See
// 'failed_generation'") doesn't even say what was wrong. Requesting a few
// questions per call instead of all of them at once, with its own bounded
// retry, is both more resilient (one bad batch doesn't sink every question
// this section needed) and keeps each individual request small.
const BATCH_SIZE = 3;
const MAX_ATTEMPTS_PER_BATCH = 2;

// Groq's free tier caps openai/gpt-oss-20b at 8,000 tokens per *request*,
// not just per day -- discovered by running this against every real
// section: any of the site's very_long-tier pages (8,000+ words, 20-30+
// concepts) reliably produced a request over that ceiling with the
// original 30-excerpt/no-length-cap version of this function, failing
// every single retry identically since a same-size retry can't fix an
// oversized request. Both caps below exist to keep every request's prompt
// small regardless of how large the section actually is -- retrieval
// already returns excerpts sorted by relevance score, so capping count and
// then total length still keeps the most relevant material.
const EXCERPT_LIMIT = 10;
const MAX_EXCERPT_CHARS = 3500;
const MAX_EXISTING_QUESTIONS_IN_PROMPT = 10;

export function capExcerptsByLength(excerpts: ReturnType<typeof retrieveRelevantContent>): ReturnType<typeof retrieveRelevantContent> {
  const capped: typeof excerpts = [];
  let total = 0;
  for (const excerpt of excerpts) {
    if (total + excerpt.text.length > MAX_EXCERPT_CHARS && capped.length > 0) break;
    capped.push(excerpt);
    total += excerpt.text.length;
  }
  return capped;
}

async function requestBatch(params: {
  sectionTitle: string;
  targetConcepts: ConceptCandidate[];
  conceptSlugs: [string, ...string[]];
  excerpts: ReturnType<typeof retrieveRelevantContent>;
  existingQuestions: { question: string }[];
  count: number;
  cognitiveLevelTargets: GenerationPlan["cognitiveLevelTargets"];
}): Promise<GeneratedQuestionCandidate[]> {
  const prompt = buildQuestionGenerationPrompt({
    sectionTitle: params.sectionTitle,
    targetConcepts: params.targetConcepts,
    allConceptSlugs: params.conceptSlugs,
    excerpts: params.excerpts,
    existingQuestions: params.existingQuestions,
    count: params.count,
    cognitiveLevelTargets: params.cognitiveLevelTargets,
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_BATCH; attempt++) {
    try {
      const { object } = await generateObject({
        model: structuredOutputModel,
        schema: candidateSchema(params.conceptSlugs),
        prompt,
      });
      return object.questions;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS_PER_BATCH) {
        // Genuinely non-fatal to the rest of the run (see this function's
        // own header comment), but silent failure here means a section
        // reporting "0 generated" gives its operator no way to tell "the
        // model declined to produce anything usable" apart from "a real
        // bug" -- worth a visible warning even though nothing throws.
        console.warn(`generateQuestionsForSection: batch request failed after ${MAX_ATTEMPTS_PER_BATCH} attempts for "${params.sectionTitle}": ${error instanceof Error ? error.message : error}`);
        return [];
      }
    }
  }
  return [];
}

export async function generateQuestionsForSection(params: {
  section: Pick<Section, "slug" | "title" | "content">;
  plan: GenerationPlan;
  concepts: ConceptCandidate[];
  existingQuestions: ExistingQuestionSummary[];
  sections: Section[];
}): Promise<GenerationOutcome> {
  const { section, plan, concepts, existingQuestions, sections } = params;
  if (plan.questionsNeeded <= 0 || concepts.length === 0) {
    return { accepted: [], rejected: [] };
  }

  const conceptSlugs = concepts.map((c) => c.slug) as [string, ...string[]];
  const query = [section.title, ...(plan.targetConcepts.length > 0 ? plan.targetConcepts : concepts).map((c) => c.title)].join(" ");

  // Scoped to just this one section, not retrieveRelevantContent's usual
  // whole-site search -- that function's maxResults caps the *global*
  // top-N across every section before any filtering happens, so filtering
  // down to this section afterward could come up empty if its own content
  // didn't happen to out-score every other section's for this query. This
  // rebuilds the same section object retrieveRelevantContent expects
  // (title/topics/mission/content) from the caller's full sections list,
  // so its own scoring logic still runs unchanged, just against a corpus
  // of one.
  const fullSection = sections.find((s) => s.slug === section.slug);
  const allExcerpts = fullSection ? retrieveRelevantContent(query, [fullSection], EXCERPT_LIMIT) : [];
  const excerpts = capExcerptsByLength(allExcerpts);
  if (excerpts.length === 0) {
    return { accepted: [], rejected: [] };
  }
  const sourceText = excerpts.map((e) => e.text).join(" ");

  const accepted: GeneratedQuestionCandidate[] = [];
  const rejected: { candidate: GeneratedQuestionCandidate; issues: ValidationIssue[] }[] = [];
  const knownConceptSlugs = new Set(conceptSlugs);
  // Capped, not the full history -- a dense section with many existing
  // questions (locked + generated) could otherwise add its own few
  // thousand characters to every single batch prompt on top of the
  // excerpts, for a real, very long section (see this file's own note on
  // Groq's 8,000-token-per-minute request ceiling on the model this
  // project is restricted to for structured output).
  const pool: { question: string }[] = existingQuestions.slice(0, MAX_EXISTING_QUESTIONS_IN_PROMPT).map((q) => ({ question: q.question }));

  // One extra batch of headroom beyond the exact number of batches needed,
  // in case some candidates get rejected by validate.ts and need replacing.
  const maxBatches = Math.ceil(plan.questionsNeeded / BATCH_SIZE) + 1;

  for (let batch = 0; batch < maxBatches && accepted.length < plan.questionsNeeded; batch++) {
    const remaining = plan.questionsNeeded - accepted.length;
    const raw = await requestBatch({
      sectionTitle: section.title,
      targetConcepts: plan.targetConcepts.length > 0 ? plan.targetConcepts : concepts,
      conceptSlugs,
      excerpts,
      existingQuestions: pool,
      count: Math.min(remaining, BATCH_SIZE),
      cognitiveLevelTargets: plan.cognitiveLevelTargets,
    });

    for (const candidate of raw) {
      if (accepted.length >= plan.questionsNeeded) break;
      const result = validateCandidate(candidate, { knownConceptSlugs, sourceText, existingQuestions: pool });
      if (result.valid) {
        accepted.push(candidate);
        pool.push({ question: candidate.question }); // so a later batch can't duplicate this one either
      } else {
        rejected.push({ candidate, issues: result.issues });
      }
    }
  }

  return { accepted, rejected };
}
