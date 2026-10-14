-- Private 1-on-1 coaching, Phase 1: the workout model.
--
-- Three deliberately separate concepts, per the product brief: a reusable
-- workout_template (coach's own library), a scheduled_workout (a template
-- -- or ad hoc content -- assigned to one athlete on one date), and a
-- completed_workout (what the athlete actually reports back). Steps are a
-- real child table (workout_template_steps / scheduled_workout_steps), not
-- an opaque jsonb blob -- matching the brief's explicit instruction and
-- unlike the existing coaching_engine's WorkoutPrescription (a closed,
-- kind-specific discriminated union with no generic step list -- see the
-- Phase 0 audit; it doesn't fit a warmup/main/interval/recovery/cooldown
-- step sequence with pluralistic targets, so this is intentionally a new,
-- parallel shape rather than a forced reuse).
--
-- scheduled_workout_steps is a COPY of the template's steps at assignment
-- time (or authored directly, when template_id is null), not a live
-- reference -- so editing a template later never retroactively changes an
-- already-assigned workout, and so a step's numeric targets can be
-- resolved from @athlete.* variables (see athlete_metrics, added next
-- migration) at the moment of scheduling rather than at read time.
--
-- workout_type reuses the existing public.workout_type enum
-- (easy/tempo/vo2/long/race/recovery/strength) rather than inventing a
-- second vocabulary for the same concept.

create type public.workout_step_type as enum ('warmup', 'main', 'interval', 'recovery', 'cooldown');
create type public.workout_target_type as enum ('pace', 'heart_rate', 'power', 'rpe', 'duration', 'distance', 'open');
create type public.scheduled_workout_status as enum ('scheduled', 'completed', 'missed', 'skipped');

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  workout_type public.workout_type,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_workout_templates_coach_id on public.workout_templates (coach_id);

create table public.workout_template_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  step_order int not null,
  step_type public.workout_step_type not null,
  duration_s int,
  distance_m numeric,
  target_type public.workout_target_type not null default 'open',
  target_min numeric,
  target_max numeric,
  target_unit text,
  repetitions int,
  rest_s int,
  -- May contain @athlete.<metric_key> placeholders (e.g. "@athlete.5k_pace
  -- + 30s/mi"), resolved into scheduled_workout_steps.instructions at
  -- assignment time -- see the resolveAthleteVariables() helper added in
  -- Phase 3 application code, not in this migration.
  instructions text,
  unique (template_id, step_order)
);
create index idx_workout_template_steps_template_id on public.workout_template_steps (template_id);

