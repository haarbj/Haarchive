import { describe, expect, it } from "vitest";

import { computePatternView, PATTERN_VIEW_WEEK_COUNT, type PatternViewCheckin, type PatternViewInput, type PatternViewWorkout } from "@/lib/private-coaching/pattern-view";
import { MILE_METERS } from "@/lib/race-distances";

const TODAY = "2026-10-20"; // Tuesday
// mostRecentMonday(TODAY) = 2026-10-19; the 6-week window chronologically:
const W1 = "2026-09-14";
const W2 = "2026-09-21";
const W3 = "2026-09-28";
const W4 = "2026-10-05";
const W5 = "2026-10-12";
const CURRENT = "2026-10-19";

function workout(overrides: Partial<PatternViewWorkout> & { id: string; scheduledDate: string }): PatternViewWorkout {
  return {
    dayLabel: null,
    workoutType: null,
    plannedDistanceM: null,
    plannedDurationS: null,
    plannedRpe: null,
    plannedRpeMax: null,
    isOptional: false,
    actualDistanceM: null,
    actualDurationS: null,
    actualRpe: null,
    ...overrides,
  };
}

function checkin(overrides: Partial<PatternViewCheckin> & { weekStart: string }): PatternViewCheckin {
  return { overallFeel: null, fatigue: 3, soreness: 3, sleepQuality: 3, stress: 3, ...overrides };
}

function input(overrides: Partial<PatternViewInput> = {}): PatternViewInput {
  return { today: TODAY, programStartDate: "2026-01-01", workouts: [], checkins: [], ...overrides };
}

describe("window", () => {
  it("builds exactly PATTERN_VIEW_WEEK_COUNT weeks, chronological, ending on the current week", () => {
    const result = computePatternView(input());
    expect(result.weeks).toHaveLength(PATTERN_VIEW_WEEK_COUNT);
    expect(result.weeks.map((w) => w.weekStart)).toEqual([W1, W2, W3, W4, W5, CURRENT]);
    expect(result.weeks.at(-1)!.isCurrent).toBe(true);
    expect(result.weeks.slice(0, -1).every((w) => !w.isCurrent)).toBe(true);
  });
});

describe("aggregation correctness (via computeWeeklyLoad, no second path)", () => {
  it("sums scheduled and completed mileage for a programmed week with real workouts", () => {
    const workouts = [
      workout({ id: "1", scheduledDate: W5, workoutType: "easy", plannedDistanceM: 5 * MILE_METERS, actualDistanceM: 5 * MILE_METERS }),
      workout({ id: "2", scheduledDate: addDaysStr(W5, 2), workoutType: "long", plannedDistanceM: 12 * MILE_METERS, actualDistanceM: 11 * MILE_METERS }),
    ];
    const week = computePatternView(input({ workouts })).weeks.find((w) => w.weekStart === W5)!;
    expect(week.scheduledMileageM).toBe(Math.round(17 * MILE_METERS));
    expect(week.completedMileageM).toBe(Math.round(16 * MILE_METERS));
    expect(week.scheduledWorkoutCount).toBe(2);
    expect(week.completedWorkoutCount).toBe(2);
    expect(week.completionRate).toBe(1);
  });

  it("an Off-day completion (nothing scheduled) does not inflate the week's completed mileage -- inherited scheduled-only semantics", () => {
    const workouts = [
      workout({ id: "off", scheduledDate: W5, actualDistanceM: 6 * MILE_METERS }), // nothing planned, but a run happened
      workout({ id: "real", scheduledDate: addDaysStr(W5, 1), workoutType: "easy", plannedDistanceM: 5 * MILE_METERS, actualDistanceM: 5 * MILE_METERS }),
    ];
    const week = computePatternView(input({ workouts })).weeks.find((w) => w.weekStart === W5)!;
    expect(week.completedMileageM).toBe(Math.round(5 * MILE_METERS)); // the 6mi off-day run is excluded
    expect(week.scheduledWorkoutCount).toBe(1); // the Off-day entry never counts as a scheduled workout
    expect(week.completedWorkoutCount).toBe(1);
  });

  it("a programmed week with nothing completed at all has a real zero completion rate, not null", () => {
    const workouts = [workout({ id: "1", scheduledDate: W5, workoutType: "easy", plannedDistanceM: 5 * MILE_METERS })];
    const week = computePatternView(input({ workouts })).weeks.find((w) => w.weekStart === W5)!;
    expect(week.isGap).toBe(false);
    expect(week.scheduledWorkoutCount).toBe(1);
    expect(week.completedWorkoutCount).toBe(0);
    expect(week.completionRate).toBe(0);
  });

  it("a programmed week with nothing scheduled at all has a null completion rate (nothing to divide by)", () => {
    const week = computePatternView(input()).weeks.find((w) => w.weekStart === W5)!;
    expect(week.isGap).toBe(false);
    expect(week.scheduledWorkoutCount).toBe(0);
    expect(week.completionRate).toBeNull();
  });
});

