import { describe, expect, it } from "vitest";

import type { CalendarWorkout } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/calendar-types";
import {
  publishedAssignedWorkoutsThisWeek,
  weeklyLoadEntriesFromAssignedWorkouts,
} from "@/lib/private-coaching/assigned-week-workouts";
import { computeWeeklyLoad } from "@/lib/private-coaching/weekly-load";
import { MILE_METERS } from "@/lib/race-distances";

function workout(overrides: Partial<CalendarWorkout> = {}): CalendarWorkout {
  return {
    id: "w-1",
    scheduledDate: "2026-10-20",
    title: "Easy run",
    workoutType: "easy",
    dayLabel: "Easy",
    sessionSlot: null,
    extras: [],
    notesFromCoach: null,
    plannedDistanceM: 6 * MILE_METERS,
    plannedDistanceMaxM: null,
    plannedDurationS: null,
    plannedDurationMaxS: null,
    plannedPaceSPerMi: null,
    plannedPaceMaxSPerMi: null,
    paceReference: null,
    pacePercentBasis: null,
    pacePercentMin: null,
    pacePercentMax: null,
    resolvedPaceMinSPerMi: null,
    resolvedPaceMaxSPerMi: null,
    paceReferenceSourceLabel: null,
    volumePercent: null,
    resolvedDistanceM: null,
    resolvedDistanceMaxM: null,
    resolvedDurationS: null,
    resolvedDurationMaxS: null,
    volumeSourceLabel: null,
    plannedHrBpm: null,
    plannedHrMaxBpm: null,
    plannedRpe: null,
    plannedRpeMax: null,
    steps: [],
    stepPaceReferences: [],
    publishedAt: "2026-10-18T00:00:00Z",
    completion: null,
    status: "scheduled",
    ...overrides,
  };
}

describe("publishedAssignedWorkoutsThisWeek", () => {
  it("flattens the date-keyed map and sorts the result by date", () => {
    const byDate = {
      "2026-10-22": [workout({ id: "w-wed", scheduledDate: "2026-10-22" })],
      "2026-10-20": [workout({ id: "w-mon", scheduledDate: "2026-10-20" })],
      "2026-10-21": [],
    };
    const result = publishedAssignedWorkoutsThisWeek(byDate);
    expect(result.map((w) => w.id)).toEqual(["w-mon", "w-wed"]);
  });

  it("excludes an unpublished draft -- a coach's draft must stay invisible to the athlete", () => {
    const byDate = {
      "2026-10-20": [
        workout({ id: "w-published", status: "scheduled", publishedAt: "2026-10-18T00:00:00Z" }),
        workout({ id: "w-draft", status: "draft", publishedAt: null }),
      ],
    };
    const result = publishedAssignedWorkoutsThisWeek(byDate);
    expect(result.map((w) => w.id)).toEqual(["w-published"]);
  });

  it("includes a completed workout -- completion must not hide it from the week list", () => {
    const byDate = {
      "2026-10-20": [
        workout({
          id: "w-done",
          status: "completed",
          completion: { actualDistanceM: 9000, actualDurationS: 2400, stravaActivityId: null, rpe: null, hasNotes: false, effortLevel: null },
        }),
      ],
    };
    const result = publishedAssignedWorkoutsThisWeek(byDate);
    expect(result.map((w) => w.id)).toEqual(["w-done"]);
  });

  it("returns an empty array for an empty week", () => {
    expect(publishedAssignedWorkoutsThisWeek({})).toEqual([]);
  });
});

describe("weeklyLoadEntriesFromAssignedWorkouts", () => {
  it("counts a scheduled workout's planned distance toward Scheduled, with nothing yet toward Completed", () => {
    const entries = weeklyLoadEntriesFromAssignedWorkouts([workout({ plannedDistanceM: 10 * MILE_METERS })]);
    expect(entries).toHaveLength(1);
    expect(entries[0].distanceM).toBe(10 * MILE_METERS);
    expect(entries[0].actualDistanceM).toBeNull();
  });

  it("counts a completed workout's actual distance toward Completed once logged", () => {
    const entries = weeklyLoadEntriesFromAssignedWorkouts([
      workout({
        plannedDistanceM: 10 * MILE_METERS,
        status: "completed",
        completion: { actualDistanceM: 9.5 * MILE_METERS, actualDurationS: 3000, stravaActivityId: null, rpe: null, hasNotes: false, effortLevel: null },
      }),
    ]);
    expect(entries[0].distanceM).toBe(10 * MILE_METERS);
    expect(entries[0].actualDistanceM).toBeCloseTo(9.5 * MILE_METERS, 0);
  });

  it("resolves a volume-percent workout's EFFECTIVE distance (reusing effectiveWorkoutVolume), not its raw planned fields", () => {
    const entries = weeklyLoadEntriesFromAssignedWorkouts([
      workout({
        plannedDistanceM: null,
        volumePercent: 50,
        resolvedDistanceM: 5 * MILE_METERS,
      }),
    ]);
    expect(entries[0].distanceM).toBe(5 * MILE_METERS);
  });

  it("returns an empty array for no assigned workouts, so computeWeeklyLoad reads a real, honest zero", () => {
    expect(weeklyLoadEntriesFromAssignedWorkouts([])).toEqual([]);
  });
});

describe("end to end: completing an assigned workout moves it from Scheduled to Completed", () => {
  it("the same workout, before and after completion, changes computeWeeklyLoad's Completed total while Scheduled stays the same", () => {
    const beforeCompletion = workout({ id: "w-1", plannedDistanceM: 8 * MILE_METERS, status: "scheduled", completion: null });
    const afterCompletion = workout({
      id: "w-1",
      plannedDistanceM: 8 * MILE_METERS,
      status: "completed",
      completion: { actualDistanceM: 8.2 * MILE_METERS, actualDurationS: 3300, stravaActivityId: null, rpe: null, hasNotes: false, effortLevel: null },
    });

    const before = computeWeeklyLoad(weeklyLoadEntriesFromAssignedWorkouts([beforeCompletion]), null);
    const after = computeWeeklyLoad(weeklyLoadEntriesFromAssignedWorkouts([afterCompletion]), null);

    expect(before.scheduledMileageM).toBe(Math.round(8 * MILE_METERS));
    expect(before.completedMileageM).toBe(0);

    expect(after.scheduledMileageM).toBe(before.scheduledMileageM);
    expect(after.completedMileageM).toBe(Math.round(8.2 * MILE_METERS));
  });
});
