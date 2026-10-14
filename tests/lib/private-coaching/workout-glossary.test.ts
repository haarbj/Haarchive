import { describe, it, expect } from "vitest";

import {
  getWorkoutGlossaryEntry,
  WORKOUT_GLOSSARY,
  GLOSSARY_PHASE_ORDER,
} from "@/lib/private-coaching/workout-glossary";

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
});
