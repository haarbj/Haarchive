-- Private 1-on-1 coaching, Phase 1: athlete metrics + weekly check-in.
--
-- athlete_metrics is the extensible EAV-style store behind the
-- @athlete.<key> variable system described in the product brief (e.g.
-- @athlete.5k_pace, @athlete.threshold_pace) -- a flexible key/value/unit
-- table rather than a hardcoded column per metric, so a coach can
-- eventually prescribe a template once and have it resolve per-athlete
-- without duplicating workouts. Not exposed in any UI in Phase 1 (per the
-- brief: "do not necessarily expose ... if doing so would slow MVP
-- delivery, but the underlying architecture must not prevent it") -- this
-- migration only lays the table down.
create table public.athlete_metrics (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  key text not null,
  value numeric not null,
  unit text not null,
  effective_from date not null default current_date,
  effective_to date,
  source text not null default 'coach_entered',
  created_at timestamptz not null default now()
);
create index idx_athlete_metrics_athlete_key on public.athlete_metrics (athlete_id, key, effective_from desc);

alter table public.athlete_metrics enable row level security;

create policy "athlete_metrics_select_own" on public.athlete_metrics
  for select to authenticated using ((select auth.uid()) = athlete_id);
create policy "athlete_metrics_insert_own" on public.athlete_metrics
  for insert to authenticated with check ((select auth.uid()) = athlete_id);
create policy "athlete_metrics_all_coach" on public.athlete_metrics
  for all to authenticated using (public.coaches_this_athlete(athlete_id)) with check (public.coaches_this_athlete(athlete_id));

-- weekly_checkins already exists (fatigue/soreness/sleep_quality/stress/
-- notes, one row per athlete per week_start) -- extended here rather than
-- duplicated, per the product brief's own list of fields
-- (overall_feel/pain/biggest_positive/biggest_concern/
-- schedule_constraints are the only ones missing). This table is shared
-- with the dashboard self-serve feature (weekly-checkin-card.tsx); the new
-- columns are all nullable so that existing usage is unaffected.
alter table public.weekly_checkins
  add column overall_feel int check (overall_feel between 1 and 5),
  add column pain boolean not null default false,
  add column pain_notes text,
  add column biggest_positive text,
  add column biggest_concern text,
  add column schedule_constraints text;

-- weekly_checkins already has a coach policy from coach_athlete_rls.sql,
-- but it's scoped to the team-based coaches_athlete() helper -- additive
-- policies here extend read access to a private coach too (via the new
-- coaches_this_athlete() helper), without touching the existing ones.
-- Postgres ORs permissive policies for the same command, so this can only
-- widen access.
create policy "weekly_checkins_select_private_coach" on public.weekly_checkins
  for select to authenticated using (public.coaches_this_athlete(user_id));
