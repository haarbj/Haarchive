-- coach_estimate_reviews: the coach's record of each fitness-estimate
-- review they ran for an athlete (Part F).
--
-- WHY THIS EXISTS AT ALL, GIVEN athlete_fitness_estimates ALREADY DOES.
-- Two different things. athlete_fitness_estimates is the athlete's own
-- current estimate, one row per reference key, and it is deliberately
-- athlete-writable only: the coach has SELECT and nothing else (see
-- 20260926020000's policies, and assign-program-actions.ts's own comment on
-- why the platform never enters an athlete's fitness estimate for them).
-- That boundary is NOT relaxed here. A review therefore cannot and does not
-- overwrite the athlete's estimate; it records what the coach concluded,
-- and the coach takes it to the athlete.
--
-- The second reason is that the estimate table holds no history -- it is
-- "your current estimate", updated in place. Item 17's deterioration flag
-- needs a trend, and a trend needs more than one point in time. This table
-- is that series.
--
-- Deliberately records BOTH what the review proposed and what the coach
-- settled on. Those differ often and the difference is the interesting
-- part: a coach overriding the proposal every time is telling you the
-- weighting rules are wrong, and that is only visible if both are kept.
create table public.coach_estimate_reviews (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  reference_key public.pace_reference not null,
  -- The estimate on file at the moment the review ran. Nullable because an
  -- athlete may have no estimate yet, which is itself a valid thing to
  -- review ("they need a 5K estimate before any of this can be paced").
  previous_time_s int check (previous_time_s is null or previous_time_s > 0),
  -- What the review itself proposed. NULL is a real, common answer: the
  -- logged data often cannot support a precise number (a session records
  -- one distance and duration for a run whose prescription has a warm-up,
  -- so its average pace is a blend), in which case the review reports a
  -- direction only. See estimate-review.ts's header.
  proposed_time_s int check (proposed_time_s is null or proposed_time_s > 0),
  -- What the coach actually concluded, which may be their own number
  -- rather than the proposal, or nothing at all if they decided to leave
  -- the estimate alone.
  confirmed_time_s int check (confirmed_time_s is null or confirmed_time_s > 0),
  -- "about-right" / "looks-optimistic" / "looks-conservative" /
  -- "not-enough-evidence". Free text rather than an enum, matching
  -- day_label's and phase_type's own precedent: the vocabulary belongs to
  -- the application, and a new verdict should not need a migration.
  verdict text not null,
  -- The reasoning shown to the coach when they ran it, kept verbatim so a
  -- review can be understood months later without re-deriving it from data
  -- that has since changed.
  reasoning text,
  -- How many logged sessions actually carried weight, and whether the
  -- athlete was getting the work done over the period reviewed. The second
  -- is what makes the deterioration flag meaningful: an estimate drifting
  -- slower while sessions are being missed is just a plan not happening.
  sessions_counted int not null default 0 check (sessions_counted >= 0),
  work_completed boolean not null default true,
  reviewed_at timestamptz not null default now()
);
create index idx_coach_estimate_reviews_lookup
  on public.coach_estimate_reviews (athlete_id, reference_key, reviewed_at desc);

alter table public.coach_estimate_reviews enable row level security;

-- Coach-only, and only for an athlete they actually coach. Part F is
-- coach-only decision support, so there is deliberately NO athlete policy:
-- an athlete sees their coach's conclusion when their coach tells them,
-- through the messaging that already exists, not by reading the coach's
-- working notes.
create policy "coach_estimate_reviews_all_coach" on public.coach_estimate_reviews
  for all to authenticated
  using ((select auth.uid()) = coach_id and public.coaches_this_athlete(athlete_id))
  with check ((select auth.uid()) = coach_id and public.coaches_this_athlete(athlete_id));
