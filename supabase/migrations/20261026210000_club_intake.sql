-- Club intake: a single unlisted-URL-per-cycle interest form that lets a
-- club (first use: Vanderbilt Run Club, "Nashville Spring 2027") express
-- interest in the free Club Plan and/or paid 1-on-1 coaching, landing in a
-- coach's batch approval queue.
--
-- Two brand-new tables, both deny-all RLS and zero grants to
-- anon/authenticated -- every read and write goes through a service-role
-- Server Action, exactly mirroring coach_athlete_invites' own precedent
-- (see private_coaching_core.sql's comment on that table). This sidesteps
-- the upcoming end of Supabase's auto-grant-on-create behavior (Oct 30,
-- 2026) entirely for these two tables: neither is ever exposed to
-- PostgREST's anon/authenticated roles, so there is no grant to assume or
-- forget. See the task report for the explicit statement that no new
-- grants are required for these tables -- the deliberate zero-grant
-- design IS the answer, not an oversight.
--
-- A submission intentionally duplicates (rather than reads live from)
-- athlete_profiles/goals/race_results: the whole point of a batch
-- approval queue is that the reviewing coach can see every pending
-- submission's mileage/experience/goal/injury data BEFORE any
-- coach_athletes relationship exists for that athlete -- and
-- coaches_this_athlete() (the read-gate every other private-coaching
-- table's coach-read policy relies on) requires exactly that relationship
-- to already exist. A snapshot here is the only way the queue can work at
-- all for a not-yet-approved athlete. The submit action separately writes
-- the athlete's own athlete_profiles/goals/race_results via their own
-- normal RLS-scoped client wherever a durable field already exists there
-- (current_weekly_mileage, years_running, training_background_injury_history,
-- a goals row, a race_results row) -- "the athlete owns and edits their
-- own onboarding data" stays true; this table is the coach's queue view,
-- not a replacement for that data model.

create type public.club_intake_goal_type as enum ('finish', 'time');

create type public.club_intake_wtp_bracket as enum (
  'under_50', '50_75', '75_100', '100_150', '150_200', '200_plus', 'not_interested'
);

create type public.club_intake_submission_status as enum (
  'pending', 'approved', 'waitlisted', 'redirected_not_ready'
);

-- One row per intake cycle ("Nashville Spring 2027"). Brody controls the
-- token (rotate it to kill a leaked link -- just create a new cycle row
-- and stop sharing the old token, since token is immutable once created)
-- and the deadline; is_closed is a manual kill switch independent of the
-- deadline, for "close it right now" without waiting for the clock.
create table public.club_intake_cycles (
  id uuid primary key default gen_random_uuid(),
  -- uuid, not a short slug -- same unguessable-token shape as
  -- coach_athlete_invites.token, 122 bits of randomness.
  token uuid not null unique default gen_random_uuid(),
  label text not null,
  race_name text not null,
  race_date date not null,
  deadline_at timestamptz not null,
  is_closed boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.club_intake_submissions (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.club_intake_cycles (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  status public.club_intake_submission_status not null default 'pending',

  -- Field 1: current weekly mileage (4-week average).
  current_weekly_mileage numeric not null,

  -- Field 2: recent race result OR a plan to use the team 5K time trial.
  race_name text,
  race_date date,
  finish_time_s int,
  plans_time_trial boolean not null default false,

  -- Field 3: running background.
  years_running int not null,
  plans_completed int not null default 0,

  -- Field 4: Nashville goal.
  goal_type public.club_intake_goal_type not null,
  goal_time_s int,

  -- Field 5: injury/illness history, free text -- coach review, not a
  -- structured injuries row (the intake form collects prose, not the
  -- body_part/start_date/severity the injuries table models).
  injury_history text,

  -- Optional roster cross-check only -- never a gate (see the form's own
  -- "link is the membership proof" rule).
  school_email text,

  -- Field 6: 1-on-1 interest + willingness-to-pay bracket. The bracket is
  -- collected as DATA for Brody's own pricing decision -- nothing in this
  -- schema or any app code may derive a price from it; see the form copy
  -- itself, which never explains what the bracket is for.
  interested_1on1 boolean not null default false,
  wtp_bracket public.club_intake_wtp_bracket,

  -- Field 7: the paid-only coaching agreement, one column per checkbox so
  -- a coach reviewing a flagged submission can see exactly which (if any)
  -- went unchecked, rather than one collapsed "agreed" boolean.
  agreement_log_honestly boolean not null default false,
  agreement_say_if_wrong boolean not null default false,
  agreement_run_prescribed_paces boolean not null default false,
  agreement_read_the_why boolean not null default false,

  -- The auto-matched proposal (see club-intake.ts's recommendation
  -- function) -- advisory only, exactly like race-anchored-planning.ts's
  -- own phase-layout proposals. Null for a redirected_not_ready
  -- submission, which never gets a recommendation at all.
  proposed_framework_key text,
  proposed_peak_mileage numeric,
  readiness_fail boolean not null default false,

  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,

  -- One submission per athlete per cycle -- resubmitting the form updates
  -- the existing row (upsert) rather than creating a duplicate, so the
  -- queue never shows the same athlete twice for one cycle.
  unique (cycle_id, athlete_id)
);

create index idx_club_intake_submissions_cycle on public.club_intake_submissions (cycle_id, status);
create index idx_club_intake_submissions_athlete on public.club_intake_submissions (athlete_id);

alter table public.club_intake_cycles enable row level security;
alter table public.club_intake_submissions enable row level security;

-- Deny-all: zero policies for anon/authenticated on both tables, and the
-- grants below make that airtight even before PostgREST's schema cache
-- would otherwise expose them -- every read and write goes through a
-- service-role Server Action (resolve-by-token, submit, list-for-queue,
-- approve/waitlist/redirect), matching coach_athlete_invites exactly.
revoke all on public.club_intake_cycles from anon, authenticated;
revoke all on public.club_intake_submissions from anon, authenticated;

-- The free/paid barrier this whole product rests on (see the task's own
-- "free-tier barrier" section). Added to the EXISTING coach_athletes table
-- rather than a new one -- it is a property of the relationship, not a new
-- entity. Defaults to 'paid' so every relationship that already existed
-- before this migration keeps its current, unrestricted behavior exactly
-- (every private-coaching relationship so far WAS the full 1-on-1
-- product) -- only a club-intake approval explicitly creates a new
-- relationship as 'free'.
create type public.coaching_tier as enum ('free', 'paid');
alter table public.coach_athletes add column tier public.coaching_tier not null default 'paid';
