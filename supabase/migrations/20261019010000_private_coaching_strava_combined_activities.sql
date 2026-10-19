-- Multi-activity Strava matching: an athlete who hits stop/save between a
-- warmup, main set, and cooldown produces three separate Strava activities
-- for what the coach assigned as one combined session. strava-actions.ts's
-- sync now clusters same-date activities by start time and can suggest one
-- combined candidate instead of three competing ones -- see
-- lib/strava/map-activity.ts's clusterActivitiesByStartTime/combineActivities
-- and strava-match-review.tsx's rendering of the breakdown.
--
-- Neither existing table could hold more than one source activity:
-- strava_pending_matches.strava_activity_id and
-- completed_workouts.strava_activity_id are both single bigints (the
-- latter unique-keyed on scheduled_workout_id already, so a real migration
-- is needed here, not just an application-side workaround).
--
-- strava_pending_matches.combined_activities: null for an ordinary single-
-- activity candidate (every existing row, and every still-single-activity
-- candidate going forward) -- the review UI's existing single-card
-- rendering is unchanged for that case. Set to a JSON array of
-- {id, name, distanceM, durationS, startedAt} (one entry per source
-- activity, oldest first) only when a candidate represents >= 2 combined
-- activities; the row's own scalar activity_distance_m/activity_duration_s
-- already hold the combined totals (sum of each), and strava_activity_id
-- holds the cluster's earliest activity's id, which is what the existing
-- (scheduled_workout_id, strava_activity_id) unique constraint keys a
-- re-sync's upsert on.
alter table public.strava_pending_matches
  add column combined_activities jsonb;

-- completed_workouts.strava_activity_id stays as the single "primary"
-- (earliest) source activity -- AerobicDecouplingCheck and every other
-- existing reader of this column keeps working unchanged, just reflecting
-- the first segment of a combined session rather than the whole thing.
-- strava_activity_ids is the full, auditable source-activity list:
-- null for a manually-logged or single-activity-Strava completion (so
-- `strava_activity_ids is not null` cleanly identifies a combined one),
-- populated by approveStravaMatch only when the approved pending match
-- was itself a combined candidate.
alter table public.completed_workouts
  add column strava_activity_ids bigint[];
