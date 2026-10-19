import { describe, expect, it } from "vitest";
import {
  activityLocalDate,
  clusterActivitiesByStartTime,
  combineActivities,
  COMBINE_WINDOW_SECONDS,
  isRunningActivity,
  mapToWorkoutCompletion,
} from "@/lib/strava/map-activity";
import type { StravaActivity } from "@/lib/strava/types";

function activity(overrides: Partial<StravaActivity> = {}): StravaActivity {
  return {
    id: 12345678,
    name: "Morning Run",
    distance: 8046.7,
    moving_time: 2580,
    type: "Run",
    sport_type: "Run",
    start_date_local: "2026-07-08T06:15:00Z",
    average_heartrate: 152.3,
    ...overrides,
  };
}

describe("isRunningActivity", () => {
  it("accepts Run, TrailRun, and VirtualRun", () => {
    expect(isRunningActivity(activity({ sport_type: "Run" }))).toBe(true);
    expect(isRunningActivity(activity({ sport_type: "TrailRun" }))).toBe(true);
    expect(isRunningActivity(activity({ sport_type: "VirtualRun" }))).toBe(true);
  });

  it("rejects non-running activities", () => {
    expect(isRunningActivity(activity({ sport_type: "Ride" }))).toBe(false);
    expect(isRunningActivity(activity({ sport_type: "Swim" }))).toBe(false);
    expect(isRunningActivity(activity({ sport_type: "Walk" }))).toBe(false);
  });

  it("falls back to the legacy type field if sport_type is empty", () => {
    expect(isRunningActivity(activity({ sport_type: "", type: "Run" }))).toBe(true);
  });
});

describe("activityLocalDate", () => {
  it("takes the calendar date directly from start_date_local, no timezone conversion", () => {
    expect(activityLocalDate(activity({ start_date_local: "2026-07-08T06:15:00Z" }))).toBe("2026-07-08");
    expect(activityLocalDate(activity({ start_date_local: "2026-12-31T23:59:00Z" }))).toBe("2026-12-31");
  });
});

describe("mapToWorkoutCompletion", () => {
  it("rounds distance and time to whole numbers", () => {
    const result = mapToWorkoutCompletion(activity({ distance: 8046.72, moving_time: 2580.4 }));
    expect(result.actual_distance_m).toBe(8047);
    expect(result.actual_time_s).toBe(2580);
    expect(Number.isInteger(result.actual_distance_m)).toBe(true);
    expect(Number.isInteger(result.actual_time_s)).toBe(true);
  });

  it("rounds average heart rate when present", () => {
    const result = mapToWorkoutCompletion(activity({ average_heartrate: 152.3 }));
    expect(result.avg_hr).toBe(152);
  });

  it("is null for heart rate when the activity has none", () => {
    const result = mapToWorkoutCompletion(activity({ average_heartrate: undefined }));
    expect(result.avg_hr).toBeNull();
  });

  it("carries the Strava activity ID through for dedup", () => {
    const result = mapToWorkoutCompletion(activity({ id: 999888777 }));
    expect(result.strava_activity_id).toBe(999888777);
  });
});

describe("clusterActivitiesByStartTime", () => {
  it("combines 3 activities (warmup/main/cooldown) into a single cluster when all start within the window", () => {
    const warmup = activity({ id: 1, name: "Warmup", start_date_local: "2026-07-08T06:00:00" });
    const main = activity({ id: 2, name: "Workout", start_date_local: "2026-07-08T06:20:00" });
    const cooldown = activity({ id: 3, name: "Cooldown", start_date_local: "2026-07-08T07:10:00" });

    const clusters = clusterActivitiesByStartTime([cooldown, warmup, main]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].map((a) => a.id)).toEqual([1, 2, 3]); // sorted ascending by start time
  });

  it("combines 2 activities (warmup + workout, no separate cooldown) into a single cluster", () => {
    const warmup = activity({ id: 1, start_date_local: "2026-07-08T06:00:00" });
    const main = activity({ id: 2, start_date_local: "2026-07-08T06:15:00" });

    const clusters = clusterActivitiesByStartTime([warmup, main]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(2);
  });

  it("does NOT combine activities far apart in time (a 6am run and a separate 6pm run)", () => {
    const morning = activity({ id: 1, start_date_local: "2026-07-08T06:00:00" });
    const evening = activity({ id: 2, start_date_local: "2026-07-08T18:00:00" });

    const clusters = clusterActivitiesByStartTime([morning, evening]);

    expect(clusters).toHaveLength(2);
    expect(clusters[0]).toEqual([morning]);
    expect(clusters[1]).toEqual([evening]);
  });

  it("a single activity still forms its own one-activity cluster", () => {
    const solo = activity({ id: 1, start_date_local: "2026-07-08T06:00:00" });
    const clusters = clusterActivitiesByStartTime([solo]);
    expect(clusters).toEqual([[solo]]);
  });

  it("an empty activity list produces no clusters", () => {
    expect(clusterActivitiesByStartTime([])).toEqual([]);
  });

  it("anchors each cluster at its own first activity, so chained small gaps don't silently exceed the window", () => {
    // Each consecutive pair is 2h apart (within a naive "gap to previous"
    // check), but the first and third are 4h apart -- wider than the
    // default 3h window -- so the third activity must start its own
    // cluster rather than chaining onto the first two.
    const a = activity({ id: 1, start_date_local: "2026-07-08T06:00:00" });
    const b = activity({ id: 2, start_date_local: "2026-07-08T08:00:00" });
    const c = activity({ id: 3, start_date_local: "2026-07-08T10:00:00" });

    const clusters = clusterActivitiesByStartTime([a, b, c]);

    expect(clusters).toHaveLength(2);
    expect(clusters[0].map((x) => x.id)).toEqual([1, 2]);
    expect(clusters[1].map((x) => x.id)).toEqual([3]);
  });

  it("respects a custom window width", () => {
    const a = activity({ id: 1, start_date_local: "2026-07-08T06:00:00" });
    const b = activity({ id: 2, start_date_local: "2026-07-08T07:00:00" }); // 1h later

    expect(clusterActivitiesByStartTime([a, b], 30 * 60)).toHaveLength(2); // 30min window: too far apart
    expect(clusterActivitiesByStartTime([a, b], 2 * 60 * 60)).toHaveLength(1); // 2h window: combines
  });

  it("COMBINE_WINDOW_SECONDS defaults to 3 hours", () => {
    expect(COMBINE_WINDOW_SECONDS).toBe(3 * 60 * 60);
  });
});

