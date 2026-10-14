-- Private 1-on-1 coaching, Phase 1: the coaching relationship itself.
--
-- Deliberately decoupled from teams/team_memberships/groups/season_* --
-- those model a single-tenant HS team's group-broadcast coaching product
-- (see coach_athlete_access.sql/coach_athlete_rls.sql/groups.sql) and a
-- coach's access there is all-or-nothing at the team level. Private
-- coaching needs a real per-pair relationship ("this specific coach
-- coaches this specific athlete," not "this coach's team includes this
-- athlete"), so it gets its own table rather than being force-fit into
-- team_memberships. The two products can coexist (a user could plausibly
-- be a team athlete AND privately coached), which this decoupling allows
-- for free.
--
-- Mirrors the coach_invites precedent exactly for the invite table (email
-- + token, zero RLS policies -- redemption is service-role-mediated only,
-- see the Phase 2 roster actions), and the coaches_athlete()/security
-- definer pattern from coach_athlete_rls.sql for the read-access helper.

create type public.coaching_relationship_status as enum ('active', 'ended');

create table public.coach_athletes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  status public.coaching_relationship_status not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_athletes_not_self check (coach_id <> athlete_id)
);

-- Only one *active* pairing per (coach, athlete) at a time -- but a coach
-- and athlete can have multiple historical rows across time (a transfer
-- back, a re-engagement), which is exactly why this is a partial unique
-- index scoped to status = 'active' rather than a plain unique constraint.
create unique index coach_athletes_active_pair_idx
  on public.coach_athletes (coach_id, athlete_id)
  where (status = 'active');

create index idx_coach_athletes_coach_id on public.coach_athletes (coach_id) where (status = 'active');
create index idx_coach_athletes_athlete_id on public.coach_athletes (athlete_id) where (status = 'active');

-- Invitation -- an athlete may not have an account yet, so this is keyed
-- by email + token, same shape as coach_invites. Redeeming an invite
-- creates the coach_athletes row directly with status='active' (see the
-- Phase 2 accept-invite action) -- there is no separate "pending" status
-- on coach_athletes itself; "pending" is simply "an unredeemed invite
-- exists," mirroring how coach_invites/team_memberships already keep
-- invitation state and relationship state in two different tables.
create table public.coach_athlete_invites (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  athlete_email text not null,
  token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  redeemed_at timestamptz,
  redeemed_by uuid references public.profiles (id) on delete set null
);

-- One live (unredeemed) invite per coach per athlete email -- a different
-- coach can still invite the same email independently (multi-coach future
-- use case explicitly called out in the product brief), so this is scoped
-- to (coach_id, email), not email alone.
create unique index coach_athlete_invites_live_idx
  on public.coach_athlete_invites (coach_id, lower(athlete_email))
  where (redeemed_at is null);
create index idx_coach_athlete_invites_coach_id on public.coach_athlete_invites (coach_id);
create index idx_coach_athlete_invites_token on public.coach_athlete_invites (token);

alter table public.coach_athletes enable row level security;
alter table public.coach_athlete_invites enable row level security;

-- coach_athletes: both sides of the relationship can see it; writes are
-- service-role-mediated only (invite redemption, ending a relationship),
-- same as team_memberships having no authenticated insert/update/delete
-- policy at all.
create policy "coach_athletes_select_as_coach" on public.coach_athletes
  for select to authenticated using ((select auth.uid()) = coach_id);
create policy "coach_athletes_select_as_athlete" on public.coach_athletes
  for select to authenticated using ((select auth.uid()) = athlete_id);

-- coach_athlete_invites: zero policies for authenticated/anon, deny-all --
-- identical convention to coach_invites. Only a service-role Server Action
-- (creating an invite, redeeming one) ever touches this table.

-- The read-access helper every other private-coaching table's RLS policy
-- is built on: "does the current user actively, privately coach this
-- athlete." Security definer + stable, same as coaches_athlete() in
-- coach_athlete_rls.sql, for the same reason (a plain policy expression
-- referencing coach_athletes from another table's policy would otherwise
-- need coach_athletes itself to be readable to that other row's owner,
-- which it isn't).
create or replace function public.coaches_this_athlete(p_athlete_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.coach_athletes
    where coach_athletes.athlete_id = p_athlete_id
      and coach_athletes.coach_id = (select auth.uid())
      and coach_athletes.status = 'active'
  );
$$;

comment on function public.coaches_this_athlete(uuid) is
  'True if the current user privately, actively coaches the given athlete via coach_athletes. Distinct from coaches_athlete(), which checks the unrelated team-based coaching product.';
