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

// Prompt 10's own audit against the verified "Marathon Excellence for
// Everyone" source quotes (Ch. 4/5/6). Pins the corrected key claims so a
// future edit can't silently drift back toward the discrepancies found:
// general training wrongly claiming it "leans hardest" on only two of its
// four capabilities (contradicting the source's explicit "no one type of
// workout takes on outsized importance... ensemble of all workouts
// together"), a missing pace range, resilience wrongly attributed to the
// specific phase only, and "No racing" overstating the source's actual
// hedge ("best to avoid").
describe("GENERAL explainer matches the source (Ch. 4)", () => {
  const general = DEFAULT_PHASE_EXPLAINERS.general;

  it("does not claim the phase leans hardest on only some of its capabilities -- the source says no workout takes on outsized importance", () => {
    expect(general).not.toMatch(/leans hardest/i);
    expect(general.toLowerCase()).toContain("ensemble");
  });

  it("states the pace basis as a percentage of 5K pace, not marathon pace", () => {
    expect(general).toMatch(/percentage of your current 5K pace, not marathon pace/i);
  });

  it("states the source's own defining pace range (45-100%) and emphasis band (75-92%)", () => {
    expect(general).toMatch(/45 to 100 percent/i);
    expect(general).toMatch(/75 to 92 percent/i);
  });

  it("explains why the phase is called 'general' -- capabilities useful for any race distance, not marathon-specific yet", () => {
    expect(general).toMatch(/nothing here is marathon-specific yet/i);
    expect(general).toMatch(/5K or a marathon/i);
  });

  it("distinguishes structural toughness from resilience, and does not claim this phase builds resilience", () => {
    expect(general).toMatch(/different thing from resilience/i);
  });

  it("attributes the start of resilience-building to the supportive phase, not exclusively to specific", () => {
    expect(general).toMatch(/that is where resilience starts getting built/i);
  });
});

describe("SUPPORTIVE explainer matches the source (Ch. 5)", () => {
  const supportive = DEFAULT_PHASE_EXPLAINERS.supportive;

  it("states the two source pace targets exactly: 90-95% MP and 105-110% MP", () => {
    expect(supportive).toMatch(/90 to 95 percent of marathon pace/i);
    expect(supportive).toMatch(/105 to 110 percent of marathon pace/i);
  });

  it("captures the effort/pace inversion from the source verbatim in spirit: run the right pace, check the effort", () => {
    expect(supportive).toMatch(/ran the right effort and checked the pace/i);
    expect(supportive).toMatch(/run the right pace and check the effort/i);
  });

  it("attributes resilience-building to this phase's sessions", () => {
    expect(supportive).toMatch(/begin building resilience/i);
  });

  it("frames progress as running the same pace for longer, not increasing pace", () => {
    expect(supportive).toMatch(/same pace for longer/i);
  });
});

describe("SPECIFIC explainer matches the source (Ch. 6)", () => {
  const specific = DEFAULT_PHASE_EXPLAINERS.specific;

  it("states the source's key-workout pace range exactly: 95-105% MP", () => {
    expect(specific).toMatch(/95 to 105 percent of marathon pace/i);
  });

  it("hedges on racing the same way the source does ('best to avoid'), not an absolute prohibition", () => {
    expect(specific).toMatch(/best avoided/i);
    expect(specific).not.toMatch(/^No racing/im);
  });

  it("frames progress as resilience, not speed", () => {
    expect(specific).toMatch(/resilience rather than speed/i);
  });

  it("states the source's taper guidance: short, modest, no dramatic changes, no race-day magic", () => {
    expect(specific).toMatch(/short and modest/i);
    expect(specific).toMatch(/no race-day magic/i);
    expect(specific).toMatch(/nothing dramatically/i);
  });

  it("frames mileage as subordinate to arriving fresh for key workouts, matching the source", () => {
    expect(specific).toMatch(/weekly mileage matters less now/i);
  });
});

describe("recovery phases explain themselves too", () => {
  it("resolves an explainer for the post-race recovery phases", () => {
    // Part H item 21: an athlete assigned the recovery block gets the same
    // "why this phase" treatment as a buildup phase.
    expect(defaultPhaseExplainer("Return to running")).toMatch(/two full weeks of complete rest/i);
    expect(defaultPhaseExplainer("return to training")).toMatch(/narrowed you on purpose/i);
  });

  it("still resolves nothing for a phase nobody has written copy for", () => {
    expect(defaultPhaseExplainer("Sharpening")).toBeNull();
    expect(defaultPhaseExplainer("Base")).toBeNull();
  });

  it("offers no taper preview for a recovery phase", () => {
    expect(taperPreview("Return to running")).toBeNull();
  });
});
