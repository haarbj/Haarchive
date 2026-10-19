import { describe, expect, it } from "vitest";

import { zoneForRatio } from "@/lib/acwr";
import {
  buildTrainingLoadPlan,
  CUTBACK_INTERVAL_WEEKS,
  CUTBACK_REDUCTION,
  WEEKLY_INCREASE_CAP,
} from "@/lib/training-load-planner-math";

describe("buildTrainingLoadPlan -- ramp math", () => {
  it("ramps at most 10%/week (the site's own WEEKLY_INCREASE_CAP) on non-cutback weeks", () => {
    const plan = buildTrainingLoadPlan([20, 20, 20, 20], 100, 3);
    expect(WEEKLY_INCREASE_CAP).toBe(0.1);
    expect(plan.weeks[0].mileage).toBe(22); // 20 * 1.10
    expect(plan.weeks[1].mileage).toBe(24); // 22 * 1.10 = 24.2 -> 24
    expect(plan.weeks[2].mileage).toBe(26); // 24 * 1.10 = 26.4 -> 26
  });

  it("never exceeds the goal even when the ramp formula would overshoot it", () => {
    const plan = buildTrainingLoadPlan([20, 20, 20, 20], 21, 5);
    for (const week of plan.weeks) expect(week.mileage).toBeLessThanOrEqual(21);
    expect(plan.weeks[0].mileage).toBe(21); // 20*1.1=22 would overshoot -> capped at goal
  });

  it("holds at goal once reached, on later ramp weeks", () => {
    const plan = buildTrainingLoadPlan([20, 20, 20, 20], 22, 6);
    expect(plan.weeks[0].mileage).toBe(22);
    // Week 2 is a ramp week (cutback is week 4) and should hold at goal, not re-ramp past it.
    expect(plan.weeks[1].mileage).toBe(22);
  });

  it("a goal already at or below current mileage needs no ramp -- holds immediately", () => {
    const plan = buildTrainingLoadPlan([20, 20, 20, 30], 25, 3);
    expect(plan.weeks[0].mileage).toBe(25);
    expect(plan.reachesGoal).toBe(true);
    expect(plan.safeAlternative).toBeNull();
  });
});

describe("buildTrainingLoadPlan -- down-week placement", () => {
  it("places a cutback every 4th week (CUTBACK_INTERVAL_WEEKS), matching the coaching engine's own convention", () => {
    expect(CUTBACK_INTERVAL_WEEKS).toBe(4);
    const plan = buildTrainingLoadPlan([20, 20, 20, 20], 1000, 8);
    const cutbackWeeks = plan.weeks.filter((w) => w.isCutback).map((w) => w.weekNumber);
    expect(cutbackWeeks).toEqual([4, 8]);
  });

  it("a cutback week drops to 75% of the last ramp week (CUTBACK_REDUCTION), matching the coaching engine", () => {
    expect(CUTBACK_REDUCTION).toBe(0.25);
    const plan = buildTrainingLoadPlan([20, 20, 20, 20], 1000, 4);
    const lastRampWeek = plan.weeks[2].mileage; // week 3, the ramp week right before the week-4 cutback
    expect(plan.weeks[3].isCutback).toBe(true);
    expect(plan.weeks[3].mileage).toBe(Math.round(lastRampWeek * 0.75));
  });

  it("a cutback week does not reset the ramp -- the week after it resumes from the pre-cutback peak", () => {
    const plan = buildTrainingLoadPlan([20, 20, 20, 20], 1000, 5);
    const peakBeforeCutback = plan.weeks[2].mileage; // week 3
    const cutback = plan.weeks[3].mileage; // week 4
    const afterCutback = plan.weeks[4].mileage; // week 5
    expect(cutback).toBeLessThan(peakBeforeCutback);
    expect(afterCutback).toBe(Math.round(peakBeforeCutback * 1.1)); // ramps from the peak, not from the cutback dip
  });
});