describe("gaps vs programmed-zero weeks", () => {
  it("a week entirely before the program started is a gap, with every figure null", () => {
    const week = computePatternView(input({ programStartDate: "2026-10-10" })).weeks.find((w) => w.weekStart === W1)!;
    expect(week.isGap).toBe(true);
    expect(week.scheduledMileageM).toBeNull();
    expect(week.completedMileageM).toBeNull();
    expect(week.scheduledWorkoutCount).toBeNull();
    expect(week.completionRate).toBeNull();
    expect(week.checkin).toBeNull();
  });

  it("a gap week is distinct from a programmed week with zero completions -- the latter has real zeros/nulls-for-the-right-reason, not a blanket null", () => {
    const workouts = [workout({ id: "1", scheduledDate: W5, workoutType: "easy", plannedDistanceM: 5 * MILE_METERS })];
    const result = computePatternView(input({ programStartDate: "2026-10-10", workouts }));
    const gapWeek = result.weeks.find((w) => w.weekStart === W1)!;
    const programmedZeroWeek = result.weeks.find((w) => w.weekStart === W5)!;
    expect(gapWeek.isGap).toBe(true);
    expect(programmedZeroWeek.isGap).toBe(false);
    expect(programmedZeroWeek.scheduledWorkoutCount).toBe(1); // real, not null
    expect(programmedZeroWeek.completedWorkoutCount).toBe(0);
  });

  it("no program at all (programStartDate null) makes every week a gap", () => {
    const result = computePatternView(input({ programStartDate: null }));
    expect(result.weeks.every((w) => w.isGap)).toBe(true);
  });

  it("a week programmed mid-week (programStartDate falls inside it) is not a gap", () => {
    // W4 spans 2026-10-05..2026-10-11; a program starting 2026-10-10 still
    // overlaps it.
    const week = computePatternView(input({ programStartDate: "2026-10-10" })).weeks.find((w) => w.weekStart === W4)!;
    expect(week.isGap).toBe(false);
  });
});

describe("the current (in-progress) week", () => {
  it("still reports real numbers -- a partial week is never hidden", () => {
    const workouts = [workout({ id: "1", scheduledDate: CURRENT, workoutType: "easy", plannedDistanceM: 5 * MILE_METERS, actualDistanceM: 5 * MILE_METERS })];
    const week = computePatternView(input({ workouts })).weeks.at(-1)!;
    expect(week.isCurrent).toBe(true);
    expect(week.completedMileageM).toBe(Math.round(5 * MILE_METERS));
  });

  it("is excluded from every trend descriptor -- a low partial week never reads as a drop", () => {
    // Five full prior weeks all at a steady 20mi completed; the in-progress
    // week has only 2mi completed so far (it's Tuesday). If the current
    // week were included in the trend math, the steep drop would read as
    // "falling"; excluded, five steady weeks correctly read as "steady".
    const weeks = [W1, W2, W3, W4, W5];
    const workouts = weeks.flatMap((weekStart, i) => [
      workout({ id: `w${i}`, scheduledDate: weekStart, workoutType: "easy", plannedDistanceM: 20 * MILE_METERS, actualDistanceM: 20 * MILE_METERS }),
    ]);
    workouts.push(workout({ id: "current", scheduledDate: CURRENT, workoutType: "easy", plannedDistanceM: 20 * MILE_METERS, actualDistanceM: 2 * MILE_METERS }));
    const result = computePatternView(input({ workouts }));
    expect(result.completedMileageTrend).toBe("steady");
  });
});

