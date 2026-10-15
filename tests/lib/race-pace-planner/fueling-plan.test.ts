import { describe, expect, it } from "vitest";

import { buildRacePacePlan, FLAT_COURSE } from "@/lib/race-pace-planner/pace-plan";
import { buildFuelingSchedule } from "@/lib/race-pace-planner/fueling-plan";

const GOAL_3H30 = 3.5 * 3600;

describe("buildFuelingSchedule", () => {
  const plan = buildRacePacePlan(GOAL_3H30, "even", FLAT_COURSE);

  it("recommends a pre-race gel 30-45 minutes before the start", () => {
    const schedule = buildFuelingSchedule(plan, { carbGramsPerHour: 60, gelCarbGrams: 25, caffeineEnabled: false });
    expect(schedule.preRaceGel.minutesBeforeStart).toBeGreaterThanOrEqual(30);
    expect(schedule.preRaceGel.minutesBeforeStart).toBeLessThanOrEqual(45);
  });

  it("schedules gels at a cadence derived from carb rate and gel size", () => {
    const schedule = buildFuelingSchedule(plan, { carbGramsPerHour: 60, gelCarbGrams: 25, caffeineEnabled: false });
    expect(schedule.gels.length).toBeGreaterThan(0);
    // 25g gel at 60g/hr => a gel every 25 minutes.
    expect(schedule.gels[0].atMinute).toBeCloseTo(25, 0);
    for (let i = 1; i < schedule.gels.length; i += 1) {
      expect(schedule.gels[i].atMinute).toBeGreaterThan(schedule.gels[i - 1].atMinute);
    }
  });

  it("schedules gels more frequently at a higher carb rate", () => {
    const low = buildFuelingSchedule(plan, { carbGramsPerHour: 40, gelCarbGrams: 25, caffeineEnabled: false });
    const high = buildFuelingSchedule(plan, { carbGramsPerHour: 90, gelCarbGrams: 25, caffeineEnabled: false });
    expect(high.gels.length).toBeGreaterThan(low.gels.length);
  });

  it("never schedules a non-optional gel inside the final-gel cutoff before the finish", () => {
    const schedule = buildFuelingSchedule(plan, { carbGramsPerHour: 60, gelCarbGrams: 25, caffeineEnabled: false });
    const totalMinutes = plan.totalElapsedSeconds / 60;
    const requiredGels = schedule.gels.filter((g) => !g.optional);
    for (const gel of requiredGels) {
      expect(totalMinutes - gel.atMinute).toBeGreaterThanOrEqual(35);
    }
  });

  it("suggests a mouth rinse instead of a final gel for a marathon-length race", () => {
    const schedule = buildFuelingSchedule(plan, { carbGramsPerHour: 60, gelCarbGrams: 25, caffeineEnabled: false });
    expect(schedule.mouthRinseInsteadOfFinalGel).toBe(true);
  });

  it("builds a two-dose caffeine protocol when enabled, with no dose within the final hour", () => {
    const schedule = buildFuelingSchedule(plan, { carbGramsPerHour: 60, gelCarbGrams: 25, caffeineEnabled: true });
    expect(schedule.caffeine).not.toBeNull();
    expect(schedule.caffeine!.firstDoseMg).toBe(100);
    expect(schedule.caffeine!.secondDoseMg).toBe(100);
    const totalMinutes = plan.totalElapsedSeconds / 60;
    expect(totalMinutes - schedule.caffeine!.secondDoseAtMinute).toBeGreaterThanOrEqual(60);
  });

  it("omits caffeine entirely when not enabled", () => {
    const schedule = buildFuelingSchedule(plan, { carbGramsPerHour: 60, gelCarbGrams: 25, caffeineEnabled: false });
    expect(schedule.caffeine).toBeNull();
  });
});
