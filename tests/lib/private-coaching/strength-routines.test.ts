import { describe, expect, it } from "vitest";

import {
  FOUNDATION_ROUTINES,
  HIP_STABILITY_ROUTINE,
  PEDESTAL_ROUTINE,
  heavyLiftingExtra,
  hillSprintsExtra,
  plyometricsExtra,
  resolveWeeklyReps,
  routineToExtra,
} from "@/lib/private-coaching/strength-routines";

// Table 49.1, "The modified pedestal and hip strength routines"
// (Marathon Excellence for Everyone, Ch. 49) -- the exact exercise lists,
// in the table's own order, pinned here so a future edit can't silently
// drift from the source.
const PEDESTAL_EXERCISES = [
  "Front plank with leg lift",
  "Flutter kick on back",
  "Pushup stance with leg lift",
  "Back pushup stance with slightly bent knees, leg lift",
  "Side plank, single leg lift",
  "Straight-arm side plank with leg lift",
  "Compact front plank hip extension",
  "Compact back plank hip flexion",
  "Legs-up crunch",
  "Bicycle crunch",
];

const HIP_STABILITY_EXERCISES = ["Side leg lift", "Clamshell leg lift", "Glute bridge", "Monster walk"];

describe("PEDESTAL_ROUTINE", () => {
  it("matches Table 49.1's exercise list exactly, in order", () => {
    expect(PEDESTAL_ROUTINE.exercises.map((e) => e.name)).toEqual(PEDESTAL_EXERCISES);
  });

  it("carries the table's frequency and execution guidance verbatim", () => {
    expect(PEDESTAL_ROUTINE.frequency).toMatch(/5-6 times per week/);
    expect(PEDESTAL_ROUTINE.frequency).toMatch(/immediately following a run/);
    expect(PEDESTAL_ROUTINE.execution).toMatch(/quickly at high intensity/);
    expect(PEDESTAL_ROUTINE.execution).toMatch(/control and stability/);
  });

  it("requires no equipment, per the table", () => {
    expect(PEDESTAL_ROUTINE.equipment).toBeNull();
  });

  it("progresses 7 -> 8 -> 10 reps across weeks 1, 2, and 3+", () => {
    expect(resolveWeeklyReps(PEDESTAL_ROUTINE.progression, 1)).toBe("7 reps");
    expect(resolveWeeklyReps(PEDESTAL_ROUTINE.progression, 2)).toBe("8 reps");
    expect(resolveWeeklyReps(PEDESTAL_ROUTINE.progression, 3)).toBe("10 reps");
    // "Weeks 3+" -- every later week stays at the same tier, not a cliff back to 7.
    expect(resolveWeeklyReps(PEDESTAL_ROUTINE.progression, 4)).toBe("10 reps");
    expect(resolveWeeklyReps(PEDESTAL_ROUTINE.progression, 12)).toBe("10 reps");
  });
});

describe("HIP_STABILITY_ROUTINE", () => {
  it("matches Table 49.1's exercise list exactly, in order", () => {
    expect(HIP_STABILITY_ROUTINE.exercises.map((e) => e.name)).toEqual(HIP_STABILITY_EXERCISES);
  });

  it("carries the table's frequency and execution guidance verbatim", () => {
    expect(HIP_STABILITY_ROUTINE.frequency).toMatch(/6-7 days per week/);
    expect(HIP_STABILITY_ROUTINE.frequency).toMatch(/following a run and following the pedestal routine/);
    expect(HIP_STABILITY_ROUTINE.execution).toMatch(/slowly/);
    expect(HIP_STABILITY_ROUTINE.execution).toMatch(/moderate range of motion/);
  });

  it("requires an elastic resistance band and nothing else, per the table", () => {
    expect(HIP_STABILITY_ROUTINE.equipment).toMatch(/elastic resistance band/i);
    expect(HIP_STABILITY_ROUTINE.equipment).toMatch(/no other specialized equipment/i);
  });

  it("notes glute bridge's hold-based rep and monster walk's band placement", () => {
    const glutebridge = HIP_STABILITY_ROUTINE.exercises.find((e) => e.name === "Glute bridge")!;
    expect(glutebridge.note).toMatch(/1\.5 second hold/);
    const monsterWalk = HIP_STABILITY_ROUTINE.exercises.find((e) => e.name === "Monster walk")!;
    expect(monsterWalk.note).toMatch(/resistance band around knees/);
  });

  it("progresses 30 -> 40 -> 2x30 -> 2x40 reps across weeks 1 through 4+", () => {
    expect(resolveWeeklyReps(HIP_STABILITY_ROUTINE.progression, 1)).toBe("30 reps");
    expect(resolveWeeklyReps(HIP_STABILITY_ROUTINE.progression, 2)).toBe("40 reps");
    expect(resolveWeeklyReps(HIP_STABILITY_ROUTINE.progression, 3)).toBe("2 x 30 reps");
    expect(resolveWeeklyReps(HIP_STABILITY_ROUTINE.progression, 4)).toBe("2 x 40 reps");
    // "Weeks 4+" -- stays there, not a cliff back to week 1.
    expect(resolveWeeklyReps(HIP_STABILITY_ROUTINE.progression, 10)).toBe("2 x 40 reps");
  });
});