describe("trend descriptor rule: last-half vs prior-half of qualifying (non-gap, non-current) weeks, minimum 4", () => {
  function mileageInput(values: number[]): PatternViewInput {
    const weeks = [W1, W2, W3, W4, W5];
    const workouts = weeks.map((weekStart, i) =>
      workout({ id: `w${i}`, scheduledDate: weekStart, workoutType: "easy", plannedDistanceM: values[i] * MILE_METERS, actualDistanceM: values[i] * MILE_METERS }),
    );
    return input({ workouts });
  }

  it("rising: the recent half averages meaningfully higher than the prior half", () => {
    const result = computePatternView(mileageInput([20, 20, 30, 30, 30]));
    expect(result.completedMileageTrend).toBe("rising");
  });

  it("falling: the recent half averages meaningfully lower than the prior half", () => {
    const result = computePatternView(mileageInput([30, 30, 20, 20, 20]));
    expect(result.completedMileageTrend).toBe("falling");
  });

  it("steady: recent and prior halves are within the threshold of each other", () => {
    const result = computePatternView(mileageInput([25, 25, 26, 25, 25]));
    expect(result.completedMileageTrend).toBe("steady");
  });

  it("insufficient-data: fewer than 4 qualifying weeks (most of the window is a gap)", () => {
    const result = computePatternView({ ...mileageInput([20, 20, 30, 30, 30]), programStartDate: "2026-10-01" });
    // Only W3, W4, W5 are non-gap and non-current -- 3 qualifying weeks, below the minimum of 4.
    expect(result.completedMileageTrend).toBe("insufficient-data");
  });

  it("steady at zero, not insufficient-data, when every qualifying week has a real (if zero) value", () => {
    // Nothing scheduled anywhere, but that's still 5 real data points of
    // "0 completed" each -- a true, if uneventful, trend, not a lack of data.
    expect(computePatternView(input()).completedMileageTrend).toBe("steady");
  });

  it("insufficient-data: fewer than 4 weeks have anything to compare at all (a series with real gaps in its own data, e.g. long run)", () => {
    const workouts = [workout({ id: "lr", scheduledDate: W5, workoutType: "long", actualDistanceM: 14 * MILE_METERS })];
    const result = computePatternView(input({ workouts }));
    // Only one week (W5) ever had a completed long run -- 1 qualifying value, below the minimum of 4.
    expect(result.longRunTrend).toBe("insufficient-data");
  });
});

describe("long run series uses only completed long runs", () => {
  it("picks the week's longest completed long run, ignoring a longer non-long-run completion", () => {
    const workouts = [
      workout({ id: "tempo", scheduledDate: W5, workoutType: "tempo", actualDistanceM: 20 * MILE_METERS }), // longer, but not a long run
      workout({ id: "lr1", scheduledDate: addDaysStr(W5, 5), workoutType: "long", actualDistanceM: 12 * MILE_METERS }),
      workout({ id: "lr2", scheduledDate: addDaysStr(W5, 6), workoutType: "long", actualDistanceM: 14 * MILE_METERS }),
    ];
    const week = computePatternView(input({ workouts })).weeks.find((w) => w.weekStart === W5)!;
    expect(week.longRunDistanceM).toBe(Math.round(14 * MILE_METERS));
  });

  it("is null, not zero, when no long run was completed that week", () => {
    const workouts = [workout({ id: "lr", scheduledDate: W5, workoutType: "long", plannedDistanceM: 12 * MILE_METERS })]; // scheduled, not completed
    const week = computePatternView(input({ workouts })).weeks.find((w) => w.weekStart === W5)!;
    expect(week.longRunDistanceM).toBeNull();
  });
});

