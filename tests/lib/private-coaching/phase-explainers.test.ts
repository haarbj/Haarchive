import { describe, it, expect } from "vitest";

import {
  DEFAULT_PHASE_EXPLAINERS,
  defaultPhaseExplainer,
  resolvePhaseExplainer,
  explainerParagraphs,
  taperPreview,
  PLANS_ADAPT_NOTE,
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

describe("taperPreview", () => {
  it("is offered for the specific phase only", () => {
    expect(taperPreview("Specific")).toBeTruthy();
    expect(taperPreview("specific")).toBeTruthy();
    expect(taperPreview("Specific Phase")).toBeTruthy();
    expect(taperPreview("General")).toBeNull();
    expect(taperPreview("Supportive")).toBeNull();
    expect(taperPreview("Taper")).toBeNull();
    expect(taperPreview(null)).toBeNull();
  });

  it("describes the shape of the lead-in without prescribing it", () => {
    const preview = taperPreview("Specific")!;
    // The four beats: one last full session, easy days, a tune-up, the race.
    expect(preview).toMatch(/two weeks out/i);
    expect(preview).toMatch(/easy days/i);
    expect(preview).toMatch(/tune-up/i);
    // No paces, distances or rep counts -- this is a preview, not a plan.
    expect(preview).not.toMatch(/\d+\s*%/);
    expect(preview).not.toMatch(/\d+\s*(mi|km|x)\b/i);
  });

  it("says plainly that the athlete's own coach may do it differently", () => {
    // The lead-in is an editable template, so this must not read as a promise.
    expect(taperPreview("Specific")!).toMatch(/coach may shape this differently/i);
  });

  it("renders as real paragraphs through the shared splitter", () => {
    const paragraphs = explainerParagraphs(taperPreview("Specific")!);
    expect(paragraphs.length).toBeGreaterThan(3);
    expect(paragraphs.every((p) => p.length > 0)).toBe(true);
  });
});

describe("PLANS_ADAPT_NOTE", () => {
  it("is one short sentence pair about adaptation being normal", () => {
    expect(PLANS_ADAPT_NOTE).toMatch(/move workouts/i);
    expect(PLANS_ADAPT_NOTE).toMatch(/not checking every box/i);
  });

  it("keeps the coach-facing completion statistic out of athlete-facing copy", () => {
    // "~80% of workouts completed is typical" is Part E copy for coaches.
    expect(PLANS_ADAPT_NOTE).not.toMatch(/80|percent|%/);
  });
});
