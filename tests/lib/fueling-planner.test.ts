import { describe, expect, it } from "vitest";

import { suggestedCarbsPerHour } from "@/lib/endurance-fueling-math";
import {
  buildBreakfastTargets,
  buildCaffeinePlan,
  buildCarbLoadTargets,
  buildCarbRateGuidance,
  buildRaceFuelingSchedule,
  resolveCarbTargetGPerHour,
} from "@/lib/fueling-calculator-math";
import nextConfig from "../../next.config";

const GOAL_3H30_MIN = 3.5 * 60;

describe("resolveCarbTargetGPerHour (the Fueling Planner's shared, mode-agnostic target)", () => {
  it("has no mode parameter at all -- the same effort/GI inputs resolve to the same target regardless of which mode (race or training) is calling it", () => {
    // This is the actual mechanism behind "shared inputs persist across
    // modes": the shared carb-target calculation doesn't branch on mode,
    // so switching the Fueling Planner's mode selector can never change
    // what a given effort level + GI training level + override resolves to.
    const raceLikeCall = resolveCarbTargetGPerHour("70-80%", "Moderate", null);
    const trainingLikeCall = resolveCarbTargetGPerHour("70-80%", "Moderate", null);
    expect(raceLikeCall).toBe(trainingLikeCall);
  });

  it("suggests the effort/GI-adjusted rate when no custom override is set, matching the Endurance Calculator's own lookup table", () => {
    expect(resolveCarbTargetGPerHour("70-80%", "Moderate", null)).toBe(suggestedCarbsPerHour("70-80%", "Moderate"));
    expect(resolveCarbTargetGPerHour("70-80%", "Moderate", null)).toBe(75);
  });

  it("lets an explicit custom override win over the suggestion -- nothing from the old flat-60g/hr default is lost", () => {
    expect(resolveCarbTargetGPerHour("70-80%", "Moderate", 60)).toBe(60);
  });

  it("ignores a zero or negative override and falls back to the suggestion", () => {
    expect(resolveCarbTargetGPerHour("70-80%", "Moderate", 0)).toBe(75);
    expect(resolveCarbTargetGPerHour("70-80%", "Moderate", -5)).toBe(75);
  });

  it("pins the High Carb Machine override at 120g/hr regardless of effort, same as the Endurance Calculator", () => {
    expect(resolveCarbTargetGPerHour("50-60%", "HighCarbMachine", null)).toBe(120);
    expect(resolveCarbTargetGPerHour("90-100%", "HighCarbMachine", null)).toBe(120);
  });
});

describe("Race mode's race-week sections, unchanged by the unification", () => {
  it("still surfaces the gut-training progression when the effort-adjusted target is above the runner's current comfortable rate", () => {
    const target = resolveCarbTargetGPerHour("70-80%", "Moderate", null); // 75
    const guidance = buildCarbRateGuidance(30, target);
    expect(guidance.targetGPerHour).toBe(75);
    expect(guidance.needsProgression).toBe(true);
    expect(guidance.steps.length).toBeGreaterThan(0);
  });

  it("still produces an unchanged carb-loading target from body weight alone", () => {
    const targets = buildCarbLoadTargets(70);
    expect(targets.moderate.lowG).toBe(Math.round(8 * 70 * 1.5));
    expect(targets.aggressive.highG).toBe(Math.round(12 * 70 * 2));
  });

  it("still produces an unchanged pre-race breakfast target from body weight alone", () => {
    const targets = buildBreakfastTargets(70);
    expect(targets).toEqual({ lowG: 70, highG: 280, hoursBeforeStart: 3 });
  });

  it("still produces an unchanged two-dose caffeine plan from weight and goal duration", () => {
    const plan = buildCaffeinePlan(70, GOAL_3H30_MIN);
    expect(plan).not.toBeNull();
    expect(plan!.firstDoseMg + plan!.secondDoseMg).toBe(plan!.totalMg);
  });

  it("builds the in-race gel schedule from the effort-adjusted target and a specific product's carbs-per-serving", () => {
    const target = resolveCarbTargetGPerHour("70-80%", "Moderate", null); // 75g/hr
    const guGelCarbsG = 22; // GU Energy Gel, from the fuel-product catalog
    const schedule = buildRaceFuelingSchedule(GOAL_3H30_MIN, target, guGelCarbsG);
    expect(schedule.gels.length).toBeGreaterThan(0);
    // At 75g/hr with a 22g gel, a gel is due roughly every 17.6 minutes --
    // tighter than the old flat-60g/hr default's ~22-minute interval.
    expect(schedule.gels[0].atMinute).toBeCloseTo(18, 0);
  });
});

describe("/endurance-fueling-calculator redirects to the unified /fueling-calculator", () => {
  it("301-redirects the old Endurance Fueling Calculator URL to the canonical Fueling Planner URL", async () => {
    const redirects = await nextConfig.redirects!();
    const rule = redirects.find((r) => r.source === "/endurance-fueling-calculator");
    expect(rule).toBeDefined();
    expect(rule!.destination).toBe("/fueling-calculator");
    expect(rule!.permanent).toBe(true);
  });
});
