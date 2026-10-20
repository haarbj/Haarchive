import { describe, expect, it } from "vitest";

import { buildPaceRowsFromWorkouts } from "@/app/(app)/(protected)/coaching/your-plan/data";
import type { CalendarWorkout } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/calendar-types";

// "Your paces" (the payoff view) is built directly from the SAME
// resolved CalendarWorkout fields the coaching schedule itself renders
// from (calendar-data.ts's own resolvePaceReference/resolvePacePercent
// calls) -- never a second resolution path. These tests assert the
// pass-through is exact: whatever resolvedPaceMinSPerMi/MaxSPerMi the
// schedule would show for a given workout is exactly what shows up here,
// which is what makes "no drift between the payoff and the schedule"
// true by construction rather than by two call sites happening to agree.

function workout(overrides: Partial<CalendarWorkout> = {}): CalendarWorkout {
  return {
    id: "w-1",
    scheduledDate: "2026-10-19",
    title: "Easy run",
    workoutType: "easy",
    dayLabel: "Easy",
    sessionSlot: null,
    extras: [],
    notesFromCoach: null,
    plannedDistanceM: 8000,
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

describe("buildPaceRowsFromWorkouts", () => {
  it("renders exactly the resolved pace-reference figures the schedule itself would show, verbatim", () => {
    const rows = buildPaceRowsFromWorkouts([
      workout({
        paceReference: "easy",
        resolvedPaceMinSPerMi: 525, // 8:45/mi
        resolvedPaceMaxSPerMi: 555, // 9:15/mi
        paceReferenceSourceLabel: "Peachtree 10K · Jul 4, 2026",
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe("Easy Pace");
    expect(rows[0].rangeText).toBe("8:45-9:15/mi");
    expect(rows[0].sourceLabel).toBe("Peachtree 10K · Jul 4, 2026");
  });

  it("renders a percent-of-basis workout with its resolved figures, not the raw percent alone", () => {
    const rows = buildPaceRowsFromWorkouts([
      workout({
        pacePercentBasis: "marathon",
        pacePercentMin: 90,
        pacePercentMax: 95,
        resolvedPaceMinSPerMi: 450,
        resolvedPaceMaxSPerMi: 474,
        paceReferenceSourceLabel: "90-95% Marathon Pace (est. 3:10:00)",
      }),
    ]);
    expect(rows[0].label).toBe("90-95% Marathon Pace");
    expect(rows[0].rangeText).toBe("7:30-7:54/mi");
  });

  it("deduplicates repeated references across the week into one row", () => {
    const rows = buildPaceRowsFromWorkouts([
      workout({ id: "w-1", paceReference: "easy", resolvedPaceMinSPerMi: 525, resolvedPaceMaxSPerMi: 555 }),
      workout({ id: "w-2", scheduledDate: "2026-10-21", paceReference: "easy", resolvedPaceMinSPerMi: 525, resolvedPaceMaxSPerMi: 555 }),
    ]);
    expect(rows).toHaveLength(1);
  });

  it("skips a workout with no resolved pace at all -- never fabricates a row", () => {
    const rows = buildPaceRowsFromWorkouts([workout({ paceReference: "easy", resolvedPaceMinSPerMi: null })]);
    expect(rows).toHaveLength(0);
  });

  it("every row carries a one-line why from the shared PACE_BAND_WHY lookup", () => {
    const rows = buildPaceRowsFromWorkouts([workout({ paceReference: "marathon", resolvedPaceMinSPerMi: 450, resolvedPaceMaxSPerMi: null })]);
    expect(rows[0].why).not.toBeNull();
    expect(rows[0].why!.length).toBeGreaterThan(10);
  });
});