describe("key-session RPE series uses only completed key sessions (isBigSession, excluding long runs)", () => {
  it("averages logged RPE across completed key sessions, ignoring an easy run's RPE", () => {
    const workouts = [
      workout({ id: "easy", scheduledDate: W5, workoutType: "easy", plannedRpe: 3, actualRpe: 9 }), // not a key session regardless of logged RPE
      workout({ id: "tempo", scheduledDate: addDaysStr(W5, 1), workoutType: "tempo", plannedRpe: 8, actualRpe: 7 }),
      workout({ id: "vo2", scheduledDate: addDaysStr(W5, 3), workoutType: "vo2", plannedRpeMax: 9, actualRpe: 8 }),
    ];
    const week = computePatternView(input({ workouts })).weeks.find((w) => w.weekStart === W5)!;
    expect(week.keySessionAvgRpe).toBe(7.5);
    expect(week.keySessionAvgPrescribedRpe).toBe(8.5); // (8 + 9) / 2, using plannedRpeMax ?? plannedRpe per isBigSession's own convention
  });

  it("excludes a long run even when its RPE would otherwise qualify as a big session", () => {
    const workouts = [workout({ id: "lr", scheduledDate: W5, workoutType: "long", plannedRpe: 9, actualRpe: 8 })];
    const week = computePatternView(input({ workouts })).weeks.find((w) => w.weekStart === W5)!;
    expect(week.keySessionAvgRpe).toBeNull();
  });

  it("excludes an optional session even with a high prescribed RPE (isBigSession's own rule)", () => {
    const workouts = [workout({ id: "opt", scheduledDate: W5, workoutType: "tempo", plannedRpe: 9, isOptional: true, actualRpe: 8 })];
    const week = computePatternView(input({ workouts })).weeks.find((w) => w.weekStart === W5)!;
    expect(week.keySessionAvgRpe).toBeNull();
  });

  it("is null when no key session was completed that week", () => {
    const week = computePatternView(input()).weeks.find((w) => w.weekStart === W5)!;
    expect(week.keySessionAvgRpe).toBeNull();
    expect(week.keySessionAvgPrescribedRpe).toBeNull();
  });
});

describe("check-in trend, only using weeks with a real rating", () => {
  it("carries the week's own check-in through untouched", () => {
    const checkins = [checkin({ weekStart: W5, overallFeel: 4 })];
    const week = computePatternView(input({ checkins })).weeks.find((w) => w.weekStart === W5)!;
    expect(week.checkin?.overallFeel).toBe(4);
  });

  it("is null when no check-in was submitted that week", () => {
    const week = computePatternView(input()).weeks.find((w) => w.weekStart === W5)!;
    expect(week.checkin).toBeNull();
  });

  it("a gap week never carries a check-in even if one happens to exist for that date (shouldn't happen, but never surfaced)", () => {
    const checkins = [checkin({ weekStart: W1, overallFeel: 5 })];
    const week = computePatternView(input({ programStartDate: "2026-10-10", checkins })).weeks.find((w) => w.weekStart === W1)!;
    expect(week.checkin).toBeNull();
  });
});

describe("both surfaces render identical numbers from the one module", () => {
  it("calling computePatternView twice with the same input produces deep-equal output -- deterministic, no hidden state", () => {
    const workouts = [workout({ id: "1", scheduledDate: W5, workoutType: "long", actualDistanceM: 14 * MILE_METERS })];
    const once = computePatternView(input({ workouts }));
    const twice = computePatternView(input({ workouts }));
    expect(once).toEqual(twice);
  });
});

function addDaysStr(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
