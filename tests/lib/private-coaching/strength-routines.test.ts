import { describe, expect, it } from "vitest";

import {
  FOUNDATION_ROUTINES,
  HIP_STABILITY_ROUTINE,
  PEDESTAL_ROUTINE,
  heavyLiftingExtra,
  hillSprintsExtra,
  plyometricsExtra,
  routineToExtra,
} from "@/lib/private-coaching/strength-routines";

describe("foundation routines", () => {
  it("are both complete, assignable content -- every exercise has a name, sets/reps, and a form cue", () => {
    for (const routine of FOUNDATION_ROUTINES) {
      expect(routine.exercises.length).toBeGreaterThan(0);
      for (const exercise of routine.exercises) {
        expect(exercise.name.trim().length).toBeGreaterThan(0);
        expect(exercise.setsReps.trim().length).toBeGreaterThan(0);
        expect(exercise.cue.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("converts cleanly into a renderable extra with one item per exercise", () => {
    const extra = routineToExtra(PEDESTAL_ROUTINE);
    expect(extra.kind).toBe("Strength");
    expect(extra.items).toHaveLength(PEDESTAL_ROUTINE.exercises.length);
    expect(extra.items[0]).toContain(PEDESTAL_ROUTINE.exercises[0].name);
  });

  it("hip stability is a distinct routine from pedestal", () => {
    expect(HIP_STABILITY_ROUTINE.key).not.toBe(PEDESTAL_ROUTINE.key);
    expect(HIP_STABILITY_ROUTINE.exercises).not.toEqual(PEDESTAL_ROUTINE.exercises);
  });
});

describe("performance option content", () => {
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
