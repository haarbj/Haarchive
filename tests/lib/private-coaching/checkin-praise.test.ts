import { describe, expect, it } from "vitest";

import {
  computeCheckinPraiseCandidates,
  CONSISTENCY_STREAK_THRESHOLD,
  MAX_CHECKIN_PRAISE_CANDIDATES,
  type CheckinPraiseWorkout,
} from "@/lib/private-coaching/checkin-praise";
import { MILE_METERS } from "@/lib/race-distances";

const PERIOD_START = "2026-10-19"; // Monday
const PERIOD_END = "2026-10-25"; // Sunday

function workout(overrides: Partial<CheckinPraiseWorkout> & { id: string; scheduledDate: string }): CheckinPraiseWorkout {
  return {
    dayLabel: null,
    title: null,
    workoutType: null,
    plannedDistanceM: null,
    plannedDistanceMaxM: null,
    plannedDurationS: null,
    plannedDurationMaxS: null,
    plannedRpe: null,
    actualDistanceM: null,
    actualDurationS: null,
    actualRpe: null,
    ...overrides,
  };
}

function run(periodWorkouts: CheckinPraiseWorkout[], cycleWorkouts?: CheckinPraiseWorkout[]) {
  return computeCheckinPraiseCandidates({
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    periodWorkouts,
    cycleWorkouts: cycleWorkouts ?? periodWorkouts,
  });
}

// An earlier tempo and VO2 completion well before the check-in period, so
// execution-only fixtures don't accidentally also qualify as a "first of
// type" milestone -- isolates the fact under test rather than letting an
// unrelated fact ride along.
const PRIOR_HISTORY: CheckinPraiseWorkout[] = [
  workout({ id: "prior-tempo", scheduledDate: "2026-09-01", workoutType: "tempo", actualDistanceM: 5 * MILE_METERS }),
  workout({ id: "prior-vo2", scheduledDate: "2026-09-02", workoutType: "vo2", actualDistanceM: 4 * MILE_METERS }),
];

function runExecution(periodWorkouts: CheckinPraiseWorkout[]) {
  return run(periodWorkouts, [...PRIOR_HISTORY, ...periodWorkouts]);
}

