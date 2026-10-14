-- Round 2, Part A: Volume-as-%-of-week. Same live-reference philosophy as
-- pace_reference (20260827100000) -- a day's distance/duration is expressed
-- as a percent of that week's own training_week_plans target, re-resolved
-- live every time it's displayed rather than baked into a stored number at
-- save time. Workout-level only (no step-level equivalent): a step's own
-- distance/duration ranges are about structuring a single session, not
-- about the week's overall volume.
alter table public.scheduled_workouts add column planned_volume_percent numeric;
alter table public.scheduled_workouts
  add constraint scheduled_workouts_volume_percent_exclusive check (
    planned_volume_percent is null or (
      planned_distance_m is null and planned_distance_max_m is null
      and planned_duration_s is null and planned_duration_max_s is null
    )
  );

alter table public.workout_templates add column planned_volume_percent numeric;
alter table public.workout_templates
  add constraint workout_templates_volume_percent_exclusive check (
    planned_volume_percent is null or (
      planned_distance_m is null and planned_distance_max_m is null
      and planned_duration_s is null and planned_duration_max_s is null
    )
  );

-- Round 2, Part B: a coach's own preference for whether the Weekly Load
-- footer's primary figure reads in miles or minutes -- same text-column,
-- null-means-the-default pattern as coach_display_name/coach_bio
-- (20260826010000/20260826040000), and the same null-means-miles default
-- training_week_plans.target_volume_unit already uses.
alter table public.profiles add column coach_default_volume_unit text check (coach_default_volume_unit in ('miles', 'minutes'));
