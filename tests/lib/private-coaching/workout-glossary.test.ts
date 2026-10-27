import { describe, it, expect } from "vitest";

import {
  getWorkoutGlossaryEntry,
  getGlossaryEntryById,
  resolveGlossaryExample,
  WORKOUT_GLOSSARY,
  GLOSSARY_PHASE_ORDER,
} from "@/lib/private-coaching/workout-glossary";
import type { AthleteMostRecentRace } from "@/lib/private-coaching/pace-reference";

describe("getWorkoutGlossaryEntry", () => {
  it("resolves a bare label with no pace context", () => {
    expect(getWorkoutGlossaryEntry("Kenyan Progression")?.id).toBe("progression-run");
    expect(getWorkoutGlossaryEntry("Strides")?.id).toBe("strides");
    expect(getWorkoutGlossaryEntry("Very Easy")?.id).toBe("easy-running");
  });

  it("is case-insensitive and tolerates a parenthetical detail", () => {
    expect(getWorkoutGlossaryEntry("STRIDES")?.id).toBe("strides");
    expect(getWorkoutGlossaryEntry("long run")?.id).toBe("long-easy");
    expect(getWorkoutGlossaryEntry("Long Run (trails)")?.id).toBe("long-easy");
  });

  // The whole reason pace context exists: one label, four different
  // sessions across the phase progression.
  it("disambiguates the same Intervals label by pace basis and percentage", () => {
    const at = (basis: "5k" | "marathon", min: number, max: number) =>
      getWorkoutGlossaryEntry("Intervals", { basis, min, max })?.id;

    expect(at("5k", 100, 100)).toBe("intervals-100-5k");
    expect(at("5k", 95, 95)).toBe("intervals-95-5k");
    expect(at("marathon", 110, 110)).toBe("long-repeats-110");
    expect(at("marathon", 105, 105)).toBe("alternating-km-105");
    expect(at("marathon", 100, 100)).toBe("alternating-km-100");
  });

  it("splits long runs by whether they carry a marathon-pace target", () => {
    expect(getWorkoutGlossaryEntry("LR")?.id).toBe("long-easy");
    expect(getWorkoutGlossaryEntry("LR", { basis: "marathon", min: 90, max: 92 })?.id).toBe("long-fast-90");
    expect(getWorkoutGlossaryEntry("LR", { basis: "marathon", min: 95, max: 95 })?.id).toBe("long-fast-95");
  });

  it("splits steady-state work by basis and percentage", () => {
    expect(getWorkoutGlossaryEntry("Steady State", { basis: "5k", min: 85, max: 85 })?.id).toBe("strong-run");
    expect(getWorkoutGlossaryEntry("Steady State", { basis: "5k", min: 90, max: 92 })?.id).toBe("cruise-intervals");
    expect(getWorkoutGlossaryEntry("Steady State", { basis: "marathon", min: 105, max: 105 })?.id).toBe(
      "fast-continuous-105",
    );
    expect(getWorkoutGlossaryEntry("Steady State", { basis: "marathon", min: 98, max: 100 })?.id).toBe(
      "fast-continuous-100",
    );
  });

  it("uses the midpoint of a percentage range", () => {
    // 93-97 straddles the 5K boundary at 97.5; the midpoint of 95 puts it
    // in the 95% entry rather than the 100% one.
    expect(getWorkoutGlossaryEntry("Intervals", { basis: "5k", min: 93, max: 97 })?.id).toBe("intervals-95-5k");
  });

  it("falls back to the bare-label rule when a pace-conditioned rule cannot match", () => {
    // An Intervals day with no pace percentage at all matches none of the
    // basis-conditioned rules, and there is no bare Intervals rule, so it
    // degrades to no entry rather than guessing a percentage.
    expect(getWorkoutGlossaryEntry("Intervals")).toBeNull();
    // A long run with a 5K-basis target has no long-run rule for that
    // basis, so it falls through to the plain long-easy entry.
    expect(getWorkoutGlossaryEntry("LR", { basis: "5k", min: 85, max: 85 })?.id).toBe("long-easy");
  });

  it("returns null for days with nothing to explain", () => {
    expect(getWorkoutGlossaryEntry(null)).toBeNull();
    expect(getWorkoutGlossaryEntry("")).toBeNull();
    expect(getWorkoutGlossaryEntry("OFF")).toBeNull();
    expect(getWorkoutGlossaryEntry("XT (Bike)")).toBeNull();
    expect(getWorkoutGlossaryEntry("Brody's special secret session")).toBeNull();
  });

  it("flags advanced sessions as coach-assigned", () => {
    expect(getWorkoutGlossaryEntry("Double Threshold")?.coachAssignOnly).toBe(true);
    expect(getWorkoutGlossaryEntry("Depletion")?.coachAssignOnly).toBe(true);
    expect(getWorkoutGlossaryEntry("Hill Sprints")?.coachAssignOnly).toBe(true);
    expect(getWorkoutGlossaryEntry("Strides")?.coachAssignOnly).toBeUndefined();
  });
});

