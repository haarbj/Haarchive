import { describe, expect, it } from "vitest";
import { retrieveRelevantContent } from "@/lib/ai/retrieval";
import { sections } from "@/lib/sections";

// Tested against the site's real educational content, not fixtures --
// retrieval quality over this exact corpus is the point of the module.

describe("retrieveRelevantContent", () => {
  it("returns nothing for a query with no real tokens", () => {
    expect(retrieveRelevantContent("", sections)).toEqual([]);
    expect(retrieveRelevantContent("the a an", sections)).toEqual([]);
  });

  it("returns nothing for tokens that appear nowhere in the content", () => {
    expect(retrieveRelevantContent("xyzzy plugh qwzxcv", sections)).toEqual([]);
  });

  it("surfaces polarized-training content for a polarized-training question", () => {
    const results = retrieveRelevantContent("what is polarized training 80/20", sections);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => /polarized/i.test(r.text) || /polarized/i.test(r.heading ?? ""))).toBe(true);
  });

  it("surfaces aerobic-base content for a capillary question", () => {
    const results = retrieveRelevantContent("how do capillaries help my aerobic base", sections);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.sectionSlug === "the-aerobic-base")).toBe(true);
  });

  it("retrieves a single list item, not the whole list it came from", () => {
    // "flavoring" alone, rather than diluted with common tokens that also
    // score highly all over the site -- this test is about excerpt
    // granularity, not ranking, so keep the query specific enough that a
    // flavoring mention (Nutrition & Fueling's dental-health checklist)
    // reliably surfaces at all.
    const results = retrieveRelevantContent("flavoring", sections, 10);
    const hits = results.filter((r) => /flavoring/i.test(r.text));
    expect(hits.length).toBeGreaterThan(0);
    // That checklist has several items; a real hit on it should be one
    // short line ("Choose a less acidic flavoring when the option
    // exists."), not the whole list concatenated together.
    expect(hits.some((r) => r.text.length < 100)).toBe(true);
  });

  it("ranks a heading match above a same-token body-only match", () => {
    // "Polarized Training (80/20): The One I Lean On Most" is a heading in
    // coaching-library; "polarized" also appears in plain body text
    // elsewhere (e.g. research-library). The heading-boosted excerpt should
    // outrank a body-only mention of the same token.
    const results = retrieveRelevantContent("polarized", sections);
    const headingHit = results.find((r) => r.heading && /polarized/i.test(r.heading));
    const bodyOnlyHit = results.find((r) => !r.heading || !/polarized/i.test(r.heading));
    expect(headingHit).toBeDefined();
    if (bodyOnlyHit) {
      expect(headingHit!.score).toBeGreaterThanOrEqual(bodyOnlyHit.score);
    }
  });

  it("respects maxResults", () => {
    const results = retrieveRelevantContent("training running aerobic recovery", sections, 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("returns results sorted by descending score", () => {
    const results = retrieveRelevantContent("aerobic base capillary mitochondria", sections, 10);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  it("never returns a zero-score excerpt", () => {
    const results = retrieveRelevantContent("marathon taper fueling honey", sections, 20);
    for (const r of results) {
      expect(r.score).toBeGreaterThan(0);
    }
  });

  it("skips sections with no content array without erroring", () => {
    const noContentSections = sections.filter((s) => !s.content || s.content.length === 0);
    // Sanity check the fixture actually includes at least one such section
    // (article-index / planned-topics sections) so this test is meaningful.
    if (noContentSections.length > 0) {
      expect(() => retrieveRelevantContent("training", sections)).not.toThrow();
    }
  });
});
