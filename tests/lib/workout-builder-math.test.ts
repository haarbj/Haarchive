import { describe, expect, it } from "vitest";

import { PACE_UNIT_METERS } from "@/lib/pace-percent-math";
import { formatClock } from "@/lib/running-format";
import {
  buildGarminProgram,
  buildWorkoutPlan,
  formatDistanceInUnit,
  formatMetersAuto,
  formatPaceRange,
  paceRangeForDisplay,
  TARGET_PACE_HALF_WIDTH_SECONDS,
  type WorkoutInputs,
} from "@/lib/workout-builder-math";

const MILE_METERS = PACE_UNIT_METERS.mi;

// 6:12/mi threshold, 8:30/mi easy -- a realistic sample workout: 1.5mi
// warmup/cooldown, 8 x 2000m @ reference pace with 1000m jog recovery.
const SAMPLE_INPUTS: WorkoutInputs = {
  referencePaceSecPerMeter: (6 * 60 + 12) / MILE_METERS,
  easyPaceSecPerMeter: (8 * 60 + 30) / MILE_METERS,
  warmupMeters: 1.5 * MILE_METERS,
  cooldownMeters: 1.5 * MILE_METERS,
  reps: 8,
  mainSetMode: "distance",
  mainSetDistanceMeters: 2000,
  mainSetDurationSeconds: 0,
  recoveryMode: "distance",
  recoveryDistanceMeters: 1000,
  recoveryDurationSeconds: 0,
  recoveryType: "jog",
};

describe("buildWorkoutPlan -- step sequence", () => {
  it("produces warmup, 2 steps per rep, and cooldown, in order", () => {
    const plan = buildWorkoutPlan(SAMPLE_INPUTS);
    expect(plan.steps).toHaveLength(1 + SAMPLE_INPUTS.reps * 2 + 1);
    expect(plan.steps[0].label).toBe("Warmup");
    expect(plan.steps[1].label).toBe("Rep 1");
    expect(plan.steps[2].label).toBe("Recovery jog 1");
    expect(plan.steps[plan.steps.length - 1].label).toBe("Cooldown");
  });

  it("numbers every rep and recovery step sequentially", () => {
    const plan = buildWorkoutPlan(SAMPLE_INPUTS);
    for (let i = 1; i <= SAMPLE_INPUTS.reps; i++) {
      expect(plan.steps[1 + (i - 1) * 2].label).toBe(`Rep ${i}`);
      expect(plan.steps[2 + (i - 1) * 2].label).toBe(`Recovery jog ${i}`);
    }
  });

  it("gives warmup, cooldown, and every recovery step a null target pace", () => {
    const plan = buildWorkoutPlan(SAMPLE_INPUTS);
    expect(plan.steps[0].targetPaceSecPerMeter).toBeNull();
    expect(plan.steps[plan.steps.length - 1].targetPaceSecPerMeter).toBeNull();
    for (let i = 1; i <= SAMPLE_INPUTS.reps; i++) {
      expect(plan.steps[2 + (i - 1) * 2].targetPaceSecPerMeter).toBeNull();
    }
  });

  it("gives every rep step the reference pace as its target", () => {
    const plan = buildWorkoutPlan(SAMPLE_INPUTS);
    for (let i = 1; i <= SAMPLE_INPUTS.reps; i++) {
      expect(plan.steps[1 + (i - 1) * 2].targetPaceSecPerMeter).toBe(SAMPLE_INPUTS.referencePaceSecPerMeter);
    }
  });
});

