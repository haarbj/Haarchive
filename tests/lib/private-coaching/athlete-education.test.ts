import { describe, it, expect } from "vitest";

import { ATHLETE_GUIDES, getAthleteGuide } from "@/lib/private-coaching/athlete-education";
import { EFFORT_LEVELS, EFFORT_LEVEL_VALUES, effortLevelLabel } from "@/lib/private-coaching/effort-levels";
import { WORKOUT_GLOSSARY } from "@/lib/private-coaching/workout-glossary";
import { CRASH_COURSE_EFFORT_GUIDE } from "@/lib/private-coaching/onboarding";

describe("ATHLETE_GUIDES", () => {
  it("has the four guides linked from the coaching surfaces, with unique slugs", () => {
    const slugs = ATHLETE_GUIDES.map((guide) => guide.slug);
    expect(slugs).toEqual(["how-training-works", "pacing-and-effort", "fueling-and-hydration", "workout-types"]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every guide real content and real headings", () => {
    // Through getAthleteGuide, not the static ATHLETE_GUIDES array
    // directly -- "workout-types" carries a placeholder content: [] in
    // the static array on purpose (its real content depends on the
    // viewing athlete's own race, so it's only ever built per request;
    // see getAthleteGuide's own comment).
    for (const { slug } of ATHLETE_GUIDES) {
      const guide = getAthleteGuide(slug);
      expect(guide).not.toBeNull();
      expect(guide!.title.length).toBeGreaterThan(0);
      expect(guide!.summary.length).toBeGreaterThan(20);
      expect(guide!.content.length).toBeGreaterThan(5);
      expect(guide!.content.some((block) => block.type === "heading")).toBe(true);
    }
  });

  // The workout-types guide is generated from the glossary rather than
  // written twice, so an added or renamed entry can't go missing here.
  it("builds the workout-types guide from every glossary entry", () => {
    const guide = getAthleteGuide("workout-types");
    const headings = (guide?.content ?? [])
      .filter((block): block is { type: "heading"; text: string; level?: 2 | 3 } => block.type === "heading")
      .map((block) => block.text);
    for (const entry of WORKOUT_GLOSSARY) {
      expect(headings).toContain(entry.name);
    }
  });

  it("returns null for an unknown slug", () => {
    expect(getAthleteGuide("not-a-guide")).toBeNull();
  });
});

// Audit against the verified "Marathon Excellence for Everyone" source
// quotes (Ch. 4/5/6) -- same ground truth the phase-explainer audit used.
// Pins the corrected claims so a future edit can't silently reintroduce
// the error found here: the "four moving parts" list had substituted
// "Resilience" for the source's actual fourth general-phase capability,
// "robust structural integrity," and the paragraph right after it claimed
// the specific phase builds resilience exclusively, when the source
// attributes resilience-building to the supportive phase's own sessions
// ("These sessions boost resilience") and only says specific phase
// weights it more heavily, not that it's exclusive to that phase.
describe("how-training-works guide matches the source (Ch. 4/5/6)", () => {
  function guideText(): string {
    const guide = getAthleteGuide("how-training-works");
    return (guide?.content ?? [])
      .map((block) => {
        if ("text" in block && typeof block.text === "string") return block.text;
        if ("items" in block && block.items) {
          return block.items
            .map((item) => (typeof item === "string" ? item : `${item.text} ${item.items.join(" ")}`))
            .join(" ");
        }
        return "";
      })
      .join(" ");
  }

  it("names the source's actual four general-phase capabilities -- structural integrity, not resilience, as the fourth", () => {
    const text = guideText();
    expect(text).toMatch(/Structural integrity/);
    expect(text).not.toMatch(/four moving parts[\s\S]*Resilience\./);
  });

  it("does not claim the general phase builds resilience -- resilience is introduced as a separate, later-arriving capability", () => {
    const text = guideText();
    expect(text).not.toMatch(/general phase (raises the ceiling and sharpens efficiency|builds resilience)/i);
  });

  it("attributes the start of resilience-building to the supportive phase, matching 'these sessions boost resilience'", () => {
    const text = guideText();
    expect(text).toMatch(/supportive phase is where a fifth thing starts getting built.*resilience/i);
  });

  it("does not claim resilience-building is exclusive to the specific phase -- the source only weights it more heavily there", () => {
    const text = guideText();
    expect(text).toMatch(/specific phase pushes resilience hardest/i);
    expect(text).not.toMatch(/specific phase builds resilience,/i);
  });

  it("frames the general phase as an ensemble with no single workout type carrying it", () => {
    const text = guideText();
    expect(text).toMatch(/ensemble/i);
  });
});

describe("EFFORT_LEVELS", () => {
  it("has unique values and a description for each", () => {
    expect(new Set(EFFORT_LEVEL_VALUES).size).toBe(EFFORT_LEVELS.length);
    for (const level of EFFORT_LEVELS) {
      expect(level.label.length).toBeGreaterThan(0);
      expect(level.feel.length).toBeGreaterThan(20);
    }
  });

  it("labels a stored value, and passes an unrecognized one through", () => {
    expect(effortLevelLabel("moderate")).toBe("Moderate");
    expect(effortLevelLabel(null)).toBeNull();
    expect(effortLevelLabel("some-older-value")).toBe("some-older-value");
  });

  // The pacing guide's effort reference is generated from the same list
  // the log form's select uses, which is the point of sharing it.
  it("appears in the pacing guide's effort reference", () => {
    const guide = getAthleteGuide("pacing-and-effort");
    const listed = (guide?.content ?? []).some(
      (block) =>
        block.type === "list" &&
        block.items.every((item) => typeof item === "string") &&
        EFFORT_LEVELS.every((level) => block.items.some((item) => String(item).startsWith(level.label))),
    );
    expect(listed).toBe(true);
  });

  // Part K item 33: the Crash Course's own effort table feeds this same
  // guide as the beginner-friendly reference.
  it("carries the Crash Course's effort table as a beginner-friendly reference in the same guide", () => {
    const guide = getAthleteGuide("pacing-and-effort");
    const text = (guide?.content ?? [])
      .map((block) => ("text" in block ? String(block.text) : ""))
      .join(" ");
    for (const level of CRASH_COURSE_EFFORT_GUIDE) {
      expect(text).toContain(level.effort);
    }
    expect(text).toMatch(/5K Crash Course uses/);
  });
});
