-- Round 1: Dynamic Pace Reference. A closed, code-defined vocabulary (not
-- coach-typed text like day_label), matching workout_step_type/
-- workout_target_type's own enum precedent. Values mirror PaceZoneKey
-- (easy/steady/tempo/interval, see coaching-engine/pace-zones.ts) for the
-- zone-based four, and race-distances.ts's own RACE_DISTANCES keys for the
-- race-equivalent four -- reusing that catalog's naming rather than
-- inventing a second one.
--
-- Unrelated to (and does not touch) athlete_metrics/@athlete.<key>
-- variable substitution (resolveAthleteVariables in schedule/actions.ts),
-- which resolves once and bakes the result into stored instructions text
-- at save time. A pace_reference is the deliberate opposite: it is never
-- resolved into a stored number at all -- the reference itself is the
-- persisted value, re-resolved live from the athlete's most recent
-- race_results row every time it's displayed. Mutual exclusivity with the
-- existing literal pace columns is enforced below so there is never a
-- stale cached number sitting alongside a reference.
create type public.pace_reference as enum (
  'easy', 'steady', 'tempo', 'interval',
  '5k', '10k', 'half', 'marathon'
);

alter table public.scheduled_workouts add column pace_reference public.pace_reference;
alter table public.scheduled_workouts
  add constraint scheduled_workouts_pace_reference_exclusive check (
    pace_reference is null or (planned_pace_s_per_mi is null and planned_pace_max_s_per_mi is null)
  );

alter table public.workout_templates add column pace_reference public.pace_reference;
alter table public.workout_templates
  add constraint workout_templates_pace_reference_exclusive check (
    pace_reference is null or (planned_pace_s_per_mi is null and planned_pace_max_s_per_mi is null)
  );

-- Named target_pace_reference (not pace_reference) -- steps already share
-- one generic target_min/target_max/target_type/target_unit shape across
-- pace/HR/power/RPE; this column only ever applies when target_type =
-- 'pace'.
alter table public.scheduled_workout_steps add column target_pace_reference public.pace_reference;
alter table public.scheduled_workout_steps
  add constraint scheduled_workout_steps_pace_reference_exclusive check (
    target_pace_reference is null or (target_min is null and target_max is null)
  ),
  add constraint scheduled_workout_steps_pace_reference_type_valid check (
    target_pace_reference is null or target_type = 'pace'
  );

alter table public.workout_template_steps add column target_pace_reference public.pace_reference;
alter table public.workout_template_steps
  add constraint workout_template_steps_pace_reference_exclusive check (
    target_pace_reference is null or (target_min is null and target_max is null)
  ),
  add constraint workout_template_steps_pace_reference_type_valid check (
    target_pace_reference is null or target_type = 'pace'
  );
