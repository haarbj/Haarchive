-- The calendar rebuild (coach-facing weekly planning surface) needs a
-- top-level planned distance so a simple workout ("Easy 6 mi") can show a
-- number without forcing the coach through the structured steps editor --
-- today distance only exists per scheduled_workout_step. Nullable and
-- additive: existing rows/queries are unaffected, and a structured
-- workout with no top-level distance simply falls back to its existing
-- step-summary text (see src/lib/private-coaching/workout-distance.ts).
alter table public.scheduled_workouts add column planned_distance_m numeric;
