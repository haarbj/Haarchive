import { describe, it, expect } from "vitest";

import {
  DEFAULT_PHASE_EXPLAINERS,
  defaultPhaseExplainer,
  resolvePhaseExplainer,
  explainerParagraphs,
} from "@/lib/private-coaching/phase-explainers";

describe("defaultPhaseExplainer", () => {
  it("matches the three standard phases regardless of case or surrounding words", () => {
    expect(defaultPhaseExplainer("General")).toBe(DEFAULT_PHASE_EXPLAINERS.general);
    expect(defaultPhaseExplainer("general")).toBe(DEFAULT_PHASE_EXPLAINERS.general);
    expect(defaultPhaseExplainer("General Phase")).toBe(DEFAULT_PHASE_EXPLAINERS.general);
    expect(defaultPhaseExplainer("Supportive")).toBe(DEFAULT_PHASE_EXPLAINERS.supportive);
    expect(defaultPhaseExplainer("Marathon-Specific")).toBe(DEFAULT_PHASE_EXPLAINERS.specific);
  });

  it("returns null rather than guessing for a phase type with no standard copy", () => {
    expect(defaultPhaseExplainer("Taper")).toBeNull();
    expect(defaultPhaseExplainer("Base")).toBeNull();
    expect(defaultPhaseExplainer("")).toBeNull();
    expect(defaultPhaseExplainer(null)).toBeNull();
  });
});

describe("resolvePhaseExplainer", () => {
  // The guarantee the athlete actually depends on: their own copy, made at
  // assignment time, is what renders, even when newer standard copy exists.
  it("prefers a stored explainer over the default", () => {
    expect(resolvePhaseExplainer("What your coach actually wrote.", "General")).toBe("What your coach actually wrote.");
  });

  it("falls back to the default when nothing was authored", () => {
    expect(resolvePhaseExplainer(null, "General")).toBe(DEFAULT_PHASE_EXPLAINERS.general);
    expect(resolvePhaseExplainer("", "Supportive")).toBe(DEFAULT_PHASE_EXPLAINERS.supportive);
    expect(resolvePhaseExplainer("   ", "Specific")).toBe(DEFAULT_PHASE_EXPLAINERS.specific);
  });

  it("returns null when there is neither a stored explainer nor a default", () => {
    expect(resolvePhaseExplainer(null, "Taper")).toBeNull();
    expect(resolvePhaseExplainer("", "Transition")).toBeNull();
  });

  it("trims a stored explainer", () => {
    expect(resolvePhaseExplainer("  padded  ", "Taper")).toBe("padded");
  });
});

describe("explainerParagraphs", () => {
  it("splits on blank lines", () => {
    expect(explainerParagraphs("One.\n\nTwo.\n\nThree.")).toEqual(["One.", "Two.", "Three."]);
  });

  // Text pasted from an editor that hard-wraps shouldn't become one
  // paragraph per line.
  it("treats a single newline as soft wrapping inside a paragraph", () => {
    expect(explainerParagraphs("One sentence\nwrapped oddly.\n\nSecond.")).toEqual([
      "One sentence wrapped oddly.",
      "Second.",
    ]);
  });

  it("drops empty runs and extra whitespace", () => {
    expect(explainerParagraphs("One.\n\n\n\n   \n\nTwo.")).toEqual(["One.", "Two."]);
    expect(explainerParagraphs("")).toEqual([]);
  });

  it("renders every standard explainer as multiple real paragraphs", () => {
    for (const explainer of Object.values(DEFAULT_PHASE_EXPLAINERS)) {
      const paragraphs = explainerParagraphs(explainer);
      expect(paragraphs.length).toBeGreaterThan(3);
      for (const paragraph of paragraphs) expect(paragraph.trim()).toBe(paragraph);
    }
  });
});
