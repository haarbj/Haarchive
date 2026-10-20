import { describe, expect, it } from "vitest";

import {
  evaluateAdaptationSignals,
  evaluateFatigueAccumulating,
  evaluateFitnessUp,
  evaluateGoingQuiet,
  evaluatePlanTooLow,
  fingerprintAdaptationCard,
  type AdaptationWorkoutRecord,
  type DisruptionWindow,
} from "@/lib/private-coaching/adaptation-signals";

const TODAY = "2026-10-20";

function workout(overrides: Partial<AdaptationWorkoutRecord> = {}): AdaptationWorkoutRecord {
  return {
    id: "w-1",
    scheduledDate: "2026-10-10",
    workoutType: "easy",
    dayLabel: "Easy",
    plannedDistanceM: 8000,
    plannedDistanceMaxM: null,
    plannedRpe: 5,
    plannedRpeMax: null,
    isOptional: false,
    completedAt: "2026-10-10T12:00:00Z",
    actualDistanceM: 8000,
    loggedRpe: 5,
    ...overrides,
  };
}

describe("evaluateFitnessUp", () => {
  it("fires when exactly 3 of the last 4 completed non-key workouts are >=2 RPE under prescription", () => {
    const workouts = [
      workout({ id: "w-1", scheduledDate: "2026-10-16", plannedRpe: 6, loggedRpe: 4 }),
      workout({ id: "w-2", scheduledDate: "2026-10-15", plannedRpe: 6, loggedRpe: 4 }),
      workout({ id: "w-3", scheduledDate: "2026-10-14", plannedRpe: 6, loggedRpe: 4 }),
      workout({ id: "w-4", scheduledDate: "2026-10-13", plannedRpe: 6, loggedRpe: 6 }),
    ];
    const result = evaluateFitnessUp(workouts);
    expect(result).not.toBeNull();
    expect(result!.evidence).toHaveLength(3);
    expect(result!.action).toEqual({ kind: "insert_retest_workout" });
  });

  it("does not fire with only 2 of 4 hits -- one short of the stated threshold", () => {
    const workouts = [
      workout({ id: "w-1", scheduledDate: "2026-10-16", plannedRpe: 6, loggedRpe: 4 }),
      workout({ id: "w-2", scheduledDate: "2026-10-15", plannedRpe: 6, loggedRpe: 4 }),
      workout({ id: "w-3", scheduledDate: "2026-10-14", plannedRpe: 6, loggedRpe: 6 }),
      workout({ id: "w-4", scheduledDate: "2026-10-13", plannedRpe: 6, loggedRpe: 6 }),
    ];
    expect(evaluateFitnessUp(workouts)).toBeNull();
  });

  it("does not fire on exactly 1 RPE under -- the delta must reach 2, not 1", () => {
    const workouts = [
      workout({ id: "w-1", scheduledDate: "2026-10-16", plannedRpe: 6, loggedRpe: 5 }),
      workout({ id: "w-2", scheduledDate: "2026-10-15", plannedRpe: 6, loggedRpe: 5 }),
      workout({ id: "w-3", scheduledDate: "2026-10-14", plannedRpe: 6, loggedRpe: 5 }),
      workout({ id: "w-4", scheduledDate: "2026-10-13", plannedRpe: 6, loggedRpe: 5 }),
    ];
    expect(evaluateFitnessUp(workouts)).toBeNull();
  });

  it("excludes key sessions and long runs from the sample entirely", () => {
    const workouts = [
      workout({ id: "key-1", scheduledDate: "2026-10-16", plannedRpe: 8, loggedRpe: 4, dayLabel: "Threshold", workoutType: "tempo" }),
      workout({ id: "long-1", scheduledDate: "2026-10-15", workoutType: "long", plannedRpe: 6, loggedRpe: 4 }),
      workout({ id: "w-3", scheduledDate: "2026-10-14", plannedRpe: 6, loggedRpe: 4 }),
      workout({ id: "w-4", scheduledDate: "2026-10-13", plannedRpe: 6, loggedRpe: 4 }),
    ];
    // Only 2 real filler candidates exist (w-3, w-4) -- can never reach the
    // 3-of-4 threshold no matter how far under RPE the excluded ones ran.
    expect(evaluateFitnessUp(workouts)).toBeNull();
  });

  it("evidence carries the actual prescribed/logged figures", () => {
    const workouts = [
      workout({ id: "w-1", scheduledDate: "2026-10-16", dayLabel: "Easy", plannedRpe: 6, loggedRpe: 3 }),
      workout({ id: "w-2", scheduledDate: "2026-10-15", plannedRpe: 6, loggedRpe: 4 }),
      workout({ id: "w-3", scheduledDate: "2026-10-14", plannedRpe: 6, loggedRpe: 4 }),
    ];
    const result = evaluateFitnessUp(workouts)!;
    expect(result.evidence[0]).toEqual({
      workoutId: "w-1",
      scheduledDate: "2026-10-16",
      dayLabel: "Easy",
      prescribedRpe: 6,
      loggedRpe: 3,
    });
  });
});

