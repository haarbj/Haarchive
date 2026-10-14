-- Explicit, coach-defined training phases (Base/Build/Peak/Taper/etc.) --
-- deliberately NOT an automatic periodization engine. A coach says "this
-- is Build, Aug 24 to Sep 20"; the system never infers a phase from
-- mileage, workout types, or intensity. phase_type is free text with an
-- app-level <datalist> of suggestions (same discipline as day_label,
-- extras' kind, and XT modality elsewhere in this schema) -- never a
-- closed enum, and never treated as meaning anything about training
-- content. name is an optional, more specific description ("Aerobic
-- Development") shown alongside phase_type.
--
-- A week's phase membership is deliberately NOT a stored column anywhere
-- (not here, not on scheduled_workouts, not on training_week_plans) --
-- it's derived at read time as "whichever phase's date range contains
-- that week's Monday" (see getPhaseForWeek, src/lib/private-coaching/
-- training-phases.ts). Most weeks have no training_week_plans row at all
-- today; forcing one into existence just to tag a phase would be a real
-- regression, and a stored FK could go stale the moment a coach adjusts a
-- phase's own date range.
create table public.training_phases (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  phase_type text not null,
  name text,
  start_date date not null,
  end_date date not null,
  -- Optional link to the athlete's own goals row (self-serve product's
  -- existing table, already private-coach readable -- see
  -- goals_select_private_coach) -- lets a Taper/Race phase reference
  -- which specific goal it's built around when an athlete has more than
  -- one. Purely informational: nothing validates a phase's own dates
  -- against its linked goal's date.
  goal_id uuid references public.goals (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_phases_date_range_valid check (end_date >= start_date)
);
create index idx_training_phases_athlete_id on public.training_phases (athlete_id, start_date);

-- Phases for one athlete must never overlap (product default, confirmed).
-- Enforced at the database level, not just app-layer validation -- same
-- discipline as every other range invariant in this schema (distance/
-- duration/pace all have a real CHECK constraint backstop, not just a
-- client-side check). btree_gist is required to combine an equality
-- column (athlete_id) with a range-exclusion (the date range) in one
-- constraint -- this is the first use of that extension in this schema.
create extension if not exists btree_gist;
alter table public.training_phases
  add constraint training_phases_no_overlap
  exclude using gist (athlete_id with =, daterange(start_date, end_date, '[]') with &&);

alter table public.training_phases enable row level security;

-- Coach-owned and coach-defined, mirroring scheduled_workouts_all_coach's
-- exact shape (coach_id = auth.uid() AND coaches_this_athlete()).
create policy "training_phases_all_coach" on public.training_phases
  for all to authenticated using (
    coach_id = (select auth.uid()) and public.coaches_this_athlete(athlete_id)
  ) with check (
    coach_id = (select auth.uid()) and public.coaches_this_athlete(athlete_id)
  );

-- Athlete can read their own phases (mirroring
-- training_week_plans_select_athlete's identical shape) -- no athlete-
-- facing UI reads this yet (out of scope for this round), but the policy
-- is added now for consistency with every other private-coaching
-- prescription-adjacent table, not left as a gap to revisit later.
create policy "training_phases_select_athlete" on public.training_phases
  for select to authenticated using (athlete_id = (select auth.uid()));
