import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChangeClassification, ConceptCandidate, ConceptCoverage, DepthAssessment, ExistingQuestionSummary } from "@/lib/knowledge-checks/types";

vi.mock("@/lib/ai/model", () => ({ structuredOutputModel: "mock-model", coachModel: "mock-model" }));
vi.mock("ai", () => ({ generateObject: vi.fn() }));

const { planGeneration, generateQuestionsForSection, capExcerptsByLength } = await import("@/lib/knowledge-checks/generate");
const { generateObject } = await import("ai");

afterEach(() => {
  vi.clearAllMocks();
});

const CONCEPTS: ConceptCandidate[] = [
  { slug: "vo2-max", title: "VO2 Max", source: "curated" },
  { slug: "lactate-threshold", title: "Lactate Threshold", source: "curated" },
  { slug: "running-economy", title: "Running Economy", source: "heading" },
];

const ASSESSMENT: DepthAssessment = {
  tier: "moderate",
  score: 10,
  recommendedQuestions: 4,
  cognitiveLevelTargets: { recall: 1, understand: 1, apply: 1, reason: 1 },
};

function coverage(covered: string[]): ConceptCoverage {
  const coveredSlugs = new Set(covered);
  return {
    concepts: CONCEPTS,
    coveredSlugs,
    uncovered: CONCEPTS.filter((c) => !coveredSlugs.has(c.slug)),
    coveragePercent: Math.round((covered.length / CONCEPTS.length) * 100),
  };
}

function existingQuestion(id: string, concepts: string[], locked = true): ExistingQuestionSummary {
  return { id, concepts, conceptId: null, locked, sourceFingerprint: "fp-1", question: `Question about ${concepts.join(",")}`, cognitiveLevel: null, difficulty: "standard" };
}

describe("planGeneration", () => {
  it("plans a full 'new' generation for a section seen for the first time with no existing questions", () => {
    const change: ChangeClassification = { kind: "new", reason: "first run" };
    const plan = planGeneration({ assessment: ASSESSMENT, coverage: coverage([]), change, existingQuestions: [] });
    expect(plan.action).toBe("new");
    expect(plan.questionsNeeded).toBe(4);
  });

  it("skips a section that's unchanged and already at/above target with full coverage", () => {
    const change: ChangeClassification = { kind: "unchanged" };
    const existing = [existingQuestion("q1", ["vo2-max"]), existingQuestion("q2", ["lactate-threshold"]), existingQuestion("q3", ["running-economy"]), existingQuestion("q4", ["vo2-max"])];
    const plan = planGeneration({ assessment: ASSESSMENT, coverage: coverage(["vo2-max", "lactate-threshold", "running-economy"]), change, existingQuestions: existing });
    expect(plan.action).toBe("skip");
  });

  it("does not regenerate anything for a typo-only (cosmetic) change when already at target", () => {
    const change: ChangeClassification = { kind: "cosmetic", changedWordRatio: 0.01 };
    const existing = [existingQuestion("q1", ["vo2-max"]), existingQuestion("q2", ["lactate-threshold"]), existingQuestion("q3", ["running-economy"]), existingQuestion("q4", ["vo2-max"])];
    const plan = planGeneration({ assessment: ASSESSMENT, coverage: coverage(["vo2-max", "lactate-threshold", "running-economy"]), change, existingQuestions: existing });
    expect(plan.action).toBe("cosmetic_refresh");
    expect(plan.questionsNeeded).toBe(0);
  });

  it("flags a knowledge check when content changed materially -- but never flags a locked question", () => {
    const change: ChangeClassification = { kind: "material", changedWordRatio: 0.5 };
    const lockedQuestion = existingQuestion("q1", ["vo2-max"], true);
    const unlockedQuestion = existingQuestion("q2", ["lactate-threshold"], false);
    const plan = planGeneration({ assessment: ASSESSMENT, coverage: coverage(["vo2-max", "lactate-threshold"]), change, existingQuestions: [lockedQuestion, unlockedQuestion] });
    expect(plan.flaggedQuestionIds).not.toContain("q1");
    expect(plan.flaggedQuestionIds).toContain("q2");
  });

  it("targets uncovered concepts even when the question count is already at the recommended total", () => {
    const change: ChangeClassification = { kind: "unchanged" };
    // 4 questions (== recommended), but all clustered on one concept.
    const existing = [existingQuestion("q1", ["vo2-max"]), existingQuestion("q2", ["vo2-max"]), existingQuestion("q3", ["vo2-max"]), existingQuestion("q4", ["vo2-max"])];
    const plan = planGeneration({ assessment: ASSESSMENT, coverage: coverage(["vo2-max"]), change, existingQuestions: existing });
    expect(plan.action).toBe("top_up");
    expect(plan.questionsNeeded).toBeGreaterThan(0);
    expect(plan.targetConcepts.map((c) => c.slug)).toEqual(expect.arrayContaining(["lactate-threshold", "running-economy"]));
  });

  it("recomputes a bigger recommended count and asks for more questions after a material content expansion", () => {
    const change: ChangeClassification = { kind: "material", changedWordRatio: 0.6 };
    const biggerAssessment: DepthAssessment = { ...ASSESSMENT, tier: "long", recommendedQuestions: 7 };
    const existing = [existingQuestion("q1", ["vo2-max"]), existingQuestion("q2", ["lactate-threshold"]), existingQuestion("q3", ["running-economy"]), existingQuestion("q4", ["vo2-max"])];
    const plan = planGeneration({ assessment: biggerAssessment, coverage: coverage(["vo2-max", "lactate-threshold", "running-economy"]), change, existingQuestions: existing });
    expect(plan.questionsNeeded).toBe(3); // 7 recommended - 4 existing
  });
});

