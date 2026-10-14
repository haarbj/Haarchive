-- coach_guidance_dismissals: which advisory plan-health findings a coach
-- has already said they are not acting on.
--
-- The plan-health checks (src/lib/private-coaching/plan-health.ts) are
-- recomputed from the athlete's real schedule every time the page renders,
-- so a finding has no row of its own anywhere -- it is derived, not stored.
-- What DOES need storing is the coach's answer to it. Without that, a
-- finding a coach has deliberately judged fine ("yes, those two big
-- sessions are a block, that is the point") reappears on every visit, and
-- a panel that nags is a panel coaches learn to ignore.
--
-- Keyed by the finding's own stable key rather than by anything it points
-- at: a finding's key encodes what it is about (e.g.
-- "big-session-spacing:2027-03-20:2027-03-22"), so dismissing one pair of
-- clashing sessions does not dismiss a different pair, and a finding that
-- genuinely changes -- because the coach moved one of those sessions --
-- gets a new key and legitimately surfaces again. That is the intended
-- behaviour, not a bug: the advice is about the current plan.
--
-- Deliberately NOT a general-purpose "dismissed notices" table. It is
-- scoped to one coach's view of one athlete's plan, which is what the
-- finding keys mean. Anything else wanting dismissals should get its own
-- table rather than overloading the finding_key column with a second
-- vocabulary.
create table public.coach_guidance_dismissals (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  finding_key text not null,
  created_at timestamptz not null default now(),
  -- One dismissal per coach, athlete and finding. Re-dismissing is an
  -- upsert, never a second row.
  unique (coach_id, athlete_id, finding_key)
);
create index idx_coach_guidance_dismissals_lookup
  on public.coach_guidance_dismissals (coach_id, athlete_id);

alter table public.coach_guidance_dismissals enable row level security;

-- Coach-only, and only for an athlete they actually coach -- the same
-- (own coach_id AND coaches_this_athlete) pair training_week_plans already
-- uses (20260826080000). Athletes have no policy here at all: these
-- findings are coach-facing decision support and Part B is invisible to
-- athletes, so there is deliberately nothing for an athlete to select.
create policy "coach_guidance_dismissals_all_coach" on public.coach_guidance_dismissals
  for all to authenticated
  using ((select auth.uid()) = coach_id and public.coaches_this_athlete(athlete_id))
  with check ((select auth.uid()) = coach_id and public.coaches_this_athlete(athlete_id));
