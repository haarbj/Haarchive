import { describe, expect, it } from "vitest";

import { computeWeeklyLoad, formatWeeklyLoadText, type WeeklyLoadEntry } from "@/lib/private-coaching/weekly-load";
import { MILE_METERS } from "@/lib/race-distances";

const EASY_PACE_S_PER_MI = 480; // 8:00/mi

function entry(overrides: Partial<WeeklyLoadEntry> = {}): WeeklyLoadEntry {
  return {
    dayLabel: null,
    publishedAt: "2026-08-01T00:00:00Z",
    distanceM: null,
    durationS: null,
    actualDistanceM: null,
    actualDurationS: null,
    ...overrides,
  };
}

describe("computeWeeklyLoad", () => {
  it("sums real distances the same way the pre-reconciliation footer did", () => {
    const result = computeWeeklyLoad(
      [entry({ dayLabel: "Easy", distanceM: 6 * MILE_METERS }), entry({ dayLabel: "Long Run", distanceM: 12 * MILE_METERS })],
      null,
    );
    expect(result.scheduledMileageM).toBe(Math.round(18 * MILE_METERS));
    expect(result.estimatedCount).toBe(0);
  });

  it("estimates a duration-only non-XT day into mileage via the athlete's easy pace", () => {
    const result = computeWeeklyLoad([entry({ dayLabel: "Easy", durationS: 3600 })], EASY_PACE_S_PER_MI);
    // 60 minutes at 8:00/mi -> 7.5 miles
    expect(result.scheduledMileageM).toBe(Math.round(7.5 * MILE_METERS));
    expect(result.estimatedCount).toBe(1);
  });

  it("never estimates a duration-only day when no race is on file", () => {
    const result = computeWeeklyLoad([entry({ dayLabel: "Easy", durationS: 3600 })], null);
    expect(result.scheduledMileageM).toBe(0);
    expect(result.estimatedCount).toBe(0);
  });

  it("keeps an XT day's duration separate from mileage regardless of pace availability", () => {
    const result = computeWeeklyLoad(
      [entry({ dayLabel: "Cross Training (Bike)", durationS: 3600 }), entry({ dayLabel: "XT", durationS: 1800 })],
      EASY_PACE_S_PER_MI,
    );
    expect(result.scheduledMileageM).toBe(0);
    expect(result.scheduledXtDurationS).toBe(5400);
    expect(result.estimatedCount).toBe(0);
  });

  it("combines real distance, estimated duration, and XT in one week", () => {
    const result = computeWeeklyLoad(
      [
        entry({ dayLabel: "Long Run", distanceM: 10 * MILE_METERS }),
        entry({ dayLabel: "Easy", durationS: 2400 }), // 40 min @ 8:00/mi = 5mi
        entry({ dayLabel: "XT", durationS: 3600 }),
      ],
      EASY_PACE_S_PER_MI,
    );
    expect(result.scheduledMileageM).toBe(Math.round(15 * MILE_METERS));
    expect(result.scheduledXtDurationS).toBe(3600);
    expect(result.estimatedCount).toBe(1);
  });

  it("ignores unpublished (draft) workouts on the scheduled side", () => {
    const result = computeWeeklyLoad([entry({ dayLabel: "Easy", distanceM: 6 * MILE_METERS, publishedAt: null })], null);
    expect(result.scheduledMileageM).toBe(0);
  });

  it("computes completed totals independently of published state", () => {
    const result = computeWeeklyLoad(
      [entry({ dayLabel: "Easy", publishedAt: null, actualDistanceM: 4 * MILE_METERS })],
      null,
    );
    expect(result.scheduledMileageM).toBe(0);
    expect(result.completedMileageM).toBe(Math.round(4 * MILE_METERS));
  });

  it("estimates completed duration-only mileage the same way as scheduled", () => {
    const result = computeWeeklyLoad([entry({ dayLabel: "Easy", actualDurationS: 2400 })], EASY_PACE_S_PER_MI);
    expect(result.completedMileageM).toBe(Math.round(5 * MILE_METERS));
  });

  it("keeps completed XT duration separate from completed mileage", () => {
    const result = computeWeeklyLoad([entry({ dayLabel: "XT", actualDurationS: 1800, actualDistanceM: null })], EASY_PACE_S_PER_MI);
    expect(result.completedMileageM).toBe(0);
    expect(result.completedXtDurationS).toBe(1800);
  });
});

describe("formatWeeklyLoadText", () => {
  it("shows the literal 'X miles + Ymin XT' shape", () => {
    const result = { scheduledMileageM: Math.round(40 * MILE_METERS), scheduledXtDurationS: 3600, completedMileageM: 0, completedXtDurationS: 0, estimatedCount: 0 };
    const { scheduledText } = formatWeeklyLoadText(result, "miles", null);
    expect(scheduledText).toBe("40.0 mi + 60min XT");
  });

  it("omits the XT segment entirely when there's no XT duration", () => {
    const result = { scheduledMileageM: Math.round(20 * MILE_METERS), scheduledXtDurationS: 0, completedMileageM: 0, completedXtDurationS: 0, estimatedCount: 0 };
    const { scheduledText } = formatWeeklyLoadText(result, "miles", null);
    expect(scheduledText).toBe("20.0 mi");
  });

  it("shows the primary figure in minutes when the coach prefers minutes, converted via easy pace", () => {
    const result = { scheduledMileageM: Math.round(20 * MILE_METERS), scheduledXtDurationS: 0, completedMileageM: 0, completedXtDurationS: 0, estimatedCount: 0 };
    const { scheduledText } = formatWeeklyLoadText(result, "minutes", EASY_PACE_S_PER_MI);
    // 20 miles @ 8:00/mi = 160 minutes
    expect(scheduledText).toBe("160 min");
  });

  it("falls back to miles when minutes is preferred but no easy pace is available", () => {
    const result = { scheduledMileageM: Math.round(20 * MILE_METERS), scheduledXtDurationS: 0, completedMileageM: 0, completedXtDurationS: 0, estimatedCount: 0 };
    const { scheduledText } = formatWeeklyLoadText(result, "minutes", null);
    expect(scheduledText).toBe("20.0 mi");
  });

  it("computes scheduled and completed text independently", () => {
    const result = { scheduledMileageM: Math.round(40 * MILE_METERS), scheduledXtDurationS: 0, completedMileageM: Math.round(10 * MILE_METERS), completedXtDurationS: 1800, estimatedCount: 0 };
    const { scheduledText, completedText } = formatWeeklyLoadText(result, "miles", null);
    expect(scheduledText).toBe("40.0 mi");
    expect(completedText).toBe("10.0 mi + 30min XT");
  });
});
