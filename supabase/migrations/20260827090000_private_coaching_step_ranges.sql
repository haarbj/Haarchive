-- A structured step's own distance/duration was point-only ("1 mile
-- cooldown," "15 minutes warmup") -- a coach who genuinely means "1-2
-- miles" or "15-20 minutes" had no way to say the range, unlike the
-- workout-level planned_distance_m/_max_m and planned_duration_s/_max_s
-- pair this exactly mirrors. Same nullable, min-only-is-a-point-value,
-- min+max-is-a-range shape, same range CHECK pattern as
-- scheduled_workouts_pace_range_valid etc. (see the planned_pace_hr_rpe
-- migration).
alter table public.workout_template_steps
  add column duration_max_s int,
  add column distance_max_m numeric;
alter table public.workout_template_steps
  add constraint workout_template_steps_duration_range_valid check (
    duration_max_s is null or (duration_s is not null and duration_max_s >= duration_s)
  ),
  add constraint workout_template_steps_distance_range_valid check (
    distance_max_m is null or (distance_m is not null and distance_max_m >= distance_m)
  );

alter table public.scheduled_workout_steps
  add column duration_max_s int,
  add column distance_max_m numeric;
alter table public.scheduled_workout_steps
  add constraint scheduled_workout_steps_duration_range_valid check (
    duration_max_s is null or (duration_s is not null and duration_max_s >= duration_s)
  ),
  add constraint scheduled_workout_steps_distance_range_valid check (
    distance_max_m is null or (distance_m is not null and distance_max_m >= distance_m)
  );
