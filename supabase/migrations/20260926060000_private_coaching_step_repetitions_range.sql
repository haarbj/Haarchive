-- A structured step's repetition count and rest interval were point-only
-- ("6 x 3 min w/ 1 min jog") -- several of Canyon's own real workouts
-- prescribe a rep-count or rest RANGE instead ("6-7 x 3 min w/ 1 min jog",
-- "10-12 x 500m w/ 30-45 sec walk"), the same "coach can't say the range"
-- gap duration_max_s/distance_max_m already fixed for a step's own
-- duration/distance (see the step_ranges migration this mirrors exactly).
-- Same nullable, min-only-is-a-point-value, min+max-is-a-range shape, same
-- range CHECK pattern, applied to all three step tables that already carry
-- repetitions/rest_s (program_day_steps, workout_template_steps,
-- scheduled_workout_steps).
alter table public.program_day_steps
  add column repetitions_max int,
  add column rest_max_s int;
alter table public.program_day_steps
  add constraint program_day_steps_repetitions_range_valid check (
    repetitions_max is null or (repetitions is not null and repetitions_max >= repetitions)
  ),
  add constraint program_day_steps_rest_range_valid check (
    rest_max_s is null or (rest_s is not null and rest_max_s >= rest_s)
  );

alter table public.workout_template_steps
  add column repetitions_max int,
  add column rest_max_s int;
alter table public.workout_template_steps
  add constraint workout_template_steps_repetitions_range_valid check (
    repetitions_max is null or (repetitions is not null and repetitions_max >= repetitions)
  ),
  add constraint workout_template_steps_rest_range_valid check (
    rest_max_s is null or (rest_s is not null and rest_max_s >= rest_s)
  );

alter table public.scheduled_workout_steps
  add column repetitions_max int,
  add column rest_max_s int;
alter table public.scheduled_workout_steps
  add constraint scheduled_workout_steps_repetitions_range_valid check (
    repetitions_max is null or (repetitions is not null and repetitions_max >= repetitions)
  ),
  add constraint scheduled_workout_steps_rest_range_valid check (
    rest_max_s is null or (rest_s is not null and rest_max_s >= rest_s)
  );
