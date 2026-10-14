-- Pace, heart rate, and RPE join distance/duration as the remaining ways
-- to specify a session's intended target -- grounded in Data & Analytics'
-- "Three Layers of Measurement": external workload (pace, distance),
-- physiological response (heart rate), and perceived effort (RPE), none
-- of which alone tells the whole story. Distance, duration, and pace are
-- mathematically linked (pace = duration / distance) and kept
-- automatically consistent by the UI (see workout-distance.ts's
-- autoCompleteWorkoutTargets) rather than by a DB-level cross-column
-- check -- a strict equality constraint would fight normal float/rounding
-- drift between the three. Heart rate and RPE are independent target
-- ranges alongside them, not derived from anything.
--
-- Each pair mirrors planned_distance_m/_max_m and planned_duration_s/
-- _max_s exactly: nullable, min-only is a point value, min+max is a
-- range. RPE reuses the same 1-10 bound as every other rpe column in this
-- schema (see completed_workouts.rpe, workout_template_steps.rpe).
alter table public.scheduled_workouts
  add column planned_pace_s_per_mi int,
  add column planned_pace_max_s_per_mi int,
  add column planned_hr_bpm int,
  add column planned_hr_max_bpm int,
  add column planned_rpe int check (planned_rpe between 1 and 10),
  add column planned_rpe_max int check (planned_rpe_max between 1 and 10);

alter table public.scheduled_workouts
  add constraint scheduled_workouts_pace_range_valid check (
    planned_pace_max_s_per_mi is null
    or (planned_pace_s_per_mi is not null and planned_pace_max_s_per_mi >= planned_pace_s_per_mi)
  ),
  add constraint scheduled_workouts_hr_range_valid check (
    planned_hr_max_bpm is null
    or (planned_hr_bpm is not null and planned_hr_max_bpm >= planned_hr_bpm)
  ),
  add constraint scheduled_workouts_rpe_range_valid check (
    planned_rpe_max is null
    or (planned_rpe is not null and planned_rpe_max >= planned_rpe)
  );
