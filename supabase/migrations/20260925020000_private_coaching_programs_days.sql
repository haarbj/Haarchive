-- program_days / program_day_steps / program_day_extras / program_phase_
-- weeks: the actual day-by-day workout content behind a
-- program_phase_definition -- deliberately the SAME columns workout_
-- templates/workout_template_steps/workout_template_extras already carry
-- (20260826140000/20260827090000/20260826090000), not a reinvented shape,
-- keyed to (phase_definition_id, week_number, day_of_week) instead of
-- standing alone as an athlete-agnostic single-day template.
--
-- This week_number/day_of_week keying is this version's scheduling model
-- -- every attached example template is week-structured, so that's what's
-- built -- not a claim that every future coaching methodology must be
-- week-shaped. A session-count-based or freeform date-list plan structure
-- would be a bounded, identifiable extension of this schema later (a
-- different keying on program_days, or a sibling table), not a rewrite of
-- anything else here.
--
-- program_id is denormalized onto program_days (and not required to be
-- re-derived via phase_definition_id on every RLS check) for the same
-- reason scheduled_workouts denormalizes athlete_id/coach_id
-- (20260825020000's own comment) -- a direct equality instead of an extra
-- join on every row, including for program_day_steps/_extras' own RLS,
-- which join through program_days.program_id rather than through
-- phase_definition_id.
--
-- Distance/duration/pace/HR/RPE below are always the plan's own
-- AS-AUTHORED reference figures, never pre-scaled to any one athlete --
-- program-generation.ts's resolveProgramGeneration scales every day
-- proportionally to a coach-chosen target peak at assignment time, reusing
-- scaleForTargetPeak/scaleDistance (training-plans/template.ts) verbatim --
-- the exact math the older training-plans/plan-import.ts system already
-- uses for the same purpose, not a reinvented one. A day slot with no
-- program_days row is simply unauthored, not an error at write time --
-- completeness is checked at read/assignment time (see the generation
-- engine's warnings machinery), never enforced by a NOT NULL/required-row
-- constraint here.
create table public.program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.training_programs (id) on delete cascade,
  phase_definition_id uuid not null references public.program_phase_definitions (id) on delete cascade,
  week_number int not null check (week_number >= 1),
  -- 1=Monday .. 7=Sunday, matching this product's Monday-aligned week
  -- convention throughout (mostRecentMonday/addDays, week.ts) -- not a
  -- real date, since a Program has no calendar dates of its own until
  -- assignment.
  day_of_week int not null check (day_of_week between 1 and 7),
  day_label text,
  session_slot text,
  planned_distance_m numeric,
  planned_distance_max_m numeric,
  planned_duration_s int,
  planned_duration_max_s int,
  planned_pace_s_per_mi int,
  planned_pace_max_s_per_mi int,
  pace_reference public.pace_reference,
  -- Percent-of-a-reference-pace, e.g. "50-60% of 5K pace" / "90-92% of
  -- marathon pace" (Canyon's own convention). Deliberately separate from
  -- pace_reference above (which always means exactly 100% of that
  -- reference, resolved LIVE, re-resolved every time it's displayed -- the
  -- exact contract pace_reference already has on workout_templates/
  -- scheduled_workouts and must not change here). This column pair means
  -- "resolve a percent range against a coach-confirmed reference pace
  -- ONCE, at assignment time" -- structurally identical to how the older
  -- training-plans/plan-import.ts system already solves this exact prose
  -- convention (its own PACE_PERCENT_PATTERN/computePaceTarget), via
  -- computeWorkoutPaceSeconds (pace-percent-math.ts), baking a literal
  -- planned_pace_s_per_mi/_max range into the real generated
  -- scheduled_workout -- never a live/continuously-resolving value. Scoped
  -- to program_days/program_day_steps only, not added to workout_
  -- templates/scheduled_workouts: a coach hand-building one workout for
  -- one real athlete has no reason to defer this resolution -- they just
  -- compute and type the literal pace once, same as today.
  pace_percent_basis public.pace_reference,
  pace_percent_min numeric,
  pace_percent_max numeric,
  planned_hr_bpm int,
  planned_hr_max_bpm int,
  planned_rpe int check (planned_rpe between 1 and 10),
  planned_rpe_max int check (planned_rpe_max between 1 and 10),
  -- Lets a coach explicitly mark one authored day as "this slot is race
  -- day itself" (e.g. the final week's Sunday), so the event is a real,
  -- coach-authored workout, not inferred from day_label text. At most one
  -- such row per program is enforced by the partial unique index below;
  -- the generation engine (program-generation.ts) also independently
  -- re-checks this invariant as defense in depth, since legacy or
  -- externally-modified data could in principle bypass application
  -- writes. Entirely optional: a Program with no marked day treats a
  -- target event date as purely informational.
  is_event_day boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (phase_definition_id, week_number, day_of_week),
  constraint program_days_distance_range_valid check (
    planned_distance_max_m is null or (planned_distance_m is not null and planned_distance_max_m >= planned_distance_m)
  ),
  constraint program_days_duration_range_valid check (
    planned_duration_max_s is null or (planned_duration_s is not null and planned_duration_max_s >= planned_duration_s)
  ),
  constraint program_days_pace_range_valid check (
    planned_pace_max_s_per_mi is null or (planned_pace_s_per_mi is not null and planned_pace_max_s_per_mi >= planned_pace_s_per_mi)
  ),
  constraint program_days_hr_range_valid check (
    planned_hr_max_bpm is null or (planned_hr_bpm is not null and planned_hr_max_bpm >= planned_hr_bpm)
  ),
  constraint program_days_rpe_range_valid check (
    planned_rpe_max is null or (planned_rpe is not null and planned_rpe_max >= planned_rpe)
  ),
  constraint program_days_pace_reference_exclusive check (
    pace_reference is null or (planned_pace_s_per_mi is null and planned_pace_max_s_per_mi is null)
  ),
  constraint program_days_pace_percent_requires_basis check (
    (pace_percent_min is null and pace_percent_max is null) or pace_percent_basis is not null
  ),
  constraint program_days_pace_percent_exclusive check (
    pace_percent_basis is null or (pace_reference is null and planned_pace_s_per_mi is null and planned_pace_max_s_per_mi is null)
  ),
  constraint program_days_pace_percent_range_valid check (
    pace_percent_max is null or (pace_percent_min is not null and pace_percent_max >= pace_percent_min)
  )
);
create index idx_program_days_phase_definition_id on public.program_days (phase_definition_id);
create index idx_program_days_program_id on public.program_days (program_id);
-- At most one event-day slot per program -- the real, primary defense;
-- program-generation.ts's own scan is defense in depth on top of this.
create unique index idx_program_days_one_event_day_per_program on public.program_days (program_id) where is_event_day;

create table public.program_day_steps (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references public.program_days (id) on delete cascade,
  step_order int not null,
  step_type public.workout_step_type not null,
  duration_s int,
  duration_max_s int,
  distance_m numeric,
  distance_max_m numeric,
  target_type public.workout_target_type not null default 'open',
  target_min numeric,
  target_max numeric,
  target_unit text,
  target_pace_reference public.pace_reference,
  -- Step-level counterpart of program_days' own pace_percent_* trio above
  -- -- same reasoning, same mutual exclusivity, scoped to when a single
  -- structured interval within a day needs its own percent-of-pace target
  -- distinct from the day's overall one (e.g. a progression run's later
  -- reps running faster than its earlier ones).
  target_pace_percent_basis public.pace_reference,
  target_pace_percent_min numeric,
  target_pace_percent_max numeric,
  repetitions int,
  rest_s int,
  instructions text,
  unique (program_day_id, step_order),
  constraint program_day_steps_duration_range_valid check (
    duration_max_s is null or (duration_s is not null and duration_max_s >= duration_s)
  ),
  constraint program_day_steps_distance_range_valid check (
    distance_max_m is null or (distance_m is not null and distance_max_m >= distance_m)
  ),
  constraint program_day_steps_pace_reference_exclusive check (
    target_pace_reference is null or (target_min is null and target_max is null)
  ),
  constraint program_day_steps_pace_reference_type_valid check (
    target_pace_reference is null or target_type = 'pace'
  ),
  constraint program_day_steps_pace_percent_requires_basis check (
    (target_pace_percent_min is null and target_pace_percent_max is null) or target_pace_percent_basis is not null
  ),
  constraint program_day_steps_pace_percent_exclusive check (
    target_pace_percent_basis is null or (target_pace_reference is null and target_min is null and target_max is null)
  ),
  constraint program_day_steps_pace_percent_type_valid check (
    target_pace_percent_basis is null or target_type = 'pace'
  ),
  constraint program_day_steps_pace_percent_range_valid check (
    target_pace_percent_max is null or (target_pace_percent_min is not null and target_pace_percent_max >= target_pace_percent_min)
  )
);
create index idx_program_day_steps_program_day_id on public.program_day_steps (program_day_id);