create table public.scheduled_workouts (
  id uuid primary key default gen_random_uuid(),
  -- Denormalized athlete_id/coach_id (rather than only a coach_athlete_id
  -- FK) so RLS can check ownership with a direct equality instead of a
  -- join through coach_athletes on every row -- same reasoning
  -- mesocycles.user_id already uses relative to training_plans.
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  template_id uuid references public.workout_templates (id) on delete set null,
  scheduled_date date not null,
  title text not null,
  workout_type public.workout_type,
  notes_from_coach text,
  status public.scheduled_workout_status not null default 'scheduled',
  -- Nullable -- an unpublished workout is a coach's draft, visible to the
  -- coach only, matching group_plan_workouts.published_at's exact
  -- precedent (per-row publish gate, not a whole-plan flag).
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_scheduled_workouts_athlete_date on public.scheduled_workouts (athlete_id, scheduled_date);
create index idx_scheduled_workouts_coach_id on public.scheduled_workouts (coach_id);

create table public.scheduled_workout_steps (
  id uuid primary key default gen_random_uuid(),
  scheduled_workout_id uuid not null references public.scheduled_workouts (id) on delete cascade,
  step_order int not null,
  step_type public.workout_step_type not null,
  duration_s int,
  distance_m numeric,
  target_type public.workout_target_type not null default 'open',
  target_min numeric,
  target_max numeric,
  target_unit text,
  repetitions int,
  rest_s int,
  instructions text,
  unique (scheduled_workout_id, step_order)
);
create index idx_scheduled_workout_steps_workout_id on public.scheduled_workout_steps (scheduled_workout_id);

-- One completion per scheduled workout (unique FK) -- an athlete either
-- logs it once or edits that same row, matching the existing
-- workout_completions table's one-row-per-workout convention, just scoped
-- to this new pipeline instead of overloading that table with a third
-- foreign-key column (it already has an XOR between two).
create table public.completed_workouts (
  id uuid primary key default gen_random_uuid(),
  scheduled_workout_id uuid not null unique references public.scheduled_workouts (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  completed_at timestamptz not null default now(),
  actual_duration_s int,
  actual_distance_m numeric,
  avg_hr int,
  rpe int check (rpe between 1 and 10),
  pain_reported boolean not null default false,
  pain_notes text,
  athlete_notes text,
  -- Forward-compatible with the activity-integration abstraction (Phase
  -- 8) -- same column/purpose as workout_completions.strava_activity_id,
  -- not wired to a sync job yet in this migration.
  strava_activity_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_completed_workouts_athlete_id on public.completed_workouts (athlete_id);

-- Workout-specific comments -- kept attached to the workout it's about
-- (see the product brief's "can I move Thursday's workout" example),
-- distinct from the general coach<->athlete message thread (added next
-- migration). Either party (coach or athlete on that workout) can post.
create table public.workout_comments (
  id uuid primary key default gen_random_uuid(),
  scheduled_workout_id uuid not null references public.scheduled_workouts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index idx_workout_comments_workout_id on public.workout_comments (scheduled_workout_id, created_at);

alter table public.workout_templates enable row level security;
alter table public.workout_template_steps enable row level security;
alter table public.scheduled_workouts enable row level security;
alter table public.scheduled_workout_steps enable row level security;
alter table public.completed_workouts enable row level security;
alter table public.workout_comments enable row level security;

-- workout_templates / workout_template_steps: coach-only, own library.
-- Never shown to an athlete -- a template becomes visible to its athlete
-- only once copied into a scheduled_workout.
create policy "workout_templates_all_own" on public.workout_templates
  for all to authenticated using ((select auth.uid()) = coach_id) with check ((select auth.uid()) = coach_id);

create policy "workout_template_steps_all_own" on public.workout_template_steps
  for all to authenticated using (
    exists (select 1 from public.workout_templates t where t.id = template_id and t.coach_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.workout_templates t where t.id = template_id and t.coach_id = (select auth.uid()))
  );

-- scheduled_workouts: coach has full CRUD over workouts they authored, for
-- an athlete they actually, actively coach -- athlete can only select
-- their own, and only once published (an unpublished/draft workout is
-- invisible to the athlete, same convention as
-- group_plan_workouts_select_member).
--
-- coaches_this_athlete(athlete_id) is required here, not just
-- coach_id = auth.uid() -- pre-fix, this policy let any private_coach-
-- permitted account create/publish a workout targeting ANY athlete_id in
-- the system, with no coach_athletes relationship required at all (caught
-- in the pre-apply security audit). scheduled_workout_steps and
-- workout_comments both reference this table via a plain subquery (not a
-- security-definer bypass), so Postgres re-applies this same, now-correct
-- policy when resolving those -- this one fix closes all three, and also
-- means a coach's access to their own historically-created workouts is
-- correctly revoked the instant coaches_this_athlete() goes false (i.e.
-- the relationship ends), matching every other coach-facing policy in this
-- product.
create policy "scheduled_workouts_all_coach" on public.scheduled_workouts
  for all to authenticated
  using ((select auth.uid()) = coach_id and public.coaches_this_athlete(athlete_id))
  with check ((select auth.uid()) = coach_id and public.coaches_this_athlete(athlete_id));
create policy "scheduled_workouts_select_athlete" on public.scheduled_workouts
  for select to authenticated using ((select auth.uid()) = athlete_id and published_at is not null);

create policy "scheduled_workout_steps_all_coach" on public.scheduled_workout_steps
  for all to authenticated using (
    exists (select 1 from public.scheduled_workouts w where w.id = scheduled_workout_id and w.coach_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.scheduled_workouts w where w.id = scheduled_workout_id and w.coach_id = (select auth.uid()))
  );
create policy "scheduled_workout_steps_select_athlete" on public.scheduled_workout_steps
  for select to authenticated using (
    exists (
      select 1 from public.scheduled_workouts w
      where w.id = scheduled_workout_id and w.athlete_id = (select auth.uid()) and w.published_at is not null
    )
  );

-- completed_workouts: athlete owns their own completion (full CRUD, so
-- they can correct a logged entry) -- with-check additionally requires the
-- referenced scheduled_workout_id to actually belong to that same athlete
-- (pre-fix, athlete_id = auth.uid() alone let one athlete insert a
-- completion against a DIFFERENT athlete's scheduled_workout_id, squatting
-- the unique slot and blocking that athlete's own real completion --
-- caught in the pre-apply security audit; the app's own
-- completeScheduledWorkout action already independently checked this
-- before writing, but RLS is the real boundary, not app code). Coach gets
-- read-only access -- no coach-side update policy: nothing in this product
-- ever edits an athlete's own submitted RPE/distance/pain report on their
-- behalf, and a coach-write policy here would be a silent tampering vector
-- with zero corresponding feature (also caught in the audit; the original
-- "coach can... update, e.g. marking reviewed later" policy was removed
-- outright rather than narrowed, since no "reviewed" concept exists
-- anywhere in this schema).
create policy "completed_workouts_all_own" on public.completed_workouts
  for all to authenticated
  using ((select auth.uid()) = athlete_id)
  with check (
    (select auth.uid()) = athlete_id
    and exists (
      select 1 from public.scheduled_workouts w
      where w.id = scheduled_workout_id and w.athlete_id = (select auth.uid())
    )
  );
create policy "completed_workouts_select_coach" on public.completed_workouts
  for select to authenticated using (public.coaches_this_athlete(athlete_id));

-- workout_comments: either party on the underlying workout can read/post;
-- deleting is limited to your own comment (no editing history games).
create policy "workout_comments_select_participant" on public.workout_comments
  for select to authenticated using (
    exists (
      select 1 from public.scheduled_workouts w
      where w.id = scheduled_workout_id
        and ((select auth.uid()) = w.coach_id or (select auth.uid()) = w.athlete_id)
    )
  );
-- Athlete side additionally requires published_at is not null -- matching
-- scheduled_workouts_select_athlete's own gate, since an athlete has no
-- other way to legitimately learn a draft's scheduled_workout_id in the
-- first place (caught in the pre-apply security audit, low severity: the
-- id isn't practically guessable). The coach side is deliberately left
-- without that condition -- a coach commenting/noting on their own
-- not-yet-published draft is a real, intended case, unlike the athlete
-- side.
create policy "workout_comments_insert_participant" on public.workout_comments
  for insert to authenticated with check (
    (select auth.uid()) = author_id
    and exists (
      select 1 from public.scheduled_workouts w
      where w.id = scheduled_workout_id
        and (
          (select auth.uid()) = w.coach_id
          or ((select auth.uid()) = w.athlete_id and w.published_at is not null)
        )
    )
  );
create policy "workout_comments_delete_own" on public.workout_comments
  for delete to authenticated using ((select auth.uid()) = author_id);
