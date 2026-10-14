-- training_groups / training_group_members: lets a coach group athletes by
-- ability (e.g. "A group -- sub-17 5K", "B group -- 17-19") so a program can
-- eventually be assigned to a whole group at once instead of one athlete at
-- a time. This is step 1 of that workflow only -- group creation and
-- membership. Per-group program assignment is a separate, later change; it
-- is not implied or half-built here.
--
-- Deliberately independent of the unrelated team-coaching product's
-- `groups` table (see groups.sql) -- that models a single-tenant HS team's
-- own roster grouping and a private-coaching athlete may not even be a
-- member of that product at all. A private-coaching group is scoped to one
-- coach's own roster, not a team.
--
-- No coach_id column on training_group_members itself, same reasoning as
-- program_phase_definitions/program_variant_phases in
-- 20260925010000_private_coaching_programs_core.sql: ownership is always
-- reached via the parent row (training_groups.coach_id), not denormalized
-- onto every child. athlete_id is still checked directly against
-- coaches_this_athlete() (20260825010000_private_coaching_core.sql) so a
-- coach can only ever place an athlete who is actually, currently on their
-- roster into one of their own groups -- mirroring the exact
-- `coach_id = auth.uid() and coaches_this_athlete(athlete_id)` shape
-- scheduled_workouts/training_phases already use for the same reason, and
-- the same documented consequence: access is revoked the instant the
-- underlying coaching relationship ends, not just at the moment of
-- insertion.
--
-- A given athlete may belong to more than one group at once (e.g. "A group"
-- and "Marathon crew" simultaneously) -- membership is a plain many-to-many
-- join, not a single group_id on the athlete's profile.

create table public.training_groups (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_training_groups_coach_id on public.training_groups (coach_id);

create table public.training_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.training_groups (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (group_id, athlete_id)
);
create index idx_training_group_members_group_id on public.training_group_members (group_id);
create index idx_training_group_members_athlete_id on public.training_group_members (athlete_id);

alter table public.training_groups enable row level security;
alter table public.training_group_members enable row level security;

-- Coach: full CRUD on their own groups. Verbatim mirror of
-- training_programs_all_own's shape (20260925010000).
create policy "training_groups_all_own" on public.training_groups
  for all to authenticated
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()));

-- training_groups' own athlete-read check (below) would otherwise query
-- training_group_members directly, whose own policy queries training_groups
-- right back -- real infinite RLS recursion, caught by tests/rls/training-
-- groups.test.ts against a live Postgres instance, not just reasoned about.
-- Wrapping it in a security definer function breaks the cycle the same way
-- coaches_this_athlete() does (20260825010000_private_coaching_core.sql):
-- the function runs as its owner, which (as the table owner) bypasses
-- training_group_members' RLS entirely rather than re-entering it.
create or replace function public.is_training_group_member(p_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.training_group_members
    where training_group_members.group_id = p_group_id
      and training_group_members.athlete_id = (select auth.uid())
  );
$$;

comment on function public.is_training_group_member(uuid) is
  'True if the current user is a member of the given training_groups row. Exists specifically to avoid the RLS recursion that a direct exists() subquery here would cause (see this migration''s own comment).';

-- Athlete: read-only, and only a group they are actually a member of --
-- never every group belonging to whichever coach they happen to be coached
-- by.
create policy "training_groups_select_as_member" on public.training_groups
  for select to authenticated
  using (public.is_training_group_member(id));

-- Coach: full CRUD on membership rows in groups they own, restricted to
-- athletes currently on their own roster (see header comment).
create policy "training_group_members_all_own" on public.training_group_members
  for all to authenticated
  using (
    exists (select 1 from public.training_groups g where g.id = group_id and g.coach_id = (select auth.uid()))
    and public.coaches_this_athlete(athlete_id)
  )
  with check (
    exists (select 1 from public.training_groups g where g.id = group_id and g.coach_id = (select auth.uid()))
    and public.coaches_this_athlete(athlete_id)
  );

-- Athlete: read-only, own membership rows only.
create policy "training_group_members_select_as_athlete" on public.training_group_members
  for select to authenticated
  using (athlete_id = (select auth.uid()));