create table public.program_day_extras (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references public.program_days (id) on delete cascade,
  extra_order int not null,
  kind text not null,
  overview text,
  count int,
  distance_m numeric,
  duration_s int,
  items text[]
);
create index idx_program_day_extras_program_day_id on public.program_day_extras (program_day_id);

-- An optional, coach-authored label for one specific week of a phase (e.g.
-- "Peak Week," "Down Week") -- the Program-authoring-time equivalent of
-- training_week_plans.label, carried forward into the real generated
-- training_week_plans row at assignment time. Deliberately holds NO
-- target-volume figure -- a week's real target volume is always the sum of
-- that week's own (scaled) program_days at generation time, never
-- separately authored here, so the two can never drift apart (same
-- "derive, don't duplicate" discipline training-phases.ts's own
-- getPhaseForWeek uses). A week with no row here is completely normal --
-- most weeks won't need a label, same as most training_week_plans rows
-- today have none.
create table public.program_phase_weeks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.training_programs (id) on delete cascade,
  phase_definition_id uuid not null references public.program_phase_definitions (id) on delete cascade,
  week_number int not null check (week_number >= 1),
  label text,
  unique (phase_definition_id, week_number)
);
create index idx_program_phase_weeks_phase_definition_id on public.program_phase_weeks (phase_definition_id);

