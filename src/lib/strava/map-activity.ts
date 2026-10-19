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

// --- Multi-activity combining (private coaching) ---------------------------
//
// An athlete who hits stop/save between a warmup, main set, and cooldown
// produces several separate Strava activities for what the coach assigned
// as one combined session. Private coaching's matching pass (see
// strava-actions.ts) clusters same-date activities by start time before
// building a pending-match candidate, so the athlete reviews ONE combined
// suggestion instead of three competing ones.

// Activities on the same calendar date starting within this many seconds
// of each other are treated as parts of one session; a wider gap (an easy
// 6am run and a separate evening workout, say) keeps them as distinct
// candidates instead. 3 hours comfortably covers a warmup/main-set/cooldown
// split into separate recordings (even with a long break between segments)
// without being wide enough to accidentally fuse two genuinely different
// runs on the same day -- a tunable product choice, not a measured
// physiological constant, hence a named constant rather than a magic
// number inline.
export const COMBINE_WINDOW_SECONDS = 3 * 60 * 60;

export type ActivityCluster = StravaActivity[];

// Groups activities (already filtered to one athlete's one calendar date)
// into clusters that likely represent one combined session vs. genuinely
// separate runs. Each cluster is anchored at its own earliest activity:
// sorted ascending by start time, a later activity joins the current
// cluster as long as it starts within `windowSeconds` of that cluster's
// first activity, otherwise it starts a new cluster. Anchoring on the
// cluster's first activity (rather than the immediately preceding one)
// avoids "chaining" -- three activities each ~2h apart from their neighbor
// would otherwise span 4h total despite no single gap exceeding the
// window.
export function clusterActivitiesByStartTime(activities: StravaActivity[], windowSeconds: number = COMBINE_WINDOW_SECONDS): ActivityCluster[] {
  const sorted = [...activities].sort((a, b) => Date.parse(a.start_date_local) - Date.parse(b.start_date_local));
  const clusters: ActivityCluster[] = [];
  let current: StravaActivity[] = [];

  for (const activity of sorted) {
    if (current.length === 0) {
      current = [activity];
      continue;
    }
    const anchorMs = Date.parse(current[0].start_date_local);
    const activityMs = Date.parse(activity.start_date_local);
    if ((activityMs - anchorMs) / 1000 <= windowSeconds) {
      current.push(activity);
    } else {
      clusters.push(current);
      current = [activity];
    }
  }
  if (current.length > 0) clusters.push(current);
  return clusters;
}

export type CombinedActivitySummary = {
  id: number;
  name: string;
  distanceM: number;
  durationS: number;
  startedAt: string;
};

export type CombinedWorkoutCompletionFields = WorkoutCompletionFields & {
  /** Null for a single, uncombined activity (the pre-existing shape, unchanged for that case). Set, oldest first, only when this candidate represents 2+ combined activities. */
  combinedActivities: CombinedActivitySummary[] | null;
};

// Builds one candidate's worth of completion fields from a cluster of 1+
// same-session activities: summed distance/time (the combined session's
// real totals), a moving-time-weighted average heart rate across whichever
// member activities recorded one (so a long main set's HR isn't diluted
// equally by a short, low-effort cooldown's), and the earliest activity's
// id as the candidate's own identity (what the (scheduled_workout_id,
// strava_activity_id) unique constraint keys a re-sync's upsert on).
// combineActivities([activity]) reproduces mapToWorkoutCompletion(activity)
// exactly, with combinedActivities: null -- the single-activity path is a
// special case of this one, not a separately maintained code path.
export function combineActivities(cluster: StravaActivity[]): CombinedWorkoutCompletionFields {
  const sorted = [...cluster].sort((a, b) => Date.parse(a.start_date_local) - Date.parse(b.start_date_local));
  const totalDistanceM = sorted.reduce((sum, a) => sum + a.distance, 0);
  const totalDurationS = sorted.reduce((sum, a) => sum + a.moving_time, 0);

  const withHr = sorted.filter((a) => a.average_heartrate);
  const hrWeightedDurationS = withHr.reduce((sum, a) => sum + a.moving_time, 0);
  const avgHr =
    withHr.length > 0 && hrWeightedDurationS > 0
      ? Math.round(withHr.reduce((sum, a) => sum + a.average_heartrate! * a.moving_time, 0) / hrWeightedDurationS)
      : null;

  return {
    actual_distance_m: Math.round(totalDistanceM),
    actual_time_s: Math.round(totalDurationS),
    avg_hr: avgHr,
    strava_activity_id: sorted[0].id,
    combinedActivities:
      sorted.length > 1
        ? sorted.map((a) => ({
            id: a.id,
            name: a.name,
            distanceM: Math.round(a.distance),
            durationS: Math.round(a.moving_time),
            startedAt: a.start_date_local,
          }))
        : null,
  };
}
