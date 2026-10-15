// Prompt construction for generated knowledge-check questions. Follows the
// same shape as src/lib/ai/prompts.ts's existing prompt builders (a shared
// guardrails block + a pure string-building function per job) rather than
// inventing a new prompt style.

import type { RetrievedExcerpt } from "@/lib/ai/retrieval";
import type { CognitiveLevel, ConceptCandidate, ExistingQuestionSummary } from "@/lib/knowledge-checks/types";

const COGNITIVE_LEVEL_GUIDE = `- "recall": tests a definition or fact stated directly in the excerpts (e.g. "What is X?").
- "understand": tests why a mechanism or relationship works the way it does, not just naming it.
- "apply": presents a short, concrete scenario and asks what the material predicts or implies for it.
- "reason": requires combining two or more ideas from the excerpts to explain a less obvious outcome.`;

const GUARDRAILS = `You are writing knowledge-check quiz questions for The Haarchive, a distance-running
education site. Each question tests whether a reader actually understood a specific section
they just read -- it is not trivia, and it must be answerable using ONLY the reference
excerpts given below.

Ground rules, follow all of them:
- Every fact, number, and claim in the question, every option, and the explanation must come
  directly from the excerpts below. Never invent a fact, number, name, or study that isn't
  there, even if it sounds plausible.
- Write exactly 4 options: one clearly correct answer and three plausible distractors. A
  distractor should reflect a realistic misconception a reader might actually have, not an
  absurd or obviously-wrong option included only to pad the count.
- Exactly one option must be unambiguously correct given the excerpts -- if the excerpts
  don't clearly support one right answer, don't force a question out of that material.
- Never make the correct answer identifiable by its length, phrasing, or position alone.
- Don't test a fact that's mentioned only once, in passing, with no real explanation behind
  it -- prefer testing ideas the excerpts actually develop.
- Don't write two questions (within this batch, or against the existing questions listed
  below) that test essentially the same thing in different words.
- The explanation should teach, in 1-3 sentences: state why the correct answer is right using
  the excerpts' own reasoning, not just restate the answer.
- Tag each question with the single concept (from the exact list given below) it most
  directly tests, and a cognitiveLevel:
${COGNITIVE_LEVEL_GUIDE}`;

function serializeExcerpts(excerpts: RetrievedExcerpt[]): string {
  return excerpts.map((e, i) => `[${i + 1}] ${e.heading ? `${e.heading}: ` : ""}${e.text}`).join("\n");
}

function serializeExisting(existing: (ExistingQuestionSummary | { question: string })[]): string {
  if (existing.length === 0) return "(none yet for this section)";
  return existing.map((q, i) => `${i + 1}. ${q.question}`).join("\n");
}

export function buildQuestionGenerationPrompt(params: {
  sectionTitle: string;
  targetConcepts: ConceptCandidate[];
  allConceptSlugs: string[];
  excerpts: RetrievedExcerpt[];
  existingQuestions: (ExistingQuestionSummary | { question: string })[];
  count: number;
  cognitiveLevelTargets: Partial<Record<CognitiveLevel, number>>;
}): string {
  const levelInstruction = Object.entries(params.cognitiveLevelTargets)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([level, n]) => `${n} at "${level}"`)
    .join(", ");

  return [
    GUARDRAILS,
    "",
    `Section: "${params.sectionTitle}"`,
    "",
    `Write exactly ${params.count} new questions${levelInstruction ? ` (${levelInstruction})` : ""}.`,
    "",
    `Concepts this batch should prioritize covering (each question's "concepts" field must be chosen from the full allowed list below, but favor these first since they aren't tested by any existing question yet):`,
    params.targetConcepts.map((c) => `- ${c.slug}: ${c.title}`).join("\n") || "(no specific gap -- use judgment across the full list)",
    "",
    `Full allowed concept list for this section (the "concepts" field on every question must be one of these exact slugs):`,
    params.allConceptSlugs.join(", "),
    "",
    "Existing questions for this section already (do not duplicate these):",
    serializeExisting(params.existingQuestions),
    "",
    "Reference excerpts from this section's actual content (the ONLY source of truth for this task):",
    serializeExcerpts(params.excerpts),
  ].join("\n");
}
