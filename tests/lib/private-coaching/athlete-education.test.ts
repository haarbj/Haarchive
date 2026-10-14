import { describe, it, expect } from "vitest";

import { ATHLETE_GUIDES, getAthleteGuide } from "@/lib/private-coaching/athlete-education";
import { EFFORT_LEVELS, EFFORT_LEVEL_VALUES, effortLevelLabel } from "@/lib/private-coaching/effort-levels";
import { WORKOUT_GLOSSARY } from "@/lib/private-coaching/workout-glossary";

describe("ATHLETE_GUIDES", () => {
  it("has the four guides linked from the coaching surfaces, with unique slugs", () => {
    const slugs = ATHLETE_GUIDES.map((guide) => guide.slug);
    expect(slugs).toEqual(["how-training-works", "pacing-and-effort", "fueling-and-hydration", "workout-types"]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every guide real content and real headings", () => {
    for (const guide of ATHLETE_GUIDES) {
      expect(guide.title.length).toBeGreaterThan(0);
      expect(guide.summary.length).toBeGreaterThan(20);
      expect(guide.content.length).toBeGreaterThan(5);
      expect(guide.content.some((block) => block.type === "heading")).toBe(true);
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
});
