import { describe, expect, it } from "vitest";

import { TRAINING_PLANS, trainingPlanMap, plansForTrack } from "@/lib/training-plans/data";

describe("TRAINING_PLANS", () => {
  it("has all 5 tracks x 2 durations = 10 plans", () => {
    expect(TRAINING_PLANS).toHaveLength(10);
  });

  it("every plan's workouts array is a whole number of weeks", () => {
    for (const plan of TRAINING_PLANS) {
      expect(plan.workouts.length).toBe(plan.durationWeeks * 7);
    }
  });

  it("matches the verified reference mileage for breeze-12 (spot-checked directly against the source data)", () => {
    const plan = trainingPlanMap.get("breeze-12")!;
    expect(plan.referencePeakWeeklyMiles).toBeCloseTo(47.2, 1);
    expect(plan.referenceAvgWeeklyMiles).toBeCloseTo(38.5, 1);
    expect(plan.referenceTotalMiles).toBeCloseTo(462.2, 1);
  });

  it("matches the verified reference mileage for hurricane-18 (the highest-volume plan)", () => {
    const plan = trainingPlanMap.get("hurricane-18")!;
    expect(plan.referencePeakWeeklyMiles).toBeCloseTo(100, 1);
    expect(plan.referenceAvgWeeklyMiles).toBeCloseTo(86.3, 1);
  });

  it("the five tracks are ordered lowest to highest average weekly mileage, at a fixed duration", () => {
    const eighteenWeekPlans = TRAINING_PLANS.filter((p) => p.durationWeeks === 18);
    const avgMileages = eighteenWeekPlans.map((p) => p.referenceAvgWeeklyMiles);
    const sorted = [...avgMileages].sort((a, b) => a - b);
    expect(avgMileages).toEqual(sorted);
  });

  it("plansForTrack returns exactly the 12- and 18-week plan for that track", () => {
    const galePlans = plansForTrack("gale");
    expect(galePlans).toHaveLength(2);
    expect(galePlans.map((p) => p.durationWeeks).sort()).toEqual([12, 18]);
  });
});
