-- title becomes nullable, not dropped -- existing rows keep it for a
-- graceful display fallback (getWorkoutDisplayLabel), it's just no longer
-- coach-editable; day_label replaces it as the coach-facing vocabulary.
-- extras (text[], added earlier this same uncommitted session) is dropped
-- -- never used by real data, fully superseded by the structured table
-- below.
alter table public.scheduled_workouts
  alter column title drop not null,
  drop column extras;

-- Structured extras (strides/drills/plyos/strength -- deliberately NOT
-- warmup/cooldown, which already exist as real scheduled_workout_steps
-- stepTypes). Mirrors scheduled_workout_steps' exact shape/RLS rather than
-- inventing a new pattern.
create table public.scheduled_workout_extras (
  id uuid primary key default gen_random_uuid(),
  scheduled_workout_id uuid not null references public.scheduled_workouts (id) on delete cascade,
  extra_order int not null,
  kind text not null,
  overview text,
  count int,
  distance_m numeric,
  duration_s int,
  items text[]
);
create index idx_scheduled_workout_extras_workout_id on public.scheduled_workout_extras (scheduled_workout_id);

alter table public.scheduled_workout_extras enable row level security;

-- Verbatim mirror of scheduled_workout_steps_all_coach/_select_athlete
-- (20260825020000_private_coaching_workouts.sql:190-200) -- same
-- ownership-via-parent-workout join, same published-only gate for the
-- athlete.
create policy "scheduled_workout_extras_all_coach" on public.scheduled_workout_extras
  for all to authenticated using (
    exists (select 1 from public.scheduled_workouts w where w.id = scheduled_workout_id and w.coach_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.scheduled_workouts w where w.id = scheduled_workout_id and w.coach_id = (select auth.uid()))
  );
create policy "scheduled_workout_extras_select_athlete" on public.scheduled_workout_extras
  for select to authenticated using (
    exists (
      select 1 from public.scheduled_workouts w
      where w.id = scheduled_workout_id and w.athlete_id = (select auth.uid()) and w.published_at is not null
    )
  );

-- A coach's own reusable extras library (e.g. a standard drill circuit)
-- so they don't retype it every workout -- same relationship shape as
-- workout_templates (coach-only, no athlete policy at all; athletes never
-- browse this, only see its effect once applied to a real workout).
create table public.coach_extra_presets (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  kind text not null,
  overview text,
  count int,
  distance_m numeric,
  duration_s int,
  items text[],
  created_at timestamptz not null default now()
);
create index idx_coach_extra_presets_coach_id on public.coach_extra_presets (coach_id);

alter table public.coach_extra_presets enable row level security;

create policy "coach_extra_presets_all_own" on public.coach_extra_presets
  for all to authenticated using (coach_id = (select auth.uid())) with check (coach_id = (select auth.uid()));