describe("generateQuestionsForSection", () => {
  const section = {
    slug: "exercise-physiology",
    title: "Exercise Physiology",
    content: [
      { type: "heading" as const, text: "VO2 Max" },
      { type: "paragraph" as const, text: "VO2 max is the maximum rate of oxygen consumption during incremental exercise." },
    ],
  };
  const fullSections = [{ slug: "exercise-physiology", title: "Exercise Physiology", mission: "m", topics: [], category: "physiology", content: section.content }];

  const basePlan = {
    action: "new" as const,
    reason: "test",
    questionsNeeded: 1,
    targetConcepts: CONCEPTS,
    cognitiveLevelTargets: { recall: 1 },
    flaggedQuestionIds: [],
  };

  it("returns nothing and never calls the model when questionsNeeded is 0", async () => {
    const outcome = await generateQuestionsForSection({
      section,
      plan: { ...basePlan, questionsNeeded: 0 },
      concepts: CONCEPTS,
      existingQuestions: [],
      sections: fullSections as never,
    });
    expect(outcome.accepted).toEqual([]);
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("accepts a valid generated candidate", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        questions: [
          {
            question: "What does VO2 max measure?",
            options: [
              { id: "a", text: "The maximum rate of oxygen consumption during incremental exercise." },
              { id: "b", text: "The total distance run in a week." },
              { id: "c", text: "The runner's resting heart rate." },
              { id: "d", text: "The amount of body fat burned per hour." },
            ],
            correctOptionId: "a",
            explanation: "VO2 max is defined as the maximum rate of oxygen consumption measured during incremental exercise.",
            difficulty: "foundational",
            cognitiveLevel: "recall",
            concepts: ["vo2-max"],
          },
        ],
      },
    } as never);

    const outcome = await generateQuestionsForSection({
      section,
      plan: basePlan,
      concepts: CONCEPTS,
      existingQuestions: [],
      sections: fullSections as never,
    });
    expect(outcome.accepted).toHaveLength(1);
    expect(outcome.rejected).toHaveLength(0);
  });

  it("rejects a generated candidate that fails validation instead of accepting it blindly", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        questions: [
          {
            question: "What does VO2 max measure?",
            options: [
              { id: "a", text: "The maximum rate of oxygen consumption during incremental exercise." },
              { id: "b", text: "The maximum rate of oxygen consumption during incremental exercise." }, // duplicate text
              { id: "c", text: "The runner's resting heart rate." },
              { id: "d", text: "The amount of body fat burned per hour." },
            ],
            correctOptionId: "a",
            explanation: "VO2 max is defined as the maximum rate of oxygen consumption measured during incremental exercise.",
            difficulty: "foundational",
            cognitiveLevel: "recall",
            concepts: ["vo2-max"],
          },
        ],
      },
    } as never);

    const outcome = await generateQuestionsForSection({
      section,
      plan: basePlan,
      concepts: CONCEPTS,
      existingQuestions: [],
      sections: fullSections as never,
    });
    expect(outcome.accepted).toHaveLength(0);
    expect(outcome.rejected).toHaveLength(1);
  });

  it("degrades gracefully (empty result, no throw) when the model call fails", async () => {
    vi.mocked(generateObject).mockRejectedValueOnce(new Error("rate limited"));
    const outcome = await generateQuestionsForSection({
      section,
      plan: basePlan,
      concepts: CONCEPTS,
      existingQuestions: [],
      sections: fullSections as never,
    });
    expect(outcome).toEqual({ accepted: [], rejected: [] });
  });
});

describe("capExcerptsByLength", () => {
  function excerpt(text: string) {
    return { sectionSlug: "s", sectionTitle: "S", heading: null, text, score: 1 };
  }

  it("keeps everything when the total is already under budget", () => {
    const excerpts = [excerpt("short one"), excerpt("short two")];
    expect(capExcerptsByLength(excerpts)).toHaveLength(2);
  });

  it("truncates a long, dense section's excerpt list instead of forwarding all of it", () => {
    // Regression test: a real run against every section in production found
    // that a very_long-tier section's full 30-excerpt retrieval result
    // reliably exceeded Groq's 8,000-token-per-request ceiling, failing
    // every retry identically (a same-size retry can't fix an oversized
    // request). This proves the cap actually bites for realistically large
    // input instead of just existing in a comment.
    const manyLongExcerpts = Array.from({ length: 30 }, (_, i) => excerpt(`Excerpt number ${i}: `.repeat(50)));
    const capped = capExcerptsByLength(manyLongExcerpts);
    expect(capped.length).toBeLessThan(30);
    const totalChars = capped.reduce((sum, e) => sum + e.text.length, 0);
    expect(totalChars).toBeLessThan(manyLongExcerpts[0].text.length * 30);
  });

  it("always keeps at least one excerpt even if it alone exceeds the budget", () => {
    const oneHugeExcerpt = [excerpt("word ".repeat(2000))];
    expect(capExcerptsByLength(oneHugeExcerpt)).toHaveLength(1);
  });
});
