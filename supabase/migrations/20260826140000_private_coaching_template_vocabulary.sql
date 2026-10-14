-- Templates predate the prescription-vocabulary work (AM/PM, mileage/
-- duration/pace ranges, HR, RPE, extras) and could only carry a name, the
-- old workout_type enum, a description, and steps -- a coach couldn't
-- build a real "Long Run" template that actually prefilled a mileage
-- range, since the column didn't exist. This closes that gap so templates
-- are a genuine fast on-ramp for the current model, not just the old one.
-- Mirrors scheduled_workouts' own columns and CHECK constraints exactly
-- (see the planned-distance/duration/pace-hr-rpe migrations) so a
-- template and the workout it produces speak the identical vocabulary.
--
-- day_label itself is NOT added here -- the day-vocabulary migration
-- (20260826070000) already added it to workout_templates ahead of the app
-- layer catching up to use it; this migration is that catch-up for
-- everything else.
alter table public.workout_templates
  add column session_slot text,
  add column planned_distance_m numeric,
  add column planned_distance_max_m numeric,
  add column planned_duration_s int,
  add column planned_duration_max_s int,
  add column planned_pace_s_per_mi int,
  add column planned_pace_max_s_per_mi int,
  add column planned_hr_bpm int,
  add column planned_hr_max_bpm int,
  add column planned_rpe int check (planned_rpe between 1 and 10),
  add column planned_rpe_max int check (planned_rpe_max between 1 and 10);

alter table public.workout_templates
  add constraint workout_templates_distance_range_valid check (
    planned_distance_max_m is null
    or (planned_distance_m is not null and planned_distance_max_m >= planned_distance_m)
  ),
  add constraint workout_templates_duration_range_valid check (
    planned_duration_max_s is null
    or (planned_duration_s is not null and planned_duration_max_s >= planned_duration_s)
  ),
  add constraint workout_templates_pace_range_valid check (
    planned_pace_max_s_per_mi is null
    or (planned_pace_s_per_mi is not null and planned_pace_max_s_per_mi >= planned_pace_s_per_mi)
  ),
  add constraint workout_templates_hr_range_valid check (
    planned_hr_max_bpm is null
    or (planned_hr_bpm is not null and planned_hr_max_bpm >= planned_hr_bpm)
  ),
  add constraint workout_templates_rpe_range_valid check (
    planned_rpe_max is null
    or (planned_rpe is not null and planned_rpe_max >= planned_rpe)
  );

-- Mirrors scheduled_workout_extras exactly (see the structured-extras
-- migration) -- a template's own fixed extras, copied into a real
-- scheduled_workout_extras row the same way steps already are, the
-- moment a coach applies this template.
create table public.workout_template_extras (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  extra_order int not null,
  kind text not null,
  overview text,
  count int,
  distance_m numeric,
  duration_s int,
  items text[]
);
alter table public.workout_template_extras enable row level security;

-- Coach-only, own library -- verbatim mirror of workout_template_steps_
-- all_own's shape (same migration, join through the parent template).
create policy "workout_template_extras_all_own" on public.workout_template_extras
  for all to authenticated using (
    exists (select 1 from public.workout_templates t where t.id = template_id and t.coach_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.workout_templates t where t.id = template_id and t.coach_id = (select auth.uid()))
  );