describe("evaluateFatigueAccumulating", () => {
  const upcomingKey = workout({
    id: "key-upcoming",
    scheduledDate: "2026-10-24",
    plannedRpe: 8,
    dayLabel: "Threshold",
    workoutType: "tempo",
    completedAt: null,
    actualDistanceM: null,
    loggedRpe: null,
  });

  it("fires at exactly 2 noteworthy completions in the last 7 days", () => {
    const workouts = [
      workout({ id: "w-1", scheduledDate: "2026-10-18", completedAt: "2026-10-18T12:00:00Z", plannedRpe: 4, loggedRpe: 7 }),
      workout({ id: "w-2", scheduledDate: "2026-10-16", completedAt: "2026-10-16T12:00:00Z", plannedRpe: 4, loggedRpe: 7 }),
      upcomingKey,
    ];
    const result = evaluateFatigueAccumulating(workouts, TODAY);
    expect(result).not.toBeNull();
    expect(result!.action).toEqual({ kind: "convert_to_easy", workoutId: "key-upcoming", scheduledDate: "2026-10-24" });
  });

  it("does not fire at only 1 noteworthy completion in 7 days with nothing extra in 14", () => {
    const workouts = [
      workout({ id: "w-1", scheduledDate: "2026-10-18", completedAt: "2026-10-18T12:00:00Z", plannedRpe: 4, loggedRpe: 7 }),
      upcomingKey,
    ];
    expect(evaluateFatigueAccumulating(workouts, TODAY)).toBeNull();
  });

  it("fires at exactly 3 noteworthy completions in 14 days even when the 7-day count is under its own threshold", () => {
    const workouts = [
      workout({ id: "w-1", scheduledDate: "2026-10-09", completedAt: "2026-10-09T12:00:00Z", plannedRpe: 4, loggedRpe: 7 }),
      workout({ id: "w-2", scheduledDate: "2026-10-08", completedAt: "2026-10-08T12:00:00Z", plannedRpe: 4, loggedRpe: 7 }),
      workout({ id: "w-3", scheduledDate: "2026-10-07", completedAt: "2026-10-07T12:00:00Z", plannedRpe: 4, loggedRpe: 7 }),
      upcomingKey,
    ];
    expect(evaluateFatigueAccumulating(workouts, TODAY)).not.toBeNull();
  });

  it("does not fire at only 2 noteworthy completions in 14 days -- one short of that window's threshold", () => {
    const workouts = [
      workout({ id: "w-1", scheduledDate: "2026-10-09", completedAt: "2026-10-09T12:00:00Z", plannedRpe: 4, loggedRpe: 7 }),
      workout({ id: "w-2", scheduledDate: "2026-10-08", completedAt: "2026-10-08T12:00:00Z", plannedRpe: 4, loggedRpe: 7 }),
      upcomingKey,
    ];
    expect(evaluateFatigueAccumulating(workouts, TODAY)).toBeNull();
  });

  it("does not fire when no upcoming key session exists to protect", () => {
    const workouts = [
      workout({ id: "w-1", scheduledDate: "2026-10-18", completedAt: "2026-10-18T12:00:00Z", plannedRpe: 4, loggedRpe: 7 }),
      workout({ id: "w-2", scheduledDate: "2026-10-16", completedAt: "2026-10-16T12:00:00Z", plannedRpe: 4, loggedRpe: 7 }),
    ];
    expect(evaluateFatigueAccumulating(workouts, TODAY)).toBeNull();
  });
});

