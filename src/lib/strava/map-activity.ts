import type { StravaActivity } from "@/lib/strava/types";

// Pure transformation/filtering logic, kept separate from the actual
// network calls in client.ts so it's testable with plain fixture data --
// no real Strava account needed to verify this part works correctly.

const RUNNING_SPORT_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

export function isRunningActivity(activity: StravaActivity): boolean {
  return RUNNING_SPORT_TYPES.has(activity.sport_type || activity.type);
}

// start_date_local is already in the athlete's own local time (unlike
// start_date, which is UTC) -- the calendar date is just its first 10
// characters, no timezone math needed.
export function activityLocalDate(activity: StravaActivity): string {
  return activity.start_date_local.slice(0, 10);
}

export type WorkoutCompletionFields = {
  actual_distance_m: number;
  actual_time_s: number;
  avg_hr: number | null;
  strava_activity_id: number;
};

export function mapToWorkoutCompletion(activity: StravaActivity): WorkoutCompletionFields {
  return {
    actual_distance_m: Math.round(activity.distance),
    // moving_time, not elapsed_time -- deliberate: elapsed_time counts
    // whatever Strava's auto-pause skipped (a traffic light, an aid
    // station, a dropped GPS signal) against actual_time_s, which drags
    // actual pace down with time the runner wasn't actually running.
    actual_time_s: Math.round(activity.moving_time),
    avg_hr: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
    strava_activity_id: activity.id,
  };
}