describe("combineActivities", () => {
  it("sums distance and moving time across all activities in the cluster", () => {
    const warmup = activity({ id: 1, distance: 1000, moving_time: 600, average_heartrate: undefined });
    const main = activity({ id: 2, distance: 5000, moving_time: 1500, average_heartrate: undefined });
    const cooldown = activity({ id: 3, distance: 800, moving_time: 480, average_heartrate: undefined });

    const result = combineActivities([warmup, main, cooldown]);

    expect(result.actual_distance_m).toBe(1000 + 5000 + 800);
    expect(result.actual_time_s).toBe(600 + 1500 + 480);
  });

  it("stores the source activity IDs (oldest first) when combining 2+ activities", () => {
    const warmup = activity({ id: 11, start_date_local: "2026-07-08T06:00:00" });
    const main = activity({ id: 22, start_date_local: "2026-07-08T06:20:00" });

    const result = combineActivities([main, warmup]); // deliberately passed out of order

    expect(result.combinedActivities).not.toBeNull();
    expect(result.combinedActivities!.map((a) => a.id)).toEqual([11, 22]);
  });

  it("is null for combinedActivities when given a single activity (the uncombined shape)", () => {
    const solo = activity({ id: 1 });
    const result = combineActivities([solo]);
    expect(result.combinedActivities).toBeNull();
  });

  it("reproduces mapToWorkoutCompletion exactly for a single-activity cluster", () => {
    const solo = activity({ id: 42, distance: 8046.72, moving_time: 2580.4, average_heartrate: 152.3 });
    expect(combineActivities([solo])).toEqual({ ...mapToWorkoutCompletion(solo), combinedActivities: null });
  });

  it("uses the earliest activity's id as the cluster's own identity", () => {
    const warmup = activity({ id: 11, start_date_local: "2026-07-08T06:00:00" });
    const main = activity({ id: 22, start_date_local: "2026-07-08T06:20:00" });
    const cooldown = activity({ id: 33, start_date_local: "2026-07-08T07:00:00" });

    const result = combineActivities([cooldown, main, warmup]);
    expect(result.strava_activity_id).toBe(11);
  });

  it("weights average heart rate by each activity's moving time, ignoring activities with no HR data", () => {
    const main = activity({ distance: 1, moving_time: 1800, average_heartrate: 160 }); // 30 min @ 160
    const cooldown = activity({ distance: 1, moving_time: 600, average_heartrate: 120 }); // 10 min @ 120
    const noHr = activity({ distance: 1, moving_time: 300, average_heartrate: undefined });

    const result = combineActivities([main, cooldown, noHr]);

    // (160*1800 + 120*600) / (1800+600) = 150
    expect(result.avg_hr).toBe(150);
  });

  it("is null for avg_hr when none of the combined activities recorded heart rate", () => {
    const a = activity({ average_heartrate: undefined });
    const b = activity({ average_heartrate: undefined });
    expect(combineActivities([a, b]).avg_hr).toBeNull();
  });

  it("includes each activity's own name, distance, and duration in the breakdown for the review UI", () => {
    const warmup = activity({ id: 1, name: "Warmup", distance: 1000, moving_time: 600, start_date_local: "2026-07-08T06:00:00" });
    const main = activity({ id: 2, name: "Workout", distance: 5000, moving_time: 1500, start_date_local: "2026-07-08T06:20:00" });

    const result = combineActivities([warmup, main]);

    expect(result.combinedActivities).toEqual([
      { id: 1, name: "Warmup", distanceM: 1000, durationS: 600, startedAt: "2026-07-08T06:00:00" },
      { id: 2, name: "Workout", distanceM: 5000, durationS: 1500, startedAt: "2026-07-08T06:20:00" },
    ]);
  });
});
