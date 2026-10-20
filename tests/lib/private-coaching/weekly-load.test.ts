import { describe, expect, it } from "vitest";

import { computeWeeklyLoad, formatWeeklyLoadText, type WeeklyLoadEntry, type WeeklyLoadResult } from "@/lib/private-coaching/weekly-load";
import { MILE_METERS } from "@/lib/race-distances";

const EASY_PACE_S_PER_MI = 480; // 8:00/mi

// A fixed "today" every test uses unless it deliberately wants to exercise
// a missed/past-dated workout -- entries default to this exact date so
// none of them are "missed" by accident.
const TODAY = "2026-01-08";

function entry(overrides: Partial<WeeklyLoadEntry> = {}): WeeklyLoadEntry {
  return {
    dayLabel: null,
    distanceM: null,
    durationS: null,
    actualDistanceM: null,
    actualDurationS: null,
    scheduledDate: TODAY,
    ...overrides,
  };
}

function result(overrides: Partial<WeeklyLoadResult> = {}): WeeklyLoadResult {
  return {
    scheduledMileageM: 0,
    scheduledXtDurationS: 0,
    completedMileageM: 0,
    completedXtDurationS: 0,
    unscheduledMileageM: 0,
    unscheduledXtDurationS: 0,
    unscheduledDurationS: 0,
    estimatedCount: 0,
    scheduledDurationS: 0,
    completedDurationS: 0,
    remainingMileageM: 0,
    remainingXtDurationS: 0,
    remainingDurationS: 0,
    scheduledWorkoutCount: 0,
    completedWorkoutCount: 0,
    ...overrides,
  };
}