describe("resolveWeeklyReps", () => {
  it("falls back to the first tier for a week before any tier starts (defensive -- shouldn't happen in practice)", () => {
    expect(resolveWeeklyReps([{ fromWeek: 2, reps: "x" }], 1)).toBe("x");
  });
});

describe("routineToExtra", () => {
  it("surfaces frequency, execution, and equipment in the overview -- not just the exercise list", () => {
    const pedestalExtra = routineToExtra(PEDESTAL_ROUTINE, 1);
    expect(pedestalExtra.overview).toMatch(/5-6 times per week/);
    expect(pedestalExtra.overview).toMatch(/quickly at high intensity/);

    const hipExtra = routineToExtra(HIP_STABILITY_ROUTINE, 1);
    expect(hipExtra.overview).toMatch(/6-7 days per week/);
    expect(hipExtra.overview).toMatch(/slowly/);
    expect(hipExtra.overview).toMatch(/elastic resistance band/i);
  });

  it("has no equipment sentence in the pedestal overview (the table specifies none)", () => {
    const pedestalExtra = routineToExtra(PEDESTAL_ROUTINE, 1);
    expect(pedestalExtra.overview).not.toMatch(/band|equipment/i);
  });

  it("converts cleanly into a renderable extra with one item per exercise", () => {
    const extra = routineToExtra(PEDESTAL_ROUTINE, 1);
    expect(extra.kind).toBe("Strength");
    expect(extra.items).toHaveLength(PEDESTAL_ROUTINE.exercises.length);
    expect(extra.items[0]).toContain(PEDESTAL_ROUTINE.exercises[0].name);
  });

  it("bakes the resolved week's rep count into every item line", () => {
    const week1 = routineToExtra(PEDESTAL_ROUTINE, 1);
    expect(week1.items.every((item) => item.includes("7 reps"))).toBe(true);

    const week2 = routineToExtra(PEDESTAL_ROUTINE, 2);
    expect(week2.items.every((item) => item.includes("8 reps"))).toBe(true);

    const week5 = routineToExtra(PEDESTAL_ROUTINE, 5);
    expect(week5.items.every((item) => item.includes("10 reps"))).toBe(true);
  });

  it("carries each exercise's own note alongside the week's rep count", () => {
    const extra = routineToExtra(HIP_STABILITY_ROUTINE, 3);
    const glutebridge = extra.items.find((item) => item.startsWith("Glute bridge"))!;
    expect(glutebridge).toContain("2 x 30 reps");
    expect(glutebridge).toContain("1.5 second hold");
  });

  it("hip stability is a distinct routine from pedestal", () => {
    expect(HIP_STABILITY_ROUTINE.key).not.toBe(PEDESTAL_ROUTINE.key);
    expect(HIP_STABILITY_ROUTINE.exercises).not.toEqual(PEDESTAL_ROUTINE.exercises);
  });

  it("FOUNDATION_ROUTINES carries exactly these two, pedestal first", () => {
    expect(FOUNDATION_ROUTINES).toEqual([PEDESTAL_ROUTINE, HIP_STABILITY_ROUTINE]);
  });
});

describe("performance option content (unrelated to Table 49.1 -- unchanged)", () => {
  it("heavy lifting reduces load language in supportive/specific vs general", () => {
    const general = heavyLiftingExtra("general");
    const supportive = heavyLiftingExtra("supportive");
    expect(general.items.join(" ")).toMatch(/2-3 sets x 4 reps/);
    expect(supportive.items.join(" ")).toMatch(/60-70%/);
  });

  it("plyometrics and hill sprints both give real, actionable items", () => {
    expect(plyometricsExtra().items.length).toBeGreaterThan(0);
    expect(hillSprintsExtra().items.length).toBeGreaterThan(0);
  });
});