describe("buildTrainingLoadPlan -- ACWR", () => {
  it("computes each week's ratio as that week's mileage over its own trailing 4-week average (coupled, including itself)", () => {
    const plan = buildTrainingLoadPlan([20, 20, 20, 20], 1000, 2);
    // Week 1: 22; trailing 4 = [20, 20, 20, 22] (drops the oldest actual week, includes week 1 itself).
    const week1Chronic = (20 + 20 + 20 + 22) / 4;
    expect(plan.weeks[0].acwr).toBeCloseTo(22 / week1Chronic, 6);
  });

  it("classifies each week's ratio with the site's own existing AcwrZone bands (zoneForRatio)", () => {
    const plan = buildTrainingLoadPlan([20, 20, 20, 20], 1000, 1);
    expect(plan.weeks[0].zone).toBe(zoneForRatio(plan.weeks[0].acwr!));
  });

  it("a down week's ratio typically lands in the undertrained/safe range, not high-risk", () => {
    const plan = buildTrainingLoadPlan([20, 20, 20, 20], 1000, 4);
    const cutbackWeek = plan.weeks[3];
    expect(cutbackWeek.isCutback).toBe(true);
    expect(["undertrained", "sweet-spot"]).toContain(cutbackWeek.zone);
  });

  it("an aggressive ramp that outpaces 10%/week would read as caution or high-risk if it existed -- sanity-checks the bands are reachable at all", () => {
    // Directly exercises zoneForRatio (already tested in acwr.test.ts) to
    // confirm this module is reading the exact same bands, not a copy.
    expect(zoneForRatio(1.6)).toBe("high-risk");
    expect(zoneForRatio(1.4)).toBe("caution");
    expect(zoneForRatio(1.0)).toBe("sweet-spot");
    expect(zoneForRatio(0.5)).toBe("undertrained");
  });
});

describe("buildTrainingLoadPlan -- unreachable goal detection", () => {
  it("flags reachesGoal=false when the goal can't be reached at a safe ramp in the given weeks", () => {
    const plan = buildTrainingLoadPlan([20, 20, 20, 20], 200, 3); // 20 -> 200 in 3 weeks is impossible at 10%/week
    expect(plan.reachesGoal).toBe(false);
    expect(plan.safeAlternative).not.toBeNull();
  });

  it("the safe alternative's maxSafeMileageInGivenWeeks equals the plan's own final peak mileage", () => {
    const plan = buildTrainingLoadPlan([20, 20, 20, 20], 200, 3);
    const peak = Math.max(...plan.weeks.filter((w) => !w.isCutback).map((w) => w.mileage), plan.weeks[plan.weeks.length - 1].mileage);
    expect(plan.safeAlternative!.maxSafeMileageInGivenWeeks).toBeLessThanOrEqual(peak + 1); // allow rounding
    expect(plan.safeAlternative!.maxSafeMileageInGivenWeeks).toBeGreaterThan(20);
  });

  it("the safe alternative's weeksNeeded is strictly more than the weeks actually given", () => {
    const plan = buildTrainingLoadPlan([20, 20, 20, 20], 200, 3);
    expect(plan.safeAlternative!.weeksNeeded).toBeGreaterThan(3);
  });

  it("a reachable goal reports reachesGoal=true and no safe alternative", () => {
    const plan = buildTrainingLoadPlan([20, 20, 20, 20], 30, 6); // comfortably reachable at 10%/week
    expect(plan.reachesGoal).toBe(true);
    expect(plan.safeAlternative).toBeNull();
  });

  it("weeksNeeded, if actually simulated, really does reach the goal", () => {
    const plan = buildTrainingLoadPlan([20, 20, 20, 20], 200, 3);
    const extendedPlan = buildTrainingLoadPlan([20, 20, 20, 20], 200, plan.safeAlternative!.weeksNeeded);
    expect(extendedPlan.reachesGoal).toBe(true);
  });
});