describe("computeWeeklyLoad", () => {
  it("sums real distances the same way the pre-reconciliation footer did", () => {
    const result = computeWeeklyLoad(
      [entry({ dayLabel: "Easy", distanceM: 6 * MILE_METERS }), entry({ dayLabel: "Long Run", distanceM: 12 * MILE_METERS })],
      null,
      TODAY,
    );
    expect(result.scheduledMileageM).toBe(Math.round(18 * MILE_METERS));
    expect(result.estimatedCount).toBe(0);
  });

  it("estimates a duration-only non-XT day into mileage via the athlete's easy pace", () => {
    const result = computeWeeklyLoad([entry({ dayLabel: "Easy", durationS: 3600 })], EASY_PACE_S_PER_MI, TODAY);
    // 60 minutes at 8:00/mi -> 7.5 miles
    expect(result.scheduledMileageM).toBe(Math.round(7.5 * MILE_METERS));
    expect(result.estimatedCount).toBe(1);
  });

  it("never estimates a duration-only day when no race is on file", () => {
    const result = computeWeeklyLoad([entry({ dayLabel: "Easy", durationS: 3600 })], null, TODAY);
    expect(result.scheduledMileageM).toBe(0);
    expect(result.estimatedCount).toBe(0);
  });

  it("keeps an XT day's duration separate from mileage regardless of pace availability", () => {
    const result = computeWeeklyLoad(
      [entry({ dayLabel: "Cross Training (Bike)", durationS: 3600 }), entry({ dayLabel: "XT", durationS: 1800 })],
      EASY_PACE_S_PER_MI,
      TODAY,
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
      TODAY,
    );
    expect(result.scheduledMileageM).toBe(Math.round(15 * MILE_METERS));
    expect(result.scheduledXtDurationS).toBe(3600);
    expect(result.estimatedCount).toBe(1);
  });

  // This module's one caller (week-calendar.tsx, the coach-facing
  // /coaching/athletes/[athleteId]/schedule view) is never athlete-facing,
  // so publish status protects nothing here -- it's the coach's own
  // planning work. A previous revision gated the scheduled total on
  // `publishedAt` (carried over from an earlier footer this module
  // replaced), which meant a week that's entirely drafts -- the normal
  // state while a coach is still laying out the week -- always showed
  // "Scheduled: 0.0 mi" even though every day card showed a real,
  // nonzero distance. Fixed: scheduled totals now include drafts, the
  // same way completed totals already did.
  it("includes draft (unpublished) workouts in the scheduled total -- a coach needs an honest running total while still planning the week", () => {
    const result = computeWeeklyLoad(
      [entry({ dayLabel: "Very Easy", distanceM: 4 * MILE_METERS }), entry({ dayLabel: "Intervals", distanceM: 8 * MILE_METERS }), entry({ dayLabel: "LR", distanceM: 16 * MILE_METERS })],
      null,
      TODAY,
    );
    expect(result.scheduledMileageM).toBe(Math.round(28 * MILE_METERS));
  });

  it("computes completed totals independently of published state (unchanged -- always was this way)", () => {
    const result = computeWeeklyLoad([entry({ dayLabel: "Easy", distanceM: 4 * MILE_METERS, actualDistanceM: 4 * MILE_METERS })], null, TODAY);
    expect(result.completedMileageM).toBe(Math.round(4 * MILE_METERS));
  });

  it("estimates completed duration-only mileage the same way as scheduled", () => {
    const result = computeWeeklyLoad([entry({ dayLabel: "Easy", durationS: 2400, actualDurationS: 2400 })], EASY_PACE_S_PER_MI, TODAY);
    expect(result.completedMileageM).toBe(Math.round(5 * MILE_METERS));
  });

  it("keeps completed XT duration separate from completed mileage", () => {
    const outcome = computeWeeklyLoad([entry({ dayLabel: "XT", durationS: 1800, actualDurationS: 1800, actualDistanceM: null })], EASY_PACE_S_PER_MI, TODAY);
    expect(outcome.completedMileageM).toBe(0);
    expect(outcome.completedXtDurationS).toBe(1800);
  });

  // scheduledDurationS/completedDurationS -- the week's real total time
  // (planned-vs-completed rollups, see formatWeeklyLoadText below), a
  // plain sum of every entry's own known duration, XT included, never
  // pace-estimated for an entry with no duration logged at all.
  describe("scheduledDurationS/completedDurationS", () => {
    it("sums every entry's own durationS, XT and non-XT alike", () => {
      const outcome = computeWeeklyLoad(
        [entry({ dayLabel: "Easy", durationS: 2400 }), entry({ dayLabel: "XT", durationS: 1800 })],
        null,
        TODAY,
      );
      expect(outcome.scheduledDurationS).toBe(4200);
    });

    it("never fabricates a duration for an entry that has none, even when its distance is known", () => {
      const outcome = computeWeeklyLoad([entry({ dayLabel: "Long Run", distanceM: 16 * MILE_METERS })], EASY_PACE_S_PER_MI, TODAY);
      expect(outcome.scheduledDurationS).toBe(0);
    });

    it("sums completed (actual) duration the same way, independent of the scheduled side", () => {
      const outcome = computeWeeklyLoad(
        [entry({ dayLabel: "Easy", durationS: 2400, actualDurationS: 2200 }), entry({ dayLabel: "XT", durationS: 1800, actualDurationS: 1700 })],
        null,
        TODAY,
      );
      expect(outcome.scheduledDurationS).toBe(4200);
      expect(outcome.completedDurationS).toBe(3900);
    });

    it("mixes entries that do and don't have a known duration within the same week", () => {
      const outcome = computeWeeklyLoad(
        [entry({ dayLabel: "Easy", durationS: 2400 }), entry({ dayLabel: "Long Run", distanceM: 16 * MILE_METERS })],
        null,
        TODAY,
      );
      expect(outcome.scheduledDurationS).toBe(2400);
    });
  });

  // Per-workout reconciliation -- the actual bug fix. A completion only
  // ever credits the specific scheduled (non-Off) workout it belongs to;
  // a completion on a day with nothing scheduled (an Off day, or any day
  // with no planned distance/duration) is real volume that happened, but
  // is reported as unscheduled, never netted against the rest of the
  // week's remaining work.
  describe("per-workout reconciliation: scheduled vs. unscheduled vs. remaining", () => {
    // The exact reproduced case: coach week view, Return to Running week
    // of Oct 19-25, 2026. Mon missed (4mi, no completion, already past
    // "today"); Tue scheduled Off but completed 5.2mi; Wed/Thu/Sat/Sun
    // still ahead and scheduled; Fri also Off.
    it("the exact reproduced case: an Off-day completion is unscheduled, not credited, and doesn't inflate what's remaining", () => {
      const TODAY_TUE = "2026-10-20";
      const entries: WeeklyLoadEntry[] = [
        entry({ dayLabel: "Very Easy", distanceM: 4 * MILE_METERS, scheduledDate: "2026-10-19" }), // Mon, missed
        entry({ actualDistanceM: 5.2 * MILE_METERS, scheduledDate: "2026-10-20" }), // Tue, Off but completed
        entry({ dayLabel: "Easy", distanceM: 5 * MILE_METERS, scheduledDate: "2026-10-21" }), // Wed
        entry({ dayLabel: "Easy", distanceM: 5 * MILE_METERS, scheduledDate: "2026-10-22" }), // Thu
        entry({ scheduledDate: "2026-10-23" }), // Fri, Off
        entry({ dayLabel: "Easy", distanceM: 5 * MILE_METERS, scheduledDate: "2026-10-24" }), // Sat
        entry({ dayLabel: "Very Easy", distanceM: 4 * MILE_METERS, scheduledDate: "2026-10-25" }), // Sun
      ];
      const outcome = computeWeeklyLoad(entries, null, TODAY_TUE);
      expect(outcome.scheduledMileageM).toBe(Math.round(23 * MILE_METERS));
      expect(outcome.completedMileageM).toBe(0);
      expect(outcome.unscheduledMileageM).toBe(Math.round(5.2 * MILE_METERS));
      expect(outcome.remainingMileageM).toBe(Math.round(19 * MILE_METERS));
      expect(outcome.scheduledWorkoutCount).toBe(5);
      expect(outcome.completedWorkoutCount).toBe(0);

      const { countText, unscheduledText, remainingText } = formatWeeklyLoadText(outcome, "miles", null);
      expect(countText).toBe("0 / 5 workouts completed");
      expect(unscheduledText).toBe("+5.2 mi");
      expect(remainingText).toBe("19.0 mi");
    });

    it("normal case: a completion on its own scheduled workout reconciles exactly as before -- no unscheduled volume, remaining nets correctly", () => {
      const outcome = computeWeeklyLoad(
        [
          entry({ dayLabel: "Easy", distanceM: 5 * MILE_METERS, actualDistanceM: 5 * MILE_METERS, scheduledDate: "2026-01-06" }),
          entry({ dayLabel: "Long Run", distanceM: 12 * MILE_METERS, scheduledDate: "2026-01-10" }),
        ],
        null,
        TODAY,
      );
      expect(outcome.scheduledMileageM).toBe(Math.round(17 * MILE_METERS));
      expect(outcome.completedMileageM).toBe(Math.round(5 * MILE_METERS));
      expect(outcome.unscheduledMileageM).toBe(0);
      expect(outcome.remainingMileageM).toBe(Math.round(12 * MILE_METERS));
      expect(outcome.scheduledWorkoutCount).toBe(2);
      expect(outcome.completedWorkoutCount).toBe(1);
    });

    it("mixed case: one scheduled completion plus one off-day completion in the same week", () => {
      const outcome = computeWeeklyLoad(
        [
          entry({ dayLabel: "Easy", distanceM: 5 * MILE_METERS, actualDistanceM: 5 * MILE_METERS, scheduledDate: "2026-01-06" }), // on-plan
          entry({ actualDistanceM: 3 * MILE_METERS, scheduledDate: "2026-01-07" }), // Off, completed anyway
          entry({ dayLabel: "Long Run", distanceM: 12 * MILE_METERS, scheduledDate: "2026-01-10" }), // still ahead
        ],
        null,
        TODAY,
      );
      expect(outcome.scheduledMileageM).toBe(Math.round(17 * MILE_METERS));
      expect(outcome.completedMileageM).toBe(Math.round(5 * MILE_METERS));
      expect(outcome.unscheduledMileageM).toBe(Math.round(3 * MILE_METERS));
      expect(outcome.remainingMileageM).toBe(Math.round(12 * MILE_METERS));
      expect(outcome.scheduledWorkoutCount).toBe(2); // Off day excluded from the denominator
      expect(outcome.completedWorkoutCount).toBe(1);
    });

    it("a missed (past, uncompleted) scheduled workout stays in Scheduled but drops out of Remaining", () => {
      const outcome = computeWeeklyLoad(
        [
          entry({ dayLabel: "Easy", distanceM: 5 * MILE_METERS, scheduledDate: "2026-01-01" }), // past, no completion -> missed
          entry({ dayLabel: "Long Run", distanceM: 12 * MILE_METERS, scheduledDate: "2026-01-10" }), // still ahead
        ],
        null,
        TODAY,
      );
      expect(outcome.scheduledMileageM).toBe(Math.round(17 * MILE_METERS));
      expect(outcome.remainingMileageM).toBe(Math.round(12 * MILE_METERS));
      expect(outcome.scheduledWorkoutCount).toBe(2);
      expect(outcome.completedWorkoutCount).toBe(0);
    });
  });
});

