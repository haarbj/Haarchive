-- The season's own race calendar (multiple meets across the season), of
-- which exactly one is the goal race periodization targets -- distinct from
-- season_phases/season_weeks, which describe the training structure, not
-- the competition schedule.

create table public.season_races (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  season_plan_id uuid not null references public.season_plans (id) on delete cascade,
  name text not null,
  date date not null,
  is_goal_race boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_season_races_season_plan_id on public.season_races (season_plan_id);

alter table public.season_races enable row level security;

create policy "season_races_select_team" on public.season_races
  for select to authenticated using (team_id in (select public.my_team_ids()));

create policy "season_races_write_coach" on public.season_races
  for all to authenticated using (team_id = public.my_coach_team_id()) with check (team_id = public.my_coach_team_id());