describe("buildWorkoutPlan -- distance/time math", () => {
  it("computes each rep's duration from the reference pace and interval distance", () => {
    const plan = buildWorkoutPlan(SAMPLE_INPUTS);
    const rep = plan.steps[1];
    expect(rep.distanceMeters).toBe(2000);
    expect(rep.durationSeconds).toBeCloseTo(2000 * SAMPLE_INPUTS.referencePaceSecPerMeter, 6);
  });

  it("computes a time-based main set's distance from its duration and the reference pace", () => {
    const inputs: WorkoutInputs = { ...SAMPLE_INPUTS, mainSetMode: "time", mainSetDurationSeconds: 5 * 60 };
    const plan = buildWorkoutPlan(inputs);
    const rep = plan.steps[1];
    expect(rep.durationSeconds).toBe(5 * 60);
    expect(rep.distanceMeters).toBeCloseTo((5 * 60) / inputs.referencePaceSecPerMeter, 6);
  });

  it("computes a jog recovery's duration from the easy pace and recovery distance", () => {
    const plan = buildWorkoutPlan(SAMPLE_INPUTS);
    const recovery = plan.steps[2];
    expect(recovery.distanceMeters).toBe(1000);
    expect(recovery.durationSeconds).toBeCloseTo(1000 * SAMPLE_INPUTS.easyPaceSecPerMeter, 6);
  });

  it("computes a time-based recovery's distance from its duration and the recovery type's assumed pace", () => {
    const inputs: WorkoutInputs = { ...SAMPLE_INPUTS, recoveryMode: "time", recoveryDurationSeconds: 90 };
    const plan = buildWorkoutPlan(inputs);
    const recovery = plan.steps[2];
    expect(recovery.durationSeconds).toBe(90);
    expect(recovery.distanceMeters).toBeCloseTo(90 / inputs.easyPaceSecPerMeter, 6);
  });

  it("gives a 'stand' recovery zero distance when specified as time", () => {
    const inputs: WorkoutInputs = { ...SAMPLE_INPUTS, recoveryMode: "time", recoveryDurationSeconds: 60, recoveryType: "stand" };
    const plan = buildWorkoutPlan(inputs);
    expect(plan.steps[2].distanceMeters).toBe(0);
    expect(plan.steps[2].durationSeconds).toBe(60);
  });

  it("warmup and cooldown use the easy pace, not the reference pace", () => {
    const plan = buildWorkoutPlan(SAMPLE_INPUTS);
    const warmup = plan.steps[0];
    expect(warmup.durationSeconds).toBeCloseTo(SAMPLE_INPUTS.warmupMeters * SAMPLE_INPUTS.easyPaceSecPerMeter, 6);
  });
});

describe("buildWorkoutPlan -- totals", () => {
  it("sums every step's distance and duration, matching a hand-computed total for the sample workout", () => {
    const plan = buildWorkoutPlan(SAMPLE_INPUTS);

    const expectedDistance = SAMPLE_INPUTS.warmupMeters + SAMPLE_INPUTS.cooldownMeters + SAMPLE_INPUTS.reps * (2000 + 1000);
    expect(plan.totalDistanceMeters).toBeCloseTo(expectedDistance, 6);

    const warmupCooldownSeconds = (SAMPLE_INPUTS.warmupMeters + SAMPLE_INPUTS.cooldownMeters) * SAMPLE_INPUTS.easyPaceSecPerMeter;
    const repSeconds = SAMPLE_INPUTS.reps * 2000 * SAMPLE_INPUTS.referencePaceSecPerMeter;
    const recoverySeconds = SAMPLE_INPUTS.reps * 1000 * SAMPLE_INPUTS.easyPaceSecPerMeter;
    expect(plan.totalDurationSeconds).toBeCloseTo(warmupCooldownSeconds + repSeconds + recoverySeconds, 6);
  });

  it("total distance/time equal the sum of the individual step fields (no hidden double-counting)", () => {
    const plan = buildWorkoutPlan(SAMPLE_INPUTS);
    const summedDistance = plan.steps.reduce((sum, s) => sum + s.distanceMeters, 0);
    const summedDuration = plan.steps.reduce((sum, s) => sum + s.durationSeconds, 0);
    expect(plan.totalDistanceMeters).toBeCloseTo(summedDistance, 9);
    expect(plan.totalDurationSeconds).toBeCloseTo(summedDuration, 9);
  });

  it("scales total distance/time with rep count", () => {
    const fourReps = buildWorkoutPlan({ ...SAMPLE_INPUTS, reps: 4 });
    const eightReps = buildWorkoutPlan({ ...SAMPLE_INPUTS, reps: 8 });
    expect(eightReps.totalDistanceMeters).toBeGreaterThan(fourReps.totalDistanceMeters);
    expect(eightReps.totalDurationSeconds).toBeGreaterThan(fourReps.totalDurationSeconds);
  });
});