describe("evaluatePlanTooLow", () => {
  function overCompleted(id: string, date: string): AdaptationWorkoutRecord {
    return workout({ id, scheduledDate: date, plannedDistanceM: 10000, actualDistanceM: 11000, workoutType: "easy" });
  }

  const upcomingComparable: AdaptationWorkoutRecord = workout({
    id: "upcoming-1",
    scheduledDate: "2026-10-23",
    workoutType: "easy",
    plannedDistanceM: 10000,
    completedAt: null,
    actualDistanceM: null,
    loggedRpe: null,
  });

  it("fires when the last 3 distance workouts are each exactly 10% over planned", () => {
    const workouts = [
      overCompleted("w-1", "2026-10-18"),
      overCompleted("w-2", "2026-10-16"),
      overCompleted("w-3", "2026-10-14"),
      upcomingComparable,
    ];
    const result = evaluatePlanTooLow(workouts);
    expect(result).not.toBeNull();
    expect(result!.evidence).toHaveLength(3);
    expect(result!.evidence[0].overPercent).toBe(10);
    expect(result!.action).toEqual({
      kind: "raise_distance",
      workoutId: "upcoming-1",
      scheduledDate: "2026-10-23",
      currentDistanceM: 10000,
      newDistanceM: 11000,
    });
  });

  it("does not fire when one of the last 3 is under the 10% threshold", () => {
    const underOne = workout({ id: "w-2", scheduledDate: "2026-10-16", plannedDistanceM: 10000, actualDistanceM: 10500 });
    const workouts = [overCompleted("w-1", "2026-10-18"), underOne, overCompleted("w-3", "2026-10-14"), upcomingComparable];
    expect(evaluatePlanTooLow(workouts)).toBeNull();
  });

  it("does not fire with only 2 qualifying distance workouts -- one short of the required sample", () => {
    const workouts = [overCompleted("w-1", "2026-10-18"), overCompleted("w-2", "2026-10-16"), upcomingComparable];
    expect(evaluatePlanTooLow(workouts)).toBeNull();
  });
});

describe("evaluateGoingQuiet", () => {
  function scheduled(id: string, date: string, completed: boolean): AdaptationWorkoutRecord {
    return workout({ id, scheduledDate: date, completedAt: completed ? `${date}T12:00:00Z` : null, actualDistanceM: completed ? 8000 : null });
  }

  it("fires at exactly 60% completion across exactly 5 scheduled workouts", () => {
    const workouts = [
      scheduled("w-1", "2026-10-10", true),
      scheduled("w-2", "2026-10-11", true),
      scheduled("w-3", "2026-10-12", true),
      scheduled("w-4", "2026-10-13", false),
      scheduled("w-5", "2026-10-14", false),
    ];
    const result = evaluateGoingQuiet(workouts, TODAY, []);
    expect(result).not.toBeNull();
    expect(result!.evidence.completionRate).toBeCloseTo(0.6);
    expect(result!.action).toEqual({ kind: "request_checkin" });
  });

  it("does not fire above 60% completion -- 3 of 5 missed is the boundary, not 2 of 5", () => {
    const workouts = [
      scheduled("w-1", "2026-10-10", true),
      scheduled("w-2", "2026-10-11", true),
      scheduled("w-3", "2026-10-12", true),
      scheduled("w-4", "2026-10-13", true),
      scheduled("w-5", "2026-10-14", false),
    ];
    expect(evaluateGoingQuiet(workouts, TODAY, [])).toBeNull();
  });

  it("does not fire with only 4 scheduled workouts in the window -- one short of the minimum sample", () => {
    const workouts = [
      scheduled("w-1", "2026-10-10", false),
      scheduled("w-2", "2026-10-11", false),
      scheduled("w-3", "2026-10-12", false),
      scheduled("w-4", "2026-10-13", true),
    ];
    expect(evaluateGoingQuiet(workouts, TODAY, [])).toBeNull();
  });

  it("is suppressed entirely when a realignment disruption window overlaps the lookback", () => {
    const workouts = [
      scheduled("w-1", "2026-10-10", false),
      scheduled("w-2", "2026-10-11", false),
      scheduled("w-3", "2026-10-12", false),
      scheduled("w-4", "2026-10-13", false),
      scheduled("w-5", "2026-10-14", false),
    ];
    const realignmentWindows: DisruptionWindow[] = [{ startDate: "2026-10-12", endDate: "2026-10-15" }];
    expect(evaluateGoingQuiet(workouts, TODAY, realignmentWindows)).toBeNull();
  });

  it("fires when a realignment window exists but does not overlap this lookback", () => {
    const workouts = [
      scheduled("w-1", "2026-10-10", false),
      scheduled("w-2", "2026-10-11", false),
      scheduled("w-3", "2026-10-12", false),
      scheduled("w-4", "2026-10-13", false),
      scheduled("w-5", "2026-10-14", false),
    ];
    const realignmentWindows: DisruptionWindow[] = [{ startDate: "2026-09-01", endDate: "2026-09-05" }];
    expect(evaluateGoingQuiet(workouts, TODAY, realignmentWindows)).not.toBeNull();
  });
});

