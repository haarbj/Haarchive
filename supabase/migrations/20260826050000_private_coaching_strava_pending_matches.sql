-- Strava pending-match review queue (private coaching, Strava-gaps fix).
--
-- Previously, dashboard/strava-actions.ts's private-coaching branch matched
-- a Strava activity to a scheduled_workout by date and immediately wrote
-- into completed_workouts, marking the workout completed and instantly
-- visible to the coach -- no athlete review step at all. Per explicit
-- product direction, Strava should only ever SUGGEST data: the athlete
-- reviews the matched activity and explicitly approves it before it
-- populates their assigned workout, and the result stays editable
-- afterward like any other completion.
--
-- This table is the pending suggestion. It is the actual consent gate: a
-- coach can only ever see rows in completed_workouts
-- (completed_workouts_select_coach), and nothing here ever writes there --
-- only an athlete's own approve action does (see completion-actions.ts).
-- Deliberately no coach SELECT policy on this table at all.
create table public.strava_pending_matches (
  id uuid primary key default gen_random_uuid(),
  scheduled_workout_id uuid not null unique references public.scheduled_workouts (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  strava_activity_id bigint not null,
  activity_name text,
  activity_distance_m numeric,
  activity_duration_s int,
  activity_avg_hr int,
  activity_started_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_strava_pending_matches_athlete_id on public.strava_pending_matches (athlete_id);

alter table public.strava_pending_matches enable row level security;

-- Athlete-only, full lifecycle (the sync action inserts/upserts as the
-- athlete's own RLS-scoped session, not service-role; approving/dismissing
-- deletes as that same athlete). with-check mirrors
-- completed_workouts_all_own's "must point at your own scheduled workout"
-- shape.
create policy "strava_pending_matches_all_own" on public.strava_pending_matches
  for all to authenticated
  using (athlete_id = (select auth.uid()))
  with check (
    athlete_id = (select auth.uid())
    and exists (
      select 1 from public.scheduled_workouts w
      where w.id = scheduled_workout_id and w.athlete_id = (select auth.uid())
    )
  );
