import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mastery/taxonomy", () => ({
  CONCEPT_SEEDS: [
    { slug: "vo2-max", title: "VO₂ Max", topicSlug: "test-section", glossaryTermId: "vo2-max" },
    { slug: "lactate-threshold", title: "Lactate Threshold", topicSlug: "test-section", glossaryTermId: "lactate-threshold" },
  ],
}));

const { deriveConcepts } = await import("@/lib/knowledge-checks/concepts");
import type { SectionForAnalysis } from "@/lib/knowledge-checks/types";
import type { ContentBlock } from "@/lib/sections";

function makeSection(slug: string, content: ContentBlock[]): SectionForAnalysis {
  return { slug, title: "Test Section", mission: "test", topics: [], content };
}

describe("deriveConcepts", () => {
  it("includes every curated concept for this section's topic", () => {
    const concepts = deriveConcepts(makeSection("test-section", []));
    expect(concepts.map((c) => c.slug)).toEqual(expect.arrayContaining(["vo2-max", "lactate-threshold"]));
    expect(concepts.every((c) => c.source === "curated")).toBe(true);
  });

  it("adds a heading-derived concept for an h2 not already represented by a curated concept", () => {
    const concepts = deriveConcepts(
      makeSection("test-section", [
        { type: "heading", text: "VO2 Max Basics" }, // overlaps curated "VO₂ Max" -- should NOT duplicate
        { type: "paragraph", text: "..." },
        { type: "heading", text: "Running Economy Explained" }, // genuinely new
        { type: "paragraph", text: "..." },
      ]),
    );
    const slugs = concepts.map((c) => c.slug);
    expect(slugs).toContain("vo2-max");
    expect(slugs).toContain("lactate-threshold");
    expect(slugs.filter((s) => s.includes("running-economy")).length).toBe(1);
    // "VO2 Max Basics" heading shouldn't produce a *second*, redundant
    // vo2-max-ish concept alongside the curated one -- exactly 3 concepts
    // total (the 2 curated + the one genuinely new heading), not 4.
    expect(concepts.length).toBe(3);
  });

  it("ignores a section with no matching topic in CONCEPT_SEEDS and derives purely from headings", () => {
    const concepts = deriveConcepts(
      makeSection("unrelated-section", [
        { type: "heading", text: "Building Aerobic Capacity" },
        { type: "paragraph", text: "..." },
        { type: "heading", text: "Managing Race-Day Nutrition" },
        { type: "paragraph", text: "..." },
      ]),
    );
    expect(concepts.length).toBe(2);
    expect(concepts.every((c) => c.source === "heading")).toBe(true);
  });

  it("does not treat two similarly-worded headings as two separate concepts", () => {
    const concepts = deriveConcepts(
      makeSection("unrelated-section", [
        { type: "heading", text: "Understanding Muscle Fiber Types" },
        { type: "paragraph", text: "..." },
        { type: "heading", text: "Muscle Fiber Types Explained" },
        { type: "paragraph", text: "..." },
      ]),
    );
    expect(concepts.length).toBe(1);
  });

  it("falls back to one whole-section concept when there is real content but zero headings", () => {
    const concepts = deriveConcepts(makeSection("unrelated-section", [{ type: "paragraph", text: "Real prose with no heading structure at all." }]));
    expect(concepts.length).toBe(1);
  });

  it("returns no concepts for a section with no content at all", () => {
    expect(deriveConcepts(makeSection("empty-section", []))).toEqual([]);
  });
});
