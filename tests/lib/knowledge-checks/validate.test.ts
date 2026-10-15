import { describe, expect, it } from "vitest";

import { checkGrounding, findNearDuplicate, validateCandidate, validateCandidateShape } from "@/lib/knowledge-checks/validate";
import type { GeneratedQuestionCandidate } from "@/lib/knowledge-checks/types";

function makeCandidate(overrides: Partial<GeneratedQuestionCandidate> = {}): GeneratedQuestionCandidate {
  return {
    question: "Why does raising your Steady State ceiling let a previously hard pace feel sustainable?",
    options: [
      { id: "a", text: "It raises the aerobic ceiling, so the same pace requires less anaerobic debt." },
      { id: "b", text: "It has no real effect on pace." },
      { id: "c", text: "It only matters for sprinters, not distance runners." },
      { id: "d", text: "It works by increasing muscle mass alone." },
    ],
    correctOptionId: "a",
    explanation: "A higher aerobic ceiling means less of a given pace's demand has to be covered anaerobically, which is what makes it feel sustainable.",
    difficulty: "intermediate",
    cognitiveLevel: "understand",
    concepts: ["steady-state"],
    ...overrides,
  };
}

const KNOWN_CONCEPTS = new Set(["steady-state", "oxygen-debt"]);

describe("validateCandidateShape", () => {
  it("accepts a well-formed candidate", () => {
    const result = validateCandidateShape(makeCandidate(), KNOWN_CONCEPTS);
    expect(result.valid).toBe(true);
  });

  it("rejects a question that's too short to be real", () => {
    const result = validateCandidateShape(makeCandidate({ question: "VO2 max?" }), KNOWN_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "question_too_short")).toBe(true);
  });

  it("rejects when correctOptionId doesn't match any option", () => {
    const result = validateCandidateShape(makeCandidate({ correctOptionId: "z" }), KNOWN_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "correct_id_not_found")).toBe(true);
  });

  it("rejects duplicate option text", () => {
    const candidate = makeCandidate({
      options: [
        { id: "a", text: "Same answer text" },
        { id: "b", text: "Same answer text" },
        { id: "c", text: "Something else" },
        { id: "d", text: "Another option" },
      ],
    });
    const result = validateCandidateShape(candidate, KNOWN_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "duplicate_option_text")).toBe(true);
  });

  it("rejects a question tagged with a concept the section doesn't actually have", () => {
    const result = validateCandidateShape(makeCandidate({ concepts: ["not-a-real-concept"] }), KNOWN_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "unknown_concept")).toBe(true);
  });

  it("rejects a question with no concept tag at all", () => {
    const result = validateCandidateShape(makeCandidate({ concepts: [] }), KNOWN_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "no_concepts")).toBe(true);
  });

  it("warns (but doesn't reject) when the correct answer is dramatically longer than the distractors", () => {
    const candidate = makeCandidate({
      options: [
        {
          id: "a",
          text: "This is the correct answer and it is written with a very long, detailed, thorough explanation packed into the option itself, unlike the others.",
        },
        { id: "b", text: "Short." },
        { id: "c", text: "Also short." },
        { id: "d", text: "Brief." },
      ],
    });
    const result = validateCandidateShape(candidate, KNOWN_CONCEPTS);
    expect(result.issues.some((i) => i.code === "length_clue" && i.severity === "warn")).toBe(true);
    // A warn-only issue shouldn't fail an otherwise well-formed candidate.
    expect(result.valid).toBe(true);
  });
});

describe("checkGrounding", () => {
  const sourceText =
    "Every runner has a ceiling on how much oxygen they can take in, transport, and use per minute; Lydiard called this the Steady State.";

  it("accepts a question that shares real vocabulary with the source text", () => {
    const result = checkGrounding(makeCandidate(), sourceText);
    expect(result.valid).toBe(true);
  });

  it("rejects a question with almost no vocabulary overlap with its supposed source", () => {
    const candidate = makeCandidate({
      question: "What did the chef recommend adding to the recipe for extra flavor?",
      explanation: "The chef suggested a pinch of salt and fresh basil leaves.",
    });
    const result = checkGrounding(candidate, sourceText);
    expect(result.valid).toBe(false);
    expect(result.issues[0].code).toBe("ungrounded");
  });
});

describe("findNearDuplicate", () => {
  it("flags a question that's essentially a reworded version of an existing one", () => {
    const existing = [{ question: "Why does raising your Steady State ceiling make a hard pace feel more sustainable?" }];
    const candidate = makeCandidate({ question: "Why does a higher Steady State ceiling make a hard pace feel sustainable?" });
    expect(findNearDuplicate(candidate, existing)).not.toBeNull();
  });

  it("does not flag two genuinely different questions", () => {
    const existing = [{ question: "What is the crossover point and why does insulin affect it?" }];
    const candidate = makeCandidate();
    expect(findNearDuplicate(candidate, existing)).toBeNull();
  });
});

describe("validateCandidate (integration)", () => {
  const sourceText =
    "Every runner has a ceiling on how much oxygen they can take in, transport, and use per minute; Lydiard called this the Steady State. Raising your Steady State ceiling through aerobic work is what lets a previously hard pace become comfortably sustainable.";

  it("accepts a good, grounded, non-duplicate candidate", () => {
    const result = validateCandidate(makeCandidate(), { knownConceptSlugs: KNOWN_CONCEPTS, sourceText, existingQuestions: [] });
    expect(result.valid).toBe(true);
  });

  it("rejects when the candidate duplicates an existing question, even if otherwise well-formed", () => {
    const existing = [{ question: "Why does raising your Steady State ceiling make a hard pace feel more sustainable?" }];
    const result = validateCandidate(makeCandidate(), { knownConceptSlugs: KNOWN_CONCEPTS, sourceText, existingQuestions: existing });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "near_duplicate")).toBe(true);
  });
});