describe("consistency", () => {
  it("completing all scheduled (non-Off) workouts in the period produces the 'all' candidate", () => {
    const workouts = [
      workout({ id: "mon", scheduledDate: "2026-10-19", workoutType: "easy", plannedDistanceM: 5 * MILE_METERS, actualDistanceM: 5 * MILE_METERS }),
      workout({ id: "wed", scheduledDate: "2026-10-21", workoutType: "easy", plannedDistanceM: 5 * MILE_METERS, actualDistanceM: 5 * MILE_METERS }),
      workout({ id: "fri", scheduledDate: "2026-10-23", workoutType: "easy", plannedDistanceM: 5 * MILE_METERS, actualDistanceM: 5 * MILE_METERS }),
      // An Off day (nothing scheduled) must not count against or for the denominator.
      workout({ id: "off", scheduledDate: "2026-10-24" }),
    ];
    const candidates = run(workouts);
    expect(candidates[0]).toEqual({ id: "consistency-all", category: "consistency", text: "Completed all 3 scheduled workouts this week." });
  });

  it(`a completion streak of ${CONSISTENCY_STREAK_THRESHOLD} or more, short of a perfect week, produces the streak candidate`, () => {
    const workouts = [
      workout({ id: "1", scheduledDate: "2026-10-19", workoutType: "easy", plannedDistanceM: 5 * MILE_METERS, actualDistanceM: 5 * MILE_METERS }),
      workout({ id: "2", scheduledDate: "2026-10-20", workoutType: "easy", plannedDistanceM: 5 * MILE_METERS, actualDistanceM: 5 * MILE_METERS }),
      workout({ id: "3", scheduledDate: "2026-10-21", workoutType: "easy", plannedDistanceM: 5 * MILE_METERS, actualDistanceM: 5 * MILE_METERS }),
      workout({ id: "4", scheduledDate: "2026-10-22", workoutType: "easy", plannedDistanceM: 5 * MILE_METERS, actualDistanceM: 5 * MILE_METERS }),
      workout({ id: "5", scheduledDate: "2026-10-23", workoutType: "easy", plannedDistanceM: 5 * MILE_METERS }), // missed
      workout({ id: "6", scheduledDate: "2026-10-24", workoutType: "easy", plannedDistanceM: 5 * MILE_METERS }), // missed
    ];
    const candidates = run(workouts);
    expect(candidates[0]).toEqual({ id: "consistency-streak", category: "consistency", text: "Completed 4 of 6 scheduled workouts this week." });
  });

  it("below the streak threshold and not a perfect week produces no consistency candidate", () => {
    const workouts = [
      workout({ id: "1", scheduledDate: "2026-10-19", workoutType: "easy", plannedDistanceM: 5 * MILE_METERS, actualDistanceM: 5 * MILE_METERS }),
      workout({ id: "2", scheduledDate: "2026-10-20", workoutType: "easy", plannedDistanceM: 5 * MILE_METERS }),
      workout({ id: "3", scheduledDate: "2026-10-21", workoutType: "easy", plannedDistanceM: 5 * MILE_METERS }),
      workout({ id: "4", scheduledDate: "2026-10-22", workoutType: "easy", plannedDistanceM: 5 * MILE_METERS }),
      workout({ id: "5", scheduledDate: "2026-10-23", workoutType: "easy", plannedDistanceM: 5 * MILE_METERS }),
    ];
    expect(run(workouts).some((c) => c.category === "consistency")).toBe(false);
  });

  it("a trivially light week (fewer than 3 real scheduled workouts), even completed in full, generates no 'all' candidate", () => {
    const workouts = [workout({ id: "1", scheduledDate: "2026-10-19", workoutType: "easy", plannedDistanceM: 5 * MILE_METERS, actualDistanceM: 5 * MILE_METERS })];
    expect(run(workouts).some((c) => c.category === "consistency")).toBe(false);
  });
});

describe("execution", () => {
  it("a key session completed within tolerance of plan names the workout and day", () => {
    const workouts = [workout({ id: "tempo-1", scheduledDate: "2026-10-21", dayLabel: "Tempo", workoutType: "tempo", plannedDistanceM: 6 * MILE_METERS, actualDistanceM: 6.1 * MILE_METERS })];
    const candidates = runExecution(workouts);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toEqual({
      id: "execution-onplan-tempo-1",
      category: "execution",
      text: "Wednesday's Tempo completed on plan: 6.1 mi.",
    });
  });

  it("RPE at or below prescribed on a hard session reads as controlled execution -- the Wooden example", () => {
    const workouts = [
      workout({ id: "tempo-2", scheduledDate: "2026-10-20", dayLabel: "Tempo", workoutType: "tempo", plannedDistanceM: 6 * MILE_METERS, actualDistanceM: 6 * MILE_METERS, plannedRpe: 7, actualRpe: 6 }),
    ];
    const candidates = runExecution(workouts);
    expect(candidates[0].text).toBe("Tuesday's Tempo at RPE 6 against a prescribed 7: controlled execution.");
  });

  it("when both the RPE fact and the on-plan-distance fact qualify for the same workout, only the RPE candidate fires (no double-counting one workout)", () => {
    const workouts = [
      workout({ id: "tempo-3", scheduledDate: "2026-10-20", dayLabel: "Tempo", workoutType: "tempo", plannedDistanceM: 6 * MILE_METERS, actualDistanceM: 6 * MILE_METERS, plannedRpe: 7, actualRpe: 6 }),
    ];
    const candidates = runExecution(workouts).filter((c) => c.id.includes("tempo-3"));
    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe("execution-rpe-tempo-3");
  });

  it("RPE above prescribed does not count as controlled execution", () => {
    const workouts = [
      workout({ id: "tempo-4", scheduledDate: "2026-10-20", dayLabel: "Tempo", workoutType: "tempo", plannedDistanceM: 6 * MILE_METERS, actualDistanceM: 6 * MILE_METERS, plannedRpe: 7, actualRpe: 8 }),
    ];
    expect(runExecution(workouts).some((c) => c.id === "execution-rpe-tempo-4")).toBe(false);
  });

  it("an easy run, even if technically on-plan, is not a key session and produces no execution candidate", () => {
    const workouts = [workout({ id: "easy-1", scheduledDate: "2026-10-20", dayLabel: "Easy", workoutType: "easy", plannedDistanceM: 5 * MILE_METERS, actualDistanceM: 5 * MILE_METERS })];
    expect(runExecution(workouts)).toHaveLength(0);
  });

  it("a key session completed off plan (outside tolerance) produces no on-plan execution candidate", () => {
    const workouts = [workout({ id: "tempo-5", scheduledDate: "2026-10-20", dayLabel: "Tempo", workoutType: "tempo", plannedDistanceM: 6 * MILE_METERS, actualDistanceM: 4 * MILE_METERS })];
    expect(runExecution(workouts)).toHaveLength(0);
  });
});

