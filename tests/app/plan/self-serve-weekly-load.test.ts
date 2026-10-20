import { describe, expect, it } from "vitest";

import { weeklyLoadEntriesFromSelfServeWorkouts } from "@/app/(app)/(protected)/plan/self-serve-weekly-load";
import { weeklyLoadEntriesFromAssignedWorkouts } from "@/lib/private-coaching/assigned-week-workouts";
import { computeWeeklyLoad } from "@/lib/private-coaching/weekly-load";
import type { WorkoutPrescription } from "@/lib/coaching-engine/types";
import type { CompletionDetail } from "@/app/(app)/(protected)/plan/completion-detail";
import type { CalendarWorkout } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/calendar-types";

const EASY: WorkoutPrescription = { kind: "easy", distanceM: 8000, paceRangeSecPerKm: [300, 320] };
const LONG: WorkoutPrescription = { kind: "long", distanceM: 24000, paceRangeSecPerKm: [310, 330] };

function completion(overrides: Partial<CompletionDetail> = {}): CompletionDetail {
  return { actual_distance_m: null, actual_time_s: null, rpe: null, avg_hr: null, notes: null, ...overrides };
}

function assignedWorkout(overrides: Partial<CalendarWorkout> = {}): CalendarWorkout {
  return {
    id: "assigned-1",
    scheduledDate: "2026-10-19",
    title: "Tempo run",
    workoutType: "tempo",
    dayLabel: "Tempo",
    sessionSlot: null,
    extras: [],
    notesFromCoach: null,
    plannedDistanceM: 9600,
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
    publishedAt: "2026-10-01T00:00:00Z",
    completion: null,
    status: "scheduled",
    ...overrides,
  };
}

describe("weeklyLoadEntriesFromSelfServeWorkouts", () => {
  it("maps a self-created workout's prescription distance into a WeeklyLoadEntry, with no dayLabel (never counts as XT)", () => {
    const entries = weeklyLoadEntriesFromSelfServeWorkouts([{ id: "w-1", prescription: EASY }], new Map());
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ dayLabel: null, distanceM: 8000, durationS: null, actualDistanceM: null, actualDurationS: null });
  });

  it("pulls actual distance/time from the completion map when one exists for that workout id", () => {
    const completions = new Map([["w-1", completion({ actual_distance_m: 8200, actual_time_s: 2500 })]]);
    const entries = weeklyLoadEntriesFromSelfServeWorkouts([{ id: "w-1", prescription: EASY }], completions);
    expect(entries[0].actualDistanceM).toBe(8200);
    expect(entries[0].actualDurationS).toBe(2500);
  });

  it("gives a null distance (never fabricated) for a workout whose prescription doesn't parse", () => {
    const entries = weeklyLoadEntriesFromSelfServeWorkouts([{ id: "w-1", prescription: { kind: "not-a-real-kind" } }], new Map());
    expect(entries[0].distanceM).toBeNull();
  });

  it("handles several self-created workouts in one call, each via its own prescription", () => {
    const entries = weeklyLoadEntriesFromSelfServeWorkouts(
      [{ id: "w-1", prescription: EASY }, { id: "w-2", prescription: LONG }],
      new Map(),
    );
    expect(entries.map((e) => e.distanceM)).toEqual([8000, 24000]);
  });
});

describe("Weekly Load reflects assigned + self-created totals together (not assigned-only)", () => {
  it("combines a self-created workout's scheduled distance with an assigned workout's scheduled distance in one computeWeeklyLoad call", () => {
    const selfEntries = weeklyLoadEntriesFromSelfServeWorkouts([{ id: "w-1", prescription: EASY }], new Map());
    const assignedEntries = weeklyLoadEntriesFromAssignedWorkouts([assignedWorkout()]);
    const result = computeWeeklyLoad([...selfEntries, ...assignedEntries], null);
    expect(result.scheduledMileageM).toBe(8000 + 9600);
  });

  it("completing an assigned workout is reflected in the combined completed mileage, without disturbing the self-created side", () => {
    const selfEntries = weeklyLoadEntriesFromSelfServeWorkouts(
      [{ id: "w-1", prescription: EASY }],
      new Map([["w-1", completion({ actual_distance_m: 8100 })]]),
    );
    const assignedEntries = weeklyLoadEntriesFromAssignedWorkouts([
      assignedWorkout({
        status: "completed",
        completion: { actualDistanceM: 9700, actualDurationS: null, stravaActivityId: null, rpe: null, hasNotes: false, effortLevel: null },
      }),
    ]);
    const result = computeWeeklyLoad([...selfEntries, ...assignedEntries], null);
    expect(result.completedMileageM).toBe(8100 + 9700);
    // The self-created entry's own completion is untouched by the assigned
    // workout's completion -- each entry carries only its own actuals.
    expect(selfEntries[0].actualDistanceM).toBe(8100);
  });

  it("an all-self-created week (no assigned workouts at all) still produces a real total -- the gap this fix closes", () => {
    const selfEntries = weeklyLoadEntriesFromSelfServeWorkouts([{ id: "w-1", prescription: LONG }], new Map());
    const result = computeWeeklyLoad([...selfEntries, ...weeklyLoadEntriesFromAssignedWorkouts([])], null);
    expect(result.scheduledMileageM).toBe(24000);
  });
});