describe("paceRangeForDisplay / formatPaceRange -- the ±5 sec Garmin-style range", () => {
  it("widens the pace by exactly the half-width on each side, fast end first", () => {
    const paceSecPerMeter = (6 * 60 + 12) / MILE_METERS;
    const [fast, slow] = paceRangeForDisplay(paceSecPerMeter, "mi");
    const paceAtMile = paceSecPerMeter * MILE_METERS;
    expect(fast).toBeCloseTo(paceAtMile - TARGET_PACE_HALF_WIDTH_SECONDS, 6);
    expect(slow).toBeCloseTo(paceAtMile + TARGET_PACE_HALF_WIDTH_SECONDS, 6);
    expect(fast).toBeLessThan(slow);
  });

  it("respects a custom half-width", () => {
    const paceSecPerMeter = (6 * 60) / MILE_METERS;
    const [fast, slow] = paceRangeForDisplay(paceSecPerMeter, "mi", 10);
    expect(slow - fast).toBeCloseTo(20, 6);
  });

  it("formats as 'fast–slow/unit', matching the site's existing pace-range convention", () => {
    const paceSecPerMeter = (6 * 60 + 12) / MILE_METERS;
    expect(formatPaceRange(paceSecPerMeter, "mi")).toBe("6:07–6:17/mi");
  });

  it("produces a different, correctly-converted range in km", () => {
    const paceSecPerMeter = (6 * 60 + 12) / MILE_METERS;
    const miRange = formatPaceRange(paceSecPerMeter, "mi");
    const kmRange = formatPaceRange(paceSecPerMeter, "km");
    expect(kmRange).not.toBe(miRange);
    expect(kmRange.endsWith("/km")).toBe(true);
  });
});

describe("formatMetersAuto / formatDistanceInUnit", () => {
  it("formats sub-km distances in meters", () => {
    expect(formatMetersAuto(400)).toBe("400m");
    expect(formatMetersAuto(200)).toBe("200m");
  });

  it("formats 1000m and above in kilometers", () => {
    expect(formatMetersAuto(1000)).toBe("1 km");
    expect(formatMetersAuto(2000)).toBe("2 km");
  });

  it("formats a warmup/cooldown distance in the chosen unit", () => {
    expect(formatDistanceInUnit(1.5 * MILE_METERS, "mi")).toBe("1.5 mi");
  });
});

describe("buildGarminProgram -- the watch-programming summary", () => {
  it("produces exactly 3 top-level steps regardless of rep count", () => {
    const plan = buildWorkoutPlan(SAMPLE_INPUTS);
    const lines = buildGarminProgram(plan, SAMPLE_INPUTS, "mi");
    expect(lines).toHaveLength(3);
    expect(lines[0].startsWith("Step 1:")).toBe(true);
    expect(lines[1].startsWith("Step 2:")).toBe(true);
    expect(lines[2].startsWith("Step 3:")).toBe(true);
  });

  it("step 1 is the warmup distance with no target", () => {
    const plan = buildWorkoutPlan(SAMPLE_INPUTS);
    const lines = buildGarminProgram(plan, SAMPLE_INPUTS, "mi");
    expect(lines[0]).toBe("Step 1: Run 1.5 mi, no target.");
  });

  it("step 2 condenses the repeat block with the exact rep count, interval, pace range, and recovery", () => {
    const plan = buildWorkoutPlan(SAMPLE_INPUTS);
    const lines = buildGarminProgram(plan, SAMPLE_INPUTS, "mi");
    expect(lines[1]).toBe("Step 2: Repeat 8× — Run 2 km @ 6:07–6:17/mi, then Jog 1 km, no target.");
  });

  it("step 3 is the cooldown distance with no target", () => {
    const plan = buildWorkoutPlan(SAMPLE_INPUTS);
    const lines = buildGarminProgram(plan, SAMPLE_INPUTS, "mi");
    expect(lines[2]).toBe("Step 3: Run 1.5 mi, no target.");
  });

  it("describes a time-based main set and recovery as durations, not distances", () => {
    const inputs: WorkoutInputs = {
      ...SAMPLE_INPUTS,
      mainSetMode: "time",
      mainSetDurationSeconds: 3 * 60,
      recoveryMode: "time",
      recoveryDurationSeconds: 90,
    };
    const plan = buildWorkoutPlan(inputs);
    const lines = buildGarminProgram(plan, inputs, "mi");
    expect(lines[1]).toContain(`Run for ${formatClock(3 * 60)}`);
    expect(lines[1]).toContain(`Jog for ${formatClock(90)}`);
  });

  it("uses 'Rest for ...' (never a distance) for a stand recovery", () => {
    const inputs: WorkoutInputs = { ...SAMPLE_INPUTS, recoveryMode: "time", recoveryDurationSeconds: 60, recoveryType: "stand" };
    const plan = buildWorkoutPlan(inputs);
    const lines = buildGarminProgram(plan, inputs, "mi");
    expect(lines[1]).toContain("Rest for 1:00");
  });

  it("uses the walk verb for a walk recovery", () => {
    const inputs: WorkoutInputs = { ...SAMPLE_INPUTS, recoveryType: "walk" };
    const plan = buildWorkoutPlan(inputs);
    const lines = buildGarminProgram(plan, inputs, "mi");
    expect(lines[1]).toContain("Walk 1 km");
  });
});
