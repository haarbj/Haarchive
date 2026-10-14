-- A scheduled workout could only ever hold ONE pending Strava match
-- (unique(scheduled_workout_id)), so when an athlete ran twice in one day
-- and both activities matched the same scheduled workout, the second
-- activity processed by the sync loop's upsert silently overwrote the
-- first candidate's row (same onConflict target) before the athlete ever
-- saw it -- caught live: an athlete who ran twice on the same day said
-- "not this one" to the surviving candidate and the review UI just
-- disappeared, because dismissing it deleted the only row that existed,
-- even though a second, correct candidate genuinely existed on Strava.
--
-- Fixes this by letting more than one activity candidate exist per
-- workout (uniqueness now keyed on the pair, so a re-sync still just
-- refreshes an existing candidate's own data rather than duplicating it),
-- and by making "dismiss" a soft action (dismissed_at) instead of a hard
-- delete, so dismissing one candidate reveals any other real candidate
-- still on file instead of destroying the only row that existed. A
-- dismissed row is excluded from what the athlete sees and from what a
-- future re-sync would try to resurrect (see strava-actions.ts's upsert,
-- which never includes dismissed_at in its payload, so ON CONFLICT DO
-- UPDATE never clears it back to null).
alter table public.strava_pending_matches
  drop constraint strava_pending_matches_scheduled_workout_id_key,
  add column dismissed_at timestamptz,
  add constraint strava_pending_matches_workout_activity_key unique (scheduled_workout_id, strava_activity_id);
