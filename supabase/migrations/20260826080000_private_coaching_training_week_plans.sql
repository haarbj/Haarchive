-- A coach-set title and target-volume range for an athlete's week (e.g.
-- "Intro to Threshold," 45-50 mi) -- requirements #1 and #7 from the same
-- product ask turn out to be the same entity, not two separate ones.
create table public.training_week_plans (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  label text,
  target_volume_min numeric,
  target_volume_max numeric,
  target_volume_unit text check (target_volume_unit in ('miles', 'minutes')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Deliberately (athlete_id, week_start), not (coach_id, athlete_id,
  -- week_start): a week belongs to exactly one athlete's plan. If a new
  -- coach ever takes over an athlete mid-relationship, they UPDATE this
  -- same row (coach_id is still a real column, just not part of the
  -- uniqueness key) rather than creating a second, competing plan for the
  -- same week. This is intentional -- do not "fix" this to a 3-column
  -- unique key later.
  unique (athlete_id, week_start)
);
create index idx_training_week_plans_athlete_id on public.training_week_plans (athlete_id);

alter table public.training_week_plans enable row level security;

create policy "training_week_plans_all_coach" on public.training_week_plans
  for all to authenticated
  using ((select auth.uid()) = coach_id and public.coaches_this_athlete(athlete_id))
  with check ((select auth.uid()) = coach_id and public.coaches_this_athlete(athlete_id));

-- Athlete SELECT exists from day one even though nothing reads it from the
-- athlete side yet -- a week title and target volume are arguably part of
-- the athlete's own prescription, not coach-only metadata. The only
-- reason athlete-facing display isn't built yet is scope, not a data-model
-- decision, so the RLS already supports it when that UI is built.
create policy "training_week_plans_select_athlete" on public.training_week_plans
  for select to authenticated using ((select auth.uid()) = athlete_id);