alter table public.program_days enable row level security;
alter table public.program_day_steps enable row level security;
alter table public.program_day_extras enable row level security;
alter table public.program_phase_weeks enable row level security;

create policy "program_days_all_own" on public.program_days
  for all to authenticated using (
    exists (select 1 from public.training_programs p where p.id = program_id and p.coach_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.training_programs p where p.id = program_id and p.coach_id = (select auth.uid()))
  );

create policy "program_day_steps_all_own" on public.program_day_steps
  for all to authenticated using (
    exists (
      select 1 from public.program_days d
      join public.training_programs p on p.id = d.program_id
      where d.id = program_day_id and p.coach_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.program_days d
      join public.training_programs p on p.id = d.program_id
      where d.id = program_day_id and p.coach_id = (select auth.uid())
    )
  );

create policy "program_day_extras_all_own" on public.program_day_extras
  for all to authenticated using (
    exists (
      select 1 from public.program_days d
      join public.training_programs p on p.id = d.program_id
      where d.id = program_day_id and p.coach_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.program_days d
      join public.training_programs p on p.id = d.program_id
      where d.id = program_day_id and p.coach_id = (select auth.uid())
    )
  );

create policy "program_phase_weeks_all_own" on public.program_phase_weeks
  for all to authenticated using (
    exists (select 1 from public.training_programs p where p.id = program_id and p.coach_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.training_programs p where p.id = program_id and p.coach_id = (select auth.uid()))
  );
