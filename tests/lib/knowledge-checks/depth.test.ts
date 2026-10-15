import { describe, expect, it } from "vitest";

import { assessSectionDepth, classifyDepthTier, computeSectionMetrics } from "@/lib/knowledge-checks/depth";
import type { SectionForAnalysis } from "@/lib/knowledge-checks/types";
import type { ContentBlock } from "@/lib/sections";

function paragraph(text: string): ContentBlock {
  return { type: "paragraph", text };
}
function heading(text: string, level?: 2 | 3): ContentBlock {
  return { type: "heading", text, level };
}

function makeSection(slug: string, content: ContentBlock[]): SectionForAnalysis {
  return { slug, title: slug, mission: "test mission", topics: [], content };
}

function words(n: number): string {
  return Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
}

describe("computeSectionMetrics", () => {
  it("counts words across every text-bearing block type, including callouts", () => {
    const section = makeSection("test", [
      heading("Heading One"),
      paragraph(words(10)),
      { type: "list", items: [words(3), { text: words(2), items: [words(1)] }] },
      { type: "quote", text: words(4), attribution: "Someone" },
      { type: "callout", variant: "tip", title: "A tip", text: words(5) },
    ]);
    const metrics = computeSectionMetrics(section, 0);

    // heading(2) + paragraph(10) + list(3+2+1) + quote(4+1 for attribution word) + callout(title 2 + text 5)
    expect(metrics.wordCount).toBeGreaterThan(20);
    expect(metrics.headingCount).toBe(1);
    expect(metrics.paragraphCount).toBe(1);
    expect(metrics.listItemCount).toBe(3); // one item + one sub-item text + one nested sub-item
    expect(metrics.calloutCounts.tip).toBe(1);
  });

  it("does not count image/calculator blocks toward word count", () => {
    const section = makeSection("test", [{ type: "image", url: "/x.png", alt: "A description with several words in it" }]);
    const metrics = computeSectionMetrics(section, 0);
    expect(metrics.wordCount).toBe(0);
  });

  it("detects numeric and citation density signals", () => {
    const section = makeSection("test", [
      paragraph("VO2 max rises by 15% after 6 weeks of training (Daniels, Running Formula)."),
    ]);
    const metrics = computeSectionMetrics(section, 0);
    expect(metrics.numericSignalCount).toBeGreaterThan(0);
    expect(metrics.citationSignalCount).toBeGreaterThan(0);
  });
});

describe("classifyDepthTier", () => {
  const baseMetrics = {
    slug: "test",
    wordCount: 0,
    headingCount: 0,
    h2Count: 0,
    paragraphCount: 0,
    listItemCount: 0,
    calloutCounts: {},
    numericSignalCount: 0,
    citationSignalCount: 0,
    conceptCount: 0,
  };

  it("classifies a very short section (a bare definition) as very_short with 2 recommended questions", () => {
    const assessment = classifyDepthTier({ ...baseMetrics, wordCount: 150, headingCount: 1, conceptCount: 1 });
    expect(assessment.tier).toBe("very_short");
    expect(assessment.recommendedQuestions).toBe(2);
  });

  it("classifies a short section with 3 recommended questions", () => {
    const assessment = classifyDepthTier({ ...baseMetrics, wordCount: 900, headingCount: 3, conceptCount: 2 });
    expect(assessment.tier).toBe("short");
    expect(assessment.recommendedQuestions).toBe(3);
  });

  it("classifies a moderate section with 4-5 recommended questions", () => {
    const assessment = classifyDepthTier({ ...baseMetrics, wordCount: 2500, headingCount: 6, conceptCount: 5 });
    expect(assessment.tier).toBe("moderate");
    expect([4, 5]).toContain(assessment.recommendedQuestions);
  });

  it("classifies a long section with 6-7 recommended questions", () => {
    const assessment = classifyDepthTier({ ...baseMetrics, wordCount: 5500, headingCount: 12, conceptCount: 8 });
    expect(assessment.tier).toBe("long");
    expect([6, 7]).toContain(assessment.recommendedQuestions);
  });

  it("classifies a very long, conceptually dense section with 8-10 recommended questions, capped at 10", () => {
    const assessment = classifyDepthTier({
      ...baseMetrics,
      wordCount: 8000,
      headingCount: 30,
      conceptCount: 15,
      calloutCounts: { research: 10, advanced: 5 },
      numericSignalCount: 20,
      citationSignalCount: 20,
    });
    expect(assessment.tier).toBe("very_long");
    expect(assessment.recommendedQuestions).toBeGreaterThanOrEqual(8);
    expect(assessment.recommendedQuestions).toBeLessThanOrEqual(10);
  });

  it("scores a short-but-dense section above a long-but-shallow one of similar word count", () => {
    // Same word count, but one has many headings/concepts/callouts (dense)
    // and the other is one long unbroken paragraph (shallow structure).
    const dense = classifyDepthTier({ ...baseMetrics, wordCount: 2000, headingCount: 10, conceptCount: 8, calloutCounts: { research: 4 } });
    const shallow = classifyDepthTier({ ...baseMetrics, wordCount: 2000, headingCount: 1, conceptCount: 1 });
    expect(dense.score).toBeGreaterThan(shallow.score);
  });

  it("cognitive level targets always sum to the recommended question count", () => {
    for (const wordCount of [150, 900, 2500, 5500, 8000]) {
      const assessment = classifyDepthTier({ ...baseMetrics, wordCount, headingCount: Math.round(wordCount / 300), conceptCount: Math.round(wordCount / 500) });
      const total = Object.values(assessment.cognitiveLevelTargets).reduce((a, b) => a + b, 0);
      expect(total).toBe(assessment.recommendedQuestions);
    }
  });

  it("shifts weight toward apply/reason for longer tiers", () => {
    const shortAssessment = classifyDepthTier({ ...baseMetrics, wordCount: 900, headingCount: 3, conceptCount: 2 });
    const longAssessment = classifyDepthTier({ ...baseMetrics, wordCount: 8000, headingCount: 30, conceptCount: 15 });
    const shortHigherOrder = shortAssessment.cognitiveLevelTargets.apply + shortAssessment.cognitiveLevelTargets.reason;
    const longHigherOrder = longAssessment.cognitiveLevelTargets.apply + longAssessment.cognitiveLevelTargets.reason;
    expect(longHigherOrder).toBeGreaterThan(shortHigherOrder);
  });
});

describe("assessSectionDepth", () => {
  it("ties metrics and tier assessment together for a real section shape", () => {
    const section = makeSection("exercise-physiology", [
      heading("The Energy Systems"),
      paragraph(words(200)),
      heading("VO2 Max", 2),
      paragraph(words(200)),
      heading("Lactate Threshold", 2),
      paragraph(words(200)),
    ]);
    const { metrics, assessment } = assessSectionDepth(section, [
      { slug: "vo2-max", title: "VO2 Max", source: "curated" },
      { slug: "lactate-threshold", title: "Lactate Threshold", source: "curated" },
    ]);
    expect(metrics.conceptCount).toBe(2);
    expect(assessment.recommendedQuestions).toBeGreaterThanOrEqual(2);
  });
});