describe("milestone", () => {
  it("the period's long run matching the cycle's max distance is named as longest this cycle -- the Wooden example", () => {
    const cycleWorkouts = [
      workout({ id: "lr-early-1", scheduledDate: "2026-09-21", workoutType: "long", actualDistanceM: 12 * MILE_METERS }),
      workout({ id: "lr-early-2", scheduledDate: "2026-10-05", workoutType: "long", actualDistanceM: 14 * MILE_METERS }),
      workout({ id: "lr-this-week", scheduledDate: "2026-10-23", dayLabel: "Long Run", workoutType: "long", actualDistanceM: 16 * MILE_METERS }),
    ];
    const periodWorkouts = cycleWorkouts.filter((w) => w.id === "lr-this-week");
    const candidates = run(periodWorkouts, cycleWorkouts);
    expect(candidates[0]).toEqual({
      id: "milestone-longest-lr-this-week",
      category: "milestone",
      text: "Long run up to 16 mi, longest this cycle.",
    });
  });

  it("a long run shorter than an earlier one this cycle is not credited as longest", () => {
    const cycleWorkouts = [
      workout({ id: "lr-early", scheduledDate: "2026-09-21", workoutType: "long", actualDistanceM: 18 * MILE_METERS }),
      workout({ id: "lr-this-week", scheduledDate: "2026-10-23", workoutType: "long", actualDistanceM: 14 * MILE_METERS }),
    ];
    const periodWorkouts = cycleWorkouts.filter((w) => w.id === "lr-this-week");
    expect(run(periodWorkouts, cycleWorkouts).some((c) => c.category === "milestone")).toBe(false);
  });

  it("a workout type never completed before in the program reads as a first, named by day", () => {
    const cycleWorkouts = [
      workout({ id: "easy-early", scheduledDate: "2026-09-21", workoutType: "easy", actualDistanceM: 5 * MILE_METERS }),
      workout({ id: "vo2-first", scheduledDate: "2026-10-22", dayLabel: "VO2 Repeats", workoutType: "vo2", actualDistanceM: 5 * MILE_METERS }),
    ];
    const periodWorkouts = cycleWorkouts.filter((w) => w.id === "vo2-first");
    const candidates = run(periodWorkouts, cycleWorkouts);
    expect(candidates[0]).toEqual({
      id: "milestone-first-vo2-first",
      category: "milestone",
      text: "Thursday's VO2 Repeats was the first Intervals session completed this program.",
    });
  });

  it("a workout type already completed earlier this program is not credited as a first", () => {
    const cycleWorkouts = [
      workout({ id: "vo2-early", scheduledDate: "2026-09-21", workoutType: "vo2", actualDistanceM: 5 * MILE_METERS }),
      workout({ id: "vo2-this-week", scheduledDate: "2026-10-22", workoutType: "vo2", actualDistanceM: 5 * MILE_METERS }),
    ];
    const periodWorkouts = cycleWorkouts.filter((w) => w.id === "vo2-this-week");
    expect(run(periodWorkouts, cycleWorkouts).some((c) => c.category === "milestone")).toBe(false);
  });

  it("a first-of-type easy run is not a milestone -- easy is the baseline, not an achievement", () => {
    const cycleWorkouts = [workout({ id: "easy-only", scheduledDate: "2026-10-22", workoutType: "easy", actualDistanceM: 5 * MILE_METERS })];
    expect(run(cycleWorkouts, cycleWorkouts)).toHaveLength(0);
  });

  it("a milestone from outside the check-in period does not appear, even though it's in the cycle data", () => {
    const cycleWorkouts = [
      workout({ id: "lr-three-weeks-ago", scheduledDate: "2026-09-28", workoutType: "long", actualDistanceM: 20 * MILE_METERS }),
    ];
    // Nothing in the period itself -- the milestone workout is outside periodStart/periodEnd.
    expect(run([], cycleWorkouts)).toHaveLength(0);
  });
});

