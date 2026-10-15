// Deterministic question-quality validation -- Part 5 of the feature spec.
// Every rule here is a plain string/structural check, no LLM involved
// (Part 13's "duplicate detection" and "basic coverage calculations" are
// explicitly named as deterministic). A separate, optional LLM-based
// semantic check can sit in front of/behind this (generate.ts does a
// grounding check using the same retrieval infra other AI features use),
// but nothing in *this* file depends on a model call.

import { tokenizeMeaningful } from "@/lib/knowledge-checks/extract";
import type { GeneratedQuestionCandidate, ValidationIssue, ValidationResult } from "@/lib/knowledge-checks/types";

const MIN_QUESTION_LENGTH = 15;
const MAX_QUESTION_LENGTH = 400;
const MIN_EXPLANATION_LENGTH = 30;
const MIN_OPTIONS = 3;
const MAX_OPTIONS = 5;
// Jaccard over *meaningful* (stopword-filtered) tokens -- calibrated lower
// than a naive full-token Jaccard would need, since stripping filler words
// already removes most of the noise that would otherwise require a higher
// bar. Two questions sharing this much of their real content vocabulary
// are almost always testing the same underlying fact, just reworded.
const NEAR_DUPLICATE_THRESHOLD = 0.6;
const LENGTH_CLUE_RATIO = 2.0;

function jaccard(a: string, b: string): number {
  const setA = new Set(tokenizeMeaningful(a));
  const setB = new Set(tokenizeMeaningful(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function issue(code: string, message: string, severity: ValidationIssue["severity"] = "reject"): ValidationIssue {
  return { code, message, severity };
}

// Structural + content-quality checks for a single candidate, independent
// of anything else it might be a duplicate of. `knownConceptSlugs` fails a
// candidate closed if it names a concept this section doesn't actually
// have -- the same "constrain to a real enum, don't trust a free-form
// model field" pattern src/lib/search/run-search.ts already uses.
export function validateCandidateShape(
  candidate: GeneratedQuestionCandidate,
  knownConceptSlugs: Set<string>,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (candidate.question.trim().length < MIN_QUESTION_LENGTH) {
    issues.push(issue("question_too_short", "Question text is too short to be a real question."));
  }
  if (candidate.question.length > MAX_QUESTION_LENGTH) {
    issues.push(issue("question_too_long", "Question text is unusually long -- likely padded or malformed."));
  }
  if (candidate.explanation.trim().length < MIN_EXPLANATION_LENGTH) {
    issues.push(issue("explanation_too_short", "Explanation doesn't substantively explain the answer."));
  }

  if (candidate.options.length < MIN_OPTIONS || candidate.options.length > MAX_OPTIONS) {
    issues.push(issue("bad_option_count", `Expected ${MIN_OPTIONS}-${MAX_OPTIONS} options, got ${candidate.options.length}.`));
  }
  if (candidate.options.length !== 4) {
    issues.push(issue("not_four_options", "Prefer exactly 4 options.", "warn"));
  }

  const optionIds = new Set(candidate.options.map((o) => o.id));
  if (optionIds.size !== candidate.options.length) {
    issues.push(issue("duplicate_option_ids", "Two or more options share the same id."));
  }
  if (!optionIds.has(candidate.correctOptionId)) {
    issues.push(issue("correct_id_not_found", "correctOptionId doesn't match any option's id."));
  }

  const optionTexts = candidate.options.map((o) => o.text.trim().toLowerCase());
  if (new Set(optionTexts).size !== optionTexts.length) {
    issues.push(issue("duplicate_option_text", "Two or more options have identical text."));
  }
  for (const text of optionTexts) {
    if (text.length === 0) issues.push(issue("empty_option_text", "An option has empty text."));
  }

  // Soft length-clue check: the correct option shouldn't be dramatically
  // longer/shorter than the average distractor, a classic "the long one is
  // always right" tell. Warn, don't reject -- sometimes the correct answer
  // is legitimately more precise and therefore longer.
  const correct = candidate.options.find((o) => o.id === candidate.correctOptionId);
  const distractors = candidate.options.filter((o) => o.id !== candidate.correctOptionId);
  if (correct && distractors.length > 0) {
    const avgDistractorLength = distractors.reduce((sum, o) => sum + o.text.length, 0) / distractors.length;
    if (avgDistractorLength > 0) {
      const ratio = correct.text.length / avgDistractorLength;
      if (ratio > LENGTH_CLUE_RATIO || ratio < 1 / LENGTH_CLUE_RATIO) {
        issues.push(issue("length_clue", "Correct option's length differs sharply from the distractors' average -- a possible giveaway.", "warn"));
      }
    }
  }

  if (candidate.concepts.length === 0) {
    issues.push(issue("no_concepts", "Question isn't tagged with any concept -- can't be counted toward coverage."));
  }
  for (const slug of candidate.concepts) {
    if (!knownConceptSlugs.has(slug)) {
      issues.push(issue("unknown_concept", `"${slug}" isn't a real concept for this section.`));
    }
  }

  const rejects = issues.filter((i) => i.severity === "reject");
  return { valid: rejects.length === 0, issues };
}

// A candidate is a near-duplicate of an existing (locked or not) question
// if their question text is highly similar -- Part 5's "avoid asking
// essentially the same question twice." Token-set Jaccard, not exact
// string match, so a reworded-but-identical question still gets caught.
// Only `question` is ever read, so the parameter type only asks for that --
// callers can pass a full GeneratedQuestionCandidate/ExistingQuestionSummary
// or a bare `{ question }`.
export function findNearDuplicate<T extends { question: string }>(candidate: GeneratedQuestionCandidate, against: T[]): T | null {
  for (const other of against) {
    if (jaccard(candidate.question, other.question) >= NEAR_DUPLICATE_THRESHOLD) return other;
  }
  return null;
}

// Grounding check: the question + explanation together should share
// meaningful vocabulary with the actual section text it's supposed to be
// testing -- a cheap guard against a hallucinated fact that happens to be
// structurally valid. Deliberately permissive (a real question legitimately
// uses its own phrasing, not the source text's exact words) -- this catches
// "shares almost no vocabulary with the source at all," not "isn't a close
// paraphrase."
const MIN_GROUNDING_OVERLAP = 2;

export function checkGrounding(candidate: GeneratedQuestionCandidate, sourceText: string): ValidationResult {
  const sourceTokens = new Set(tokenizeMeaningful(sourceText));
  const candidateTokens = new Set(tokenizeMeaningful(`${candidate.question} ${candidate.explanation}`));
  let shared = 0;
  for (const t of candidateTokens) if (sourceTokens.has(t)) shared += 1;

  if (shared < MIN_GROUNDING_OVERLAP) {
    return {
      valid: false,
      issues: [issue("ungrounded", "Question/explanation share almost no vocabulary with the section text it should be testing.")],
    };
  }
  return { valid: true, issues: [] };
}

export function validateCandidate(
  candidate: GeneratedQuestionCandidate,
  context: { knownConceptSlugs: Set<string>; sourceText: string; existingQuestions: { question: string }[] },
): ValidationResult {
  const shape = validateCandidateShape(candidate, context.knownConceptSlugs);
  const grounding = checkGrounding(candidate, context.sourceText);
  const issues = [...shape.issues, ...grounding.issues];

  const duplicate = findNearDuplicate(candidate, context.existingQuestions);
  if (duplicate) {
    issues.push(issue("near_duplicate", `Too similar to an existing question: "${duplicate.question.slice(0, 80)}..."`));
  }

  const rejects = issues.filter((i) => i.severity === "reject");
  return { valid: rejects.length === 0, issues };
}