describe("determinism", () => {
  it("the same training data produces the same card set, in the same order, every time", () => {
    const workouts = [
      workout({ id: "w-1", scheduledDate: "2026-10-18", completedAt: "2026-10-18T12:00:00Z", plannedRpe: 4, loggedRpe: 7 }),
      workout({ id: "w-2", scheduledDate: "2026-10-16", completedAt: "2026-10-16T12:00:00Z", plannedRpe: 4, loggedRpe: 7 }),
      workout({ id: "key-upcoming", scheduledDate: "2026-10-24", plannedRpe: 8, dayLabel: "Threshold", workoutType: "tempo", completedAt: null, actualDistanceM: null, loggedRpe: null }),
    ];
    const run1 = evaluateAdaptationSignals(workouts, TODAY, []);
    const run2 = evaluateAdaptationSignals(workouts, TODAY, []);
    expect(run1).toEqual(run2);
  });
});

describe("fingerprintAdaptationCard", () => {
  it("is stable for identical evidence and differs when evidence changes", () => {
    const signalA = evaluateFitnessUp([
      workout({ id: "w-1", scheduledDate: "2026-10-16", plannedRpe: 6, loggedRpe: 3 }),
      workout({ id: "w-2", scheduledDate: "2026-10-15", plannedRpe: 6, loggedRpe: 3 }),
      workout({ id: "w-3", scheduledDate: "2026-10-14", plannedRpe: 6, loggedRpe: 3 }),
    ])!;
    const signalB = evaluateFitnessUp([
      workout({ id: "w-1", scheduledDate: "2026-10-16", plannedRpe: 6, loggedRpe: 3 }),
      workout({ id: "w-2", scheduledDate: "2026-10-15", plannedRpe: 6, loggedRpe: 3 }),
      workout({ id: "w-3", scheduledDate: "2026-10-14", plannedRpe: 6, loggedRpe: 3 }),
    ])!;
    expect(fingerprintAdaptationCard("athlete-1", signalA)).toBe(fingerprintAdaptationCard("athlete-1", signalB));

    const signalC = evaluateFitnessUp([
      workout({ id: "w-1", scheduledDate: "2026-10-16", plannedRpe: 6, loggedRpe: 2 }),
      workout({ id: "w-2", scheduledDate: "2026-10-15", plannedRpe: 6, loggedRpe: 3 }),
      workout({ id: "w-3", scheduledDate: "2026-10-14", plannedRpe: 6, loggedRpe: 3 }),
    ])!;
    expect(fingerprintAdaptationCard("athlete-1", signalA)).not.toBe(fingerprintAdaptationCard("athlete-1", signalC));
  });
});
