-- When a coach schedules "XT" without picking a modality (see
-- SUGGESTED_XT_TYPES/splitDayLabel in day-type-visuals.ts -- the coach's
-- own optional Pool/Bike/Elliptical picker), the athlete had no way to
-- say what they actually did: the completion form only ever asked for
-- distance/duration/HR/RPE, none of which say "it was the bike, not a
-- run." This column is that athlete-reported answer, asked for on the
-- completion form only when the workout's own day_label is a bare "XT"
-- with no modality already attached -- a coach who DID pick one (day_label
-- "XT (Bike)") doesn't need to ask the athlete to repeat it.
alter table public.completed_workouts add column activity_type text;
