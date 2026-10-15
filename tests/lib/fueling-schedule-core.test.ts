import { describe, expect, it } from "vitest";

import {
  buildGelTimingSchedule,
  caffeineTiming,
  CAFFEINE_SECOND_DOSE_AT_MINUTES,
  mouthRinseRecommended,
  PRE_RACE_GEL_MINUTES_BEFORE_START,
} from "@/lib/fueling-schedule-core";

describe("buildGelTimingSchedule", () => {
  it("schedules a gel every N minutes derived from rate and gel size", () => {
    const gels = buildGelTimingSchedule({ totalMinutes: 210, carbGramsPerHour: 60, gelCarbGrams: 25 });
    expect(gels.length).toBeGreaterThan(0);
    expect(gels[0].atMinute).toBeCloseTo(25, 0);
    for (let i = 1; i < gels.length; i += 1) {
      expect(gels[i].atMinute).toBeGreaterThan(gels[i - 1].atMinute);
    }
  });

  it("schedules more frequent gels at a higher carb rate", () => {
    const low = buildGelTimingSchedule({ totalMinutes: 210, carbGramsPerHour: 40, gelCarbGrams: 25 });
    const high = buildGelTimingSchedule({ totalMinutes: 210, carbGramsPerHour: 90, gelCarbGrams: 25 });
    expect(high.length).toBeGreaterThan(low.length);
  });

  it("never schedules a non-optional gel inside the final-gel cutoff before the finish", () => {
    const totalMinutes = 210;
    const gels = buildGelTimingSchedule({ totalMinutes, carbGramsPerHour: 60, gelCarbGrams: 25 });
    for (const gel of gels.filter((g) => !g.optional)) {
      expect(totalMinutes - gel.atMinute).toBeGreaterThanOrEqual(35);
    }
  });

  it("returns an empty schedule for a zero or negative carb rate", () => {
    expect(buildGelTimingSchedule({ totalMinutes: 210, carbGramsPerHour: 0, gelCarbGrams: 25 })).toEqual([]);
  });
});

describe("mouthRinseRecommended", () => {
  it("is true for a marathon-length effort", () => {
    expect(mouthRinseRecommended(210)).toBe(true);
  });

  it("is false for a very short effort", () => {
    expect(mouthRinseRecommended(10)).toBe(false);
  });
});

describe("caffeineTiming", () => {
  it("returns a second-dose timing with no dose in the final hour", () => {
    const timing = caffeineTiming(210);
    expect(timing).not.toBeNull();
    expect(timing!.secondDoseAtMinute).toBe(CAFFEINE_SECOND_DOSE_AT_MINUTES);
    expect(210 - timing!.secondDoseAtMinute).toBeGreaterThanOrEqual(60);
  });

  it("returns null when the effort is too short for the protocol to make sense", () => {
    expect(caffeineTiming(50)).toBeNull();
  });
});

describe("PRE_RACE_GEL_MINUTES_BEFORE_START", () => {
  it("falls within the commonly-recommended 30-45 minute window", () => {
    expect(PRE_RACE_GEL_MINUTES_BEFORE_START).toBeGreaterThanOrEqual(30);
    expect(PRE_RACE_GEL_MINUTES_BEFORE_START).toBeLessThanOrEqual(45);
  });
});