describe("WORKOUT_GLOSSARY", () => {
  it("has unique ids", () => {
    const ids = WORKOUT_GLOSSARY.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Every entry has to carry all three pieces, since the workout detail
  // page and the browsable guide both render all of them unconditionally.
  it("gives every entry real content, including a what-it-builds line", () => {
    for (const entry of WORKOUT_GLOSSARY) {
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.whatItIs.length).toBeGreaterThan(40);
      expect(entry.howToExecute.length).toBeGreaterThan(40);
      expect(entry.whatItBuilds.length).toBeGreaterThan(40);
      expect(GLOSSARY_PHASE_ORDER).toContain(entry.phase);
    }
  });

  // The two within-session pace-progression entries inventoried for this
  // fix -- anyone adding a third should give it an example too.
  it("gives both progression-type entries a worked example", () => {
    expect(getGlossaryEntryById("progression-run")?.example).toBeDefined();
    expect(getGlossaryEntryById("long-fast-stepwise")?.example).toBeDefined();
  });
});

describe("resolveGlossaryExample", () => {
  const entry = getGlossaryEntryById("progression-run")!;
  const example = entry.example!;

  it("shows the structure and each segment's pace zone by name, with no fabricated numbers, when no race is on file", () => {
    const resolved = resolveGlossaryExample(example, null);
    expect(resolved.hasRace).toBe(false);
    expect(resolved.structure).toBe(example.structure);
    expect(resolved.segments).toEqual([
      { label: "First third", text: "Easy Pace" },
      { label: "Middle third", text: "Steady Pace" },
      { label: "Final third", text: "Tempo Pace" },
    ]);
    // Never a pace-looking string ("X:XX/mi") when there's no race to
    // compute one from.
    for (const segment of resolved.segments) {
      expect(segment.text).not.toMatch(/\d+:\d{2}/);
    }
  });

  it("computes real per-mile splits from the viewing athlete's own race when one is on file", () => {
    const race: AthleteMostRecentRace = {
      id: "r1",
      raceName: "QA Test 10K",
      raceDate: "2026-09-01",
      distanceM: 10000,
      finishTimeS: 2400,
    };
    const resolved = resolveGlossaryExample(example, race);
    expect(resolved.hasRace).toBe(true);
    expect(resolved.segments).toHaveLength(3);
    for (const segment of resolved.segments) {
      expect(segment.text).toMatch(/\d+:\d{2}(–\d+:\d{2})?\/mi \(.+\)/);
    }
    // Each segment should be faster than the one before it -- the whole
    // point of a progression.
    const paceToSeconds = (text: string) => {
      const [min, sec] = text.split(/[–/]/)[0].split(":").map(Number);
      return min * 60 + sec;
    };
    const paces = resolved.segments.map((s) => paceToSeconds(s.text));
    expect(paces[0]).toBeGreaterThan(paces[1]);
    expect(paces[1]).toBeGreaterThan(paces[2]);
  });
});