describe("ranking and the cap", () => {
  it(`caps at ${MAX_CHECKIN_PRAISE_CANDIDATES} candidates, ordered consistency, then execution, then milestone, dropping from the weakest tier first`, () => {
    const cycleWorkouts: CheckinPraiseWorkout[] = [
      // Consistency: all 3 completed.
      workout({ id: "c1", scheduledDate: "2026-10-19", workoutType: "easy", plannedDistanceM: 5 * MILE_METERS, actualDistanceM: 5 * MILE_METERS }),
      workout({ id: "c2", scheduledDate: "2026-10-20", workoutType: "easy", plannedDistanceM: 5 * MILE_METERS, actualDistanceM: 5 * MILE_METERS }),
      workout({ id: "c3", scheduledDate: "2026-10-21", workoutType: "easy", plannedDistanceM: 5 * MILE_METERS, actualDistanceM: 5 * MILE_METERS }),
      // Execution: two qualifying key sessions.
      workout({ id: "e1", scheduledDate: "2026-10-22", dayLabel: "Tempo", workoutType: "tempo", plannedDistanceM: 6 * MILE_METERS, actualDistanceM: 6 * MILE_METERS, plannedRpe: 7, actualRpe: 6 }),
      workout({ id: "e2", scheduledDate: "2026-10-23", dayLabel: "VO2", workoutType: "vo2", plannedDistanceM: 5 * MILE_METERS, actualDistanceM: 5 * MILE_METERS }),
      // Milestone: two qualifying facts (longest run + a first-of-type).
      workout({ id: "m1", scheduledDate: "2026-10-24", workoutType: "long", actualDistanceM: 16 * MILE_METERS }),
    ];
    const candidates = run(cycleWorkouts, cycleWorkouts);
    expect(candidates).toHaveLength(MAX_CHECKIN_PRAISE_CANDIDATES);
    expect(candidates.map((c) => c.category)).toEqual(["consistency", "execution", "execution"]);
    expect(candidates.some((c) => c.category === "milestone")).toBe(false);
  });
});

describe("empty case", () => {
  it("a sparse week (one easy completion, nothing else) yields zero candidates", () => {
    const workouts = [workout({ id: "only", scheduledDate: "2026-10-20", dayLabel: "Easy", workoutType: "easy", plannedDistanceM: 4 * MILE_METERS, actualDistanceM: 4 * MILE_METERS })];
    expect(run(workouts)).toEqual([]);
  });

  it("a fully missed week (nothing completed at all) yields zero candidates", () => {
    const workouts = [
      workout({ id: "1", scheduledDate: "2026-10-19", workoutType: "easy", plannedDistanceM: 5 * MILE_METERS }),
      workout({ id: "2", scheduledDate: "2026-10-21", workoutType: "tempo", plannedDistanceM: 6 * MILE_METERS, plannedRpe: 7 }),
    ];
    expect(run(workouts)).toEqual([]);
  });
});
