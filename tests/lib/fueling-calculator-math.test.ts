import { describe, expect, it } from "vitest";

import {
  buildBreakfastTargets,
  buildCaffeinePlan,
  buildCarbLoadTargets,
  buildCarbRateGuidance,
  buildRaceFuelingSchedule,
  DEFAULT_TARGET_CARB_G_PER_HOUR,
} from "@/lib/fueling-calculator-math";

const LB_150_IN_KG = 150 / 2.20462;
const GOAL_3H30_MIN = 3.5 * 60;

describe("buildCarbRateGuidance", () => {
  it("defaults to a >=60 g/hr target with no progression when no current rate is given", () => {
    const guidance = buildCarbRateGuidance(null, DEFAULT_TARGET_CARB_G_PER_HOUR);
    expect(guidance.targetGPerHour).toBeGreaterThanOrEqual(60);
    expect(guidance.needsProgression).toBe(false);
    expect(guidance.steps).toEqual([]);
  });

  it("surfaces the 5-step progression when the current rate is below target", () => {
    const guidance = buildCarbRateGuidance(30, DEFAULT_TARGET_CARB_G_PER_HOUR);
    expect(guidance.needsProgression).toBe(true);
    expect(guidance.steps.length).toBeGreaterThan(0);
    expect(guidance.steps[0].lowGPerHour).toBeLessThan(guidance.steps[guidance.steps.length - 1].lowGPerHour);
  });

  it("does not surface the progression when the current rate already meets target", () => {
    const guidance = buildCarbRateGuidance(65, DEFAULT_TARGET_CARB_G_PER_HOUR);
    expect(guidance.needsProgression).toBe(false);
  });
});

describe("buildCarbLoadTargets", () => {
  it("produces a moderate and an aggressive gram target that scale with body weight", () => {
    const light = buildCarbLoadTargets(55);
    const heavy = buildCarbLoadTargets(90);
    expect(heavy.moderate.lowG).toBeGreaterThan(light.moderate.lowG);
    expect(heavy.aggressive.lowG).toBeGreaterThan(light.aggressive.lowG);
  });

  it("gives the aggressive protocol a higher gram total than moderate at the same weight", () => {
    const targets = buildCarbLoadTargets(70);
    expect(targets.aggressive.lowG).toBeGreaterThan(targets.moderate.lowG);
    expect(targets.aggressive.days).toBeGreaterThan(targets.moderate.days);
  });

  it("matches the 150lb acceptance example's order of magnitude", () => {
    const targets = buildCarbLoadTargets(LB_150_IN_KG);
    // 8-10 g/kg/day x 1.5 days at ~68kg -> roughly 816-1020g.
    expect(targets.moderate.lowG).toBeGreaterThan(700);
    expect(targets.moderate.highG).toBeLessThan(1100);
  });
});

describe("buildBreakfastTargets", () => {
  it("returns a 1-4 g/kg range within 3 hours of the start", () => {
    const targets = buildBreakfastTargets(70);
    expect(targets.lowG).toBe(70);
    expect(targets.highG).toBe(280);
    expect(targets.hoursBeforeStart).toBe(3);
  });

  it("scales with body weight", () => {
    const light = buildBreakfastTargets(55);
    const heavy = buildBreakfastTargets(90);
    expect(heavy.lowG).toBeGreaterThan(light.lowG);
  });
});

describe("buildRaceFuelingSchedule", () => {
  it("schedules a gel every ~25 minutes for a 25g gel at the default 60 g/hr target", () => {
    const schedule = buildRaceFuelingSchedule(GOAL_3H30_MIN, DEFAULT_TARGET_CARB_G_PER_HOUR, 25);
    expect(schedule.gels.length).toBeGreaterThan(0);
    expect(schedule.gels[0].atMinute).toBeCloseTo(25, 0);
  });

  it("recommends a pre-race gel in the 30-45 minute window", () => {
    const schedule = buildRaceFuelingSchedule(GOAL_3H30_MIN, DEFAULT_TARGET_CARB_G_PER_HOUR, 25);
    expect(schedule.preRaceGel.minutesBeforeStart).toBeGreaterThanOrEqual(30);
    expect(schedule.preRaceGel.minutesBeforeStart).toBeLessThanOrEqual(45);
  });

  it("recommends a mouth rinse for a marathon-length goal duration", () => {
    const schedule = buildRaceFuelingSchedule(GOAL_3H30_MIN, DEFAULT_TARGET_CARB_G_PER_HOUR, 25);
    expect(schedule.mouthRinseInsteadOfFinalGel).toBe(true);
  });
});

describe("buildCaffeinePlan", () => {
  it("produces roughly a 200mg caffeine plan for a 150lb runner", () => {
    const plan = buildCaffeinePlan(LB_150_IN_KG, GOAL_3H30_MIN);
    expect(plan).not.toBeNull();
    expect(plan!.totalMg).toBeGreaterThanOrEqual(175);
    expect(plan!.totalMg).toBeLessThanOrEqual(225);
  });

  it("splits the total into two doses that sum back to the total", () => {
    const plan = buildCaffeinePlan(LB_150_IN_KG, GOAL_3H30_MIN);
    expect(plan!.firstDoseMg + plan!.secondDoseMg).toBe(plan!.totalMg);
  });

  it("times the second dose with no dose in the final hour", () => {
    const plan = buildCaffeinePlan(LB_150_IN_KG, GOAL_3H30_MIN);
    expect(GOAL_3H30_MIN - plan!.secondDoseAtMinute).toBeGreaterThanOrEqual(60);
  });

  it("scales up for a heavier runner", () => {
    const light = buildCaffeinePlan(55, GOAL_3H30_MIN);
    const heavy = buildCaffeinePlan(95, GOAL_3H30_MIN);
    expect(heavy!.totalMg).toBeGreaterThan(light!.totalMg);
  });

  it("returns null for a duration too short for the protocol to make sense", () => {
    expect(buildCaffeinePlan(70, 50)).toBeNull();
  });
});
