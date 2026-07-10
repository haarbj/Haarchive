-- Stage 3: Season Blueprint (Layer 1) and Weekly Themes (Layer 2) schema.
-- Team-level content, not per-athlete: one season narrative a coach builds
-- and edits once, referenced from many individually-generated athlete
-- plans via nullable FKs. Nullable/additive on the existing tables --
-- zero impact on the self-serve flow, which never sets season_plan_id.
--
-- Load-bearing constraint (see season-generator.ts and the coach roster-
-- generation flow that will consume this): allocateMesocycles/
-- buildWeeklyPhaseSequence/coalesceMesocycles are pure functions of
-- (totalWeeks, goalDistanceM) only, so every athlete generated from the
-- same season (same goal_race_date/goal_distance_m) produces a
-- structurally identical phase sequence, in the same order, as what
-- seeded season_phases here. That's what makes mapping an athlete's own
-- mesocycles[i] to this season's season_phases[i] by position correct --
-- it breaks if a coach ever lets one athlete on a season target a
-- different race, which the UI should prevent, not just assume away.

create type public.mileage_level as enum ('low', 'moderate', 'high');

create table public.season_plans (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  name text not null,
  goal_race_name text not null,
  goal_race_date date not null,
  goal_distance_m int not null,
  status public.plan_status not null default 'draft', -- reuses the existing enum, no near-duplicate
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.season_phases (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  season_plan_id uuid not null references public.season_plans (id) on delete cascade,
  phase public.mesocycle_phase not null,
  display_name text not null,
  order_index int not null,
  start_date date not null,
  end_date date not null,
  primary_goal text not null default '',
  secondary_goals text[] not null default '{}',
  key_workout_types public.workout_type[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_plan_id, order_index)
);

create table public.season_weeks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  season_plan_id uuid not null references public.season_plans (id) on delete cascade,
  season_phase_id uuid not null references public.season_phases (id) on delete cascade,
  week_index int not null,
  theme text not null default '',
  mileage_level public.mileage_level not null default 'moderate',
  workout_slots jsonb not null default '[]'::jsonb, -- [{label, workoutType}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_plan_id, week_index)
);

alter table public.training_plans add column season_plan_id uuid references public.season_plans (id) on delete set null;
alter table public.mesocycles add column season_phase_id uuid references public.season_phases (id) on delete set null;

create index idx_season_phases_season_plan_id on public.season_phases (season_plan_id);
create index idx_season_weeks_season_plan_id on public.season_weeks (season_plan_id);
create index idx_season_weeks_season_phase_id on public.season_weeks (season_phase_id);
create index idx_training_plans_season_plan_id on public.training_plans (season_plan_id);
create index idx_mesocycles_season_phase_id on public.mesocycles (season_phase_id);

alter table public.season_plans enable row level security;
alter table public.season_phases enable row level security;
alter table public.season_weeks enable row level security;

create policy "season_plans_select_team" on public.season_plans
  for select to authenticated using (team_id in (select public.my_team_ids()));
create policy "season_plans_write_coach" on public.season_plans
  for all to authenticated using (team_id = public.my_coach_team_id()) with check (team_id = public.my_coach_team_id());

create policy "season_phases_select_team" on public.season_phases
  for select to authenticated using (team_id in (select public.my_team_ids()));
create policy "season_phases_write_coach" on public.season_phases
  for all to authenticated using (team_id = public.my_coach_team_id()) with check (team_id = public.my_coach_team_id());

create policy "season_weeks_select_team" on public.season_weeks
  for select to authenticated using (team_id in (select public.my_team_ids()));
create policy "season_weeks_write_coach" on public.season_weeks
  for all to authenticated using (team_id = public.my_coach_team_id()) with check (team_id = public.my_coach_team_id());
