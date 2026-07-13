import { describe, expect, it } from "vitest";

import { computeKnowledgeGaps, type KnowledgeGapInput } from "@/lib/questions/knowledge-gaps";

function question(overrides: Partial<KnowledgeGapInput>): KnowledgeGapInput {
  return { category: null, tags: [], status: "new", ...overrides };
}

describe("computeKnowledgeGaps", () => {
  it("counts questions per category", () => {
    const gaps = computeKnowledgeGaps([
      question({ category: "the-science" }),
      question({ category: "the-science" }),
      question({ category: "mind-and-recovery" }),
    ]);

    const science = gaps.find((g) => g.label === "the-science");
    const recovery = gaps.find((g) => g.label === "mind-and-recovery");
    expect(science?.count).toBe(2);
    expect(recovery?.count).toBe(1);
  });

  it("counts questions per tag independently of category", () => {
    const gaps = computeKnowledgeGaps([
      question({ tags: ["threshold", "vo2max"] }),
      question({ tags: ["threshold"] }),
    ]);

    expect(gaps.find((g) => g.label === "threshold")?.count).toBe(2);
    expect(gaps.find((g) => g.label === "vo2max")?.count).toBe(1);
  });

  it("flags a bucket once it reaches the threshold", () => {
    const gaps = computeKnowledgeGaps(
      Array.from({ length: 3 }, () => question({ category: "the-science" })),
      3,
    );
    expect(gaps.find((g) => g.label === "the-science")?.flagged).toBe(true);
  });

  it("does not flag a bucket below the threshold", () => {
    const gaps = computeKnowledgeGaps([question({ category: "the-science" })], 3);
    expect(gaps.find((g) => g.label === "the-science")?.flagged).toBe(false);
  });

  it("excludes questions already added to the library from gap counts", () => {
    const gaps = computeKnowledgeGaps([
      question({ category: "the-science", status: "added_to_library" }),
    ]);
    expect(gaps.find((g) => g.label === "the-science")).toBeUndefined();
  });

  it("sorts results by count descending", () => {
    const gaps = computeKnowledgeGaps([
      question({ category: "a" }),
      question({ category: "b" }),
      question({ category: "b" }),
    ]);
    expect(gaps[0].label).toBe("b");
    expect(gaps[0].count).toBe(2);
  });

  it("handles an empty question list", () => {
    expect(computeKnowledgeGaps([])).toEqual([]);
  });
});