describe("formatWeeklyLoadText", () => {
  it("shows the literal 'X miles + Ymin XT' shape", () => {
    const { scheduledText } = formatWeeklyLoadText(result({ scheduledMileageM: Math.round(40 * MILE_METERS), scheduledXtDurationS: 3600 }), "miles", null);
    expect(scheduledText).toBe("40.0 mi + 60min XT");
  });

  it("omits the XT segment entirely when there's no XT duration", () => {
    const { scheduledText } = formatWeeklyLoadText(result({ scheduledMileageM: Math.round(20 * MILE_METERS) }), "miles", null);
    expect(scheduledText).toBe("20.0 mi");
  });

  it("shows the primary figure in minutes when the coach prefers minutes, converted via easy pace", () => {
    const { scheduledText } = formatWeeklyLoadText(result({ scheduledMileageM: Math.round(20 * MILE_METERS) }), "minutes", EASY_PACE_S_PER_MI);
    // 20 miles @ 8:00/mi = 160 minutes
    expect(scheduledText).toBe("160 min");
  });

  it("falls back to miles when minutes is preferred but no easy pace is available", () => {
    const { scheduledText } = formatWeeklyLoadText(result({ scheduledMileageM: Math.round(20 * MILE_METERS) }), "minutes", null);
    expect(scheduledText).toBe("20.0 mi");
  });

  it("computes scheduled and completed text independently", () => {
    const { scheduledText, completedText } = formatWeeklyLoadText(
      result({ scheduledMileageM: Math.round(40 * MILE_METERS), completedMileageM: Math.round(10 * MILE_METERS), completedXtDurationS: 1800 }),
      "miles",
      null,
    );
    expect(scheduledText).toBe("40.0 mi");
    expect(completedText).toBe("10.0 mi + 30min XT");
  });

  it("the unscheduled line is null when there's no unscheduled volume at all", () => {
    const { unscheduledText } = formatWeeklyLoadText(result(), "miles", null);
    expect(unscheduledText).toBeNull();
  });

  it("the unscheduled line is prefixed with '+' and never nets against scheduled/remaining", () => {
    const { unscheduledText } = formatWeeklyLoadText(result({ unscheduledMileageM: Math.round(5.2 * MILE_METERS) }), "miles", null);
    expect(unscheduledText).toBe("+5.2 mi");
  });

  it("the count text excludes Off days from the denominator", () => {
    const { countText } = formatWeeklyLoadText(result({ scheduledWorkoutCount: 5, completedWorkoutCount: 2 }), "miles", null);
    expect(countText).toBe("2 / 5 workouts completed");
  });

  // scheduledDurationText/completedDurationText -- "planned vs completed"
  // week rollups show distance AND duration together (e.g. "Planned 42.0
  // mi / 5:10:00"); null (never "0:00") when the week had no known
  // duration at all, the same "say nothing rather than fabricate" rule
  // the mileage side already follows.
  describe("scheduledDurationText/completedDurationText", () => {
    it("formats a real duration total via the same clock format actual durations use everywhere else", () => {
      const { scheduledDurationText, completedDurationText } = formatWeeklyLoadText(
        result({ scheduledDurationS: 5 * 3600 + 10 * 60, completedDurationS: 4 * 3600 + 47 * 60 }),
        "miles",
        null,
      );
      expect(scheduledDurationText).toBe("5:10:00");
      expect(completedDurationText).toBe("4:47:00");
    });

    it("is null, not '0:00', when the week had no known duration at all", () => {
      const { scheduledDurationText, completedDurationText } = formatWeeklyLoadText(result(), "miles", null);
      expect(scheduledDurationText).toBeNull();
      expect(completedDurationText).toBeNull();
    });
  });
});
