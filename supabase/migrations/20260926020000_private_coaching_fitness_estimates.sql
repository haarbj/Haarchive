-- An athlete's own, self-reported CURRENT fitness estimate (e.g. "I think
-- I could run a 15:57 5K right now") -- distinct from race_results, which
-- is a completed, dated race result. One mutable row per (athlete,
-- reference_key): "your current 5K estimate," not an ever-growing history
-- list the athlete has to manage themselves. An athlete updates it
-- whenever their fitness genuinely changes (a coach's own program notes
-- may cue this, e.g. "revise your current fitness estimate" at the end of
-- a training block), and every not-yet-completed pace-percent-based
-- prescription downstream re-resolves against the current value the next
-- time it's read -- never retroactively touching a workout that's already
-- been completed. Full CRUD by the athlete themselves, read-only for their
-- coach via the same coaches_this_athlete() helper race_results/injuries/
-- athlete_profiles already use.
create table public.athlete_fitness_estimates (
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  reference_key public.pace_reference not null,
  estimated_time_s int not null check (estimated_time_s > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (athlete_id, reference_key)
);

alter table public.athlete_fitness_estimates enable row level security;

create policy "athlete_fitness_estimates_select_own" on public.athlete_fitness_estimates
  for select to authenticated using ((select auth.uid()) = athlete_id);
create policy "athlete_fitness_estimates_insert_own" on public.athlete_fitness_estimates
  for insert to authenticated with check ((select auth.uid()) = athlete_id);
create policy "athlete_fitness_estimates_update_own" on public.athlete_fitness_estimates
  for update to authenticated using ((select auth.uid()) = athlete_id) with check ((select auth.uid()) = athlete_id);
create policy "athlete_fitness_estimates_delete_own" on public.athlete_fitness_estimates
  for delete to authenticated using ((select auth.uid()) = athlete_id);
create policy "athlete_fitness_estimates_select_private_coach" on public.athlete_fitness_estimates
  for select to authenticated using (public.coaches_this_athlete(athlete_id));

-- The live-resolving counterpart of program_days'/program_day_steps' own
-- pace_percent_basis/min/max on the two tables an ASSIGNED workout
-- actually lives in. Mirrors those two tables' exact column definitions
-- and CHECK constraints (requires-basis / mutually-exclusive-with-a-
-- literal-pace-or-pace_reference / range-valid), for the identical reason
-- pace_reference itself is never resolved until read time: a percent-of-
-- pace prescription assigned from a Program is no longer a one-time
-- resolution baked in at assignment (the prior design, see this table's
-- own removed comment) -- it now resolves live against the athlete's most
-- recent fitness estimate every time it's read, exactly like
-- pace_reference already does, so an athlete's mid-plan fitness-estimate
-- update is reflected in every not-yet-completed workout automatically.
alter table public.scheduled_workouts
  add column pace_percent_basis public.pace_reference,
  add column pace_percent_min numeric,
  add column pace_percent_max numeric;
alter table public.scheduled_workouts
  add constraint scheduled_workouts_pace_percent_requires_basis check (
    (pace_percent_min is null and pace_percent_max is null) or pace_percent_basis is not null
  ),
  add constraint scheduled_workouts_pace_percent_exclusive check (
    pace_percent_basis is null or (pace_reference is null and planned_pace_s_per_mi is null and planned_pace_max_s_per_mi is null)
  ),
  add constraint scheduled_workouts_pace_percent_range_valid check (
    pace_percent_max is null or (pace_percent_min is not null and pace_percent_max >= pace_percent_min)
  );

alter table public.scheduled_workout_steps
  add column target_pace_percent_basis public.pace_reference,
  add column target_pace_percent_min numeric,
  add column target_pace_percent_max numeric;
alter table public.scheduled_workout_steps
  add constraint scheduled_workout_steps_pace_percent_requires_basis check (
    (target_pace_percent_min is null and target_pace_percent_max is null) or target_pace_percent_basis is not null
  ),
  add constraint scheduled_workout_steps_pace_percent_exclusive check (
    target_pace_percent_basis is null or (target_pace_reference is null and target_min is null and target_max is null)
  ),
  add constraint scheduled_workout_steps_pace_percent_type_valid check (
    target_pace_percent_basis is null or target_type = 'pace'
  ),
  add constraint scheduled_workout_steps_pace_percent_range_valid check (
    target_pace_percent_max is null or (target_pace_percent_min is not null and target_pace_percent_max >= target_pace_percent_min)
  );
