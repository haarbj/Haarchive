-- program_volume_variants / program_phase_week_volumes, plus the
-- program_days and program_phase_weeks columns the five seeded marathon
-- frameworks (Canyon/Mesa/Ridge/Peak/Summit -- see
-- scripts/data/framework-seeds/) genuinely need and that today's schema
-- cannot express.
--
-- WHY A SECOND VARIANT AXIS. program_duration_variants (20260925010000) is
-- plan LENGTH -- "12-Week" vs "18-Week" -- and composes a different set of
-- phase definitions per variant. Peak volume is an orthogonal axis: Canyon
-- at a 40 mi/wk peak and Canyon at a 50 mi/wk peak are the SAME 18 weeks,
-- the SAME phase composition, and (verified across all five seed files)
-- the SAME day-by-day prescription text -- they differ ONLY in each week's
-- goal mileage. Modelling that as a duration variant would force a second
-- full set of phase definitions and a duplicated, hand-synced copy of all
-- 126 authored days per volume level, which is exactly the duplication
-- program_variant_phases' own header comment exists to avoid. So volume is
-- its own small table hanging off the program, and the per-week goal
-- figures hang off (volume variant x phase week) rather than off the days.
--
-- This is also why goal mileage is NOT stored on program_days and NOT
-- summed from them: a week's goal mileage in these frameworks is an
-- authored target the athlete distributes across the week themselves ("3-5
-- mi easy", "adjust easy run lengths as needed to hit the weekly total"),
-- not the sum of the day rows. That makes it genuinely independent
-- authored data here -- the opposite of program_phase_weeks' own
-- deliberate refusal to store a target volume (20260925020000), which was
-- correct for a plan whose days ARE the volume. Both coexist: a program
-- with no volume variants behaves exactly as before.
--
-- Nothing here is athlete-visible on its own. A volume variant becomes
-- real athlete data only when assignment copies the selected variant's
-- per-week goal mileage into training_week_plans.target_volume_min/_max
-- (see the companion assign_program_generation migration) -- the same
-- copy-not-reference discipline every other part of this layer uses.

-- A named peak-volume level of one program -- "Canyon 40 mi/wk" vs "Canyon
-- 50 mi/wk". variant_key is the seed files' own stable identifier
-- ("canyon-40"), used to make re-seeding idempotent and to key the
-- per-week goal figures; name is what a coach actually reads. peak/initial
-- mileage are the framework's own published figures for THIS level, which
-- is why they live here and not only in training_programs' program-wide
-- peak_mileage_min/_max range (that range spans every variant: Canyon is
-- 40-50 across both, while each variant is a single number).
create table public.program_volume_variants (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.training_programs (id) on delete cascade,
  variant_key text not null,
  name text not null,
  position int not null,
  peak_mileage numeric,
  initial_mileage numeric,
  -- Which level the assignment form pre-selects. Deliberately NOT enforced
  -- unique per program: a program with no default (nothing pre-selected,
  -- the coach must choose) is a legitimate, and arguably safer, state --
  -- same reasoning program_duration_variants.is_default already follows.
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (program_id, variant_key),
  unique (program_id, position),
  constraint program_volume_variants_mileage_positive check (
    (peak_mileage is null or peak_mileage > 0) and (initial_mileage is null or initial_mileage > 0)
  )
);
create index idx_program_volume_variants_program_id on public.program_volume_variants (program_id);

-- One week's goal mileage for one volume variant, keyed the same way
-- program_phase_weeks is (phase definition + phase-relative week number)
-- so it lines up with the authored days without needing a plan-absolute
-- week number anywhere.
--
-- goal_mileage_label is the seed's own string, stored VERBATIM and never
-- reconstructed from the numbers below -- the frameworks' real values
-- include plain totals ("70"), ranges ("85-90"), and a deliberate "n/a"
-- for race week, where no weekly total is prescribed at all. The numeric
-- min/max pair is the parsed form for the figures that are genuinely
-- numeric, left NULL for "n/a"; display always prefers the label, math
-- always uses the numbers, and neither has to guess what the other meant.
create table public.program_phase_week_volumes (
  id uuid primary key default gen_random_uuid(),
  volume_variant_id uuid not null references public.program_volume_variants (id) on delete cascade,
  phase_definition_id uuid not null references public.program_phase_definitions (id) on delete cascade,
  week_number int not null check (week_number >= 1),
  goal_mileage_label text not null,
  goal_mileage_min numeric,
  goal_mileage_max numeric,
  unique (volume_variant_id, phase_definition_id, week_number),
  constraint program_phase_week_volumes_range_valid check (
    goal_mileage_max is null or (goal_mileage_min is not null and goal_mileage_max >= goal_mileage_min)
  ),
  constraint program_phase_week_volumes_mileage_positive check (
    goal_mileage_min is null or goal_mileage_min > 0
  )
);
create index idx_program_phase_week_volumes_phase_definition_id
  on public.program_phase_week_volumes (phase_definition_id);
create index idx_program_phase_week_volumes_volume_variant_id
  on public.program_phase_week_volumes (volume_variant_id);

-- AM/PM DOUBLES. program_days already carries session_slot
-- (20260925020000) but its uniqueness key stopped at
-- (phase_definition_id, week_number, day_of_week) -- one authored row per
-- calendar day -- which silently made doubles unauthorable even though
-- the column to describe them existed. Ridge/Peak/Summit are built on
-- doubles (156/181/211 real sessions across their 126 day slots), so the
-- key widens to include the slot. scheduled_workouts, the generated side,
-- never had a per-day uniqueness constraint at all, so it already
-- supported two sessions on one date -- this only brings the template
-- layer up to what the athlete-facing layer could always represent.
--
-- coalesce(session_slot, 'single') rather than the raw nullable column:
-- in Postgres two NULLs don't conflict, so a bare 4-column unique
-- constraint would let an unlimited number of slot-less rows pile up on
-- one day -- precisely the duplicate the old 3-column key did prevent.
-- Coalescing keeps "one slot-less session per day" a real constraint
-- while letting an explicit AM and PM coexist beside it.
do $$
begin
  alter table public.program_days
    drop constraint if exists program_days_phase_definition_id_week_number_day_of_week_key;
end $$;

create unique index idx_program_days_slot_unique
  on public.program_days (phase_definition_id, week_number, day_of_week, coalesce(session_slot, 'single'));

-- Fails loudly if the dropped constraint was ever named something else in
-- this database (a hand-applied or externally-modified schema): a
-- surviving 3-column unique key would make seeding doubles fail with a
-- confusing conflict error at insert time instead of here, where the
-- cause is obvious.
do $$
declare
  v_leftover text;
begin
  select con.conname into v_leftover
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'program_days'
    and con.contype = 'u'
    and (
      select array_agg(att.attname::text order by att.attname::text)
      from unnest(con.conkey) k
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k
    ) = array['day_of_week', 'phase_definition_id', 'week_number']::text[]
  limit 1;

  if v_leftover is not null then
    raise exception
      'program_days still has a day-level unique constraint (%) that blocks AM/PM doubles; drop it before re-running this migration',
      v_leftover;
  end if;
end $$;

alter table public.program_days
  -- A session the framework itself marks optional -- Ridge's and Summit's
  -- secondary runs ("can be rearranged, redistributed, or skipped"). Real
  -- authored intent, not a coach's later edit, so it belongs on the
  -- template and is carried onto the generated workout at assignment time.
  add column is_optional boolean not null default false,
  -- The framework's own stated substitute for this session, verbatim --
  -- Peak's and Summit's single-session alternatives to a double-threshold
  -- day and single-workout alternatives to a special block. Free text, not
  -- a second structured day: the sources state these as prose
  -- replacements, and modelling them as a parallel day row would force
  -- this schema to invent which parts of the alternative map onto which
  -- authored fields.
  add column alternative_text text,
  -- The framework's difficulty rating exactly as published ("7/10",
  -- "8.5-9/10", "9-9.5/10"). planned_rpe/_max remain the integer field
  -- every existing editor and display already reads, but they cannot hold
  -- a half point, so the verbatim string is preserved here and is the
  -- authoritative value; the seed derives planned_rpe/_max from it as the
  -- containing integer envelope (7.5 -> 7..8), which widens the rating
  -- rather than rounding it into a single number it never claimed.
  add column difficulty_label text;

alter table public.program_phase_weeks
  -- The frameworks' own end-of-week "revise your fitness estimate"
  -- checkpoints, and the single week where the estimate basis converts
  -- from % of 5k pace to % of marathon pace. Two separate flags because
  -- they are separate events in the sources and co-occur only sometimes
  -- (Mesa converts at the end of week 8, which is also a revision week;
  -- Summit converts at the end of week 6, which is not).
  add column revise_fitness_estimate boolean not null default false,
  add column convert_fitness_estimate_to_mp boolean not null default false;

alter table public.training_programs
  -- A stable identifier for a seeded framework ("canyon"), so re-running
  -- the seed updates the existing program instead of creating a second
  -- copy, and so code that must find a specific framework does not match
  -- on a user-editable display name. NULL for every coach-authored
  -- program, which is the normal case -- this marks seeded methodology
  -- content only.
  add column framework_key text,
  -- The event this program builds toward ("marathon"). Free text for the
  -- same reason training_phases.phase_type is: the vocabulary is a
  -- coach's, not this platform's. Drives the "Distance: Marathon" line in
  -- the program header; the MVP seeds marathon frameworks only, but
  -- nothing here is marathon-specific.
  add column event_distance text,
  -- Provenance for seeded content: which source documents this program was
  -- transcribed from, and how conflicts between them were settled. Carried
  -- from each seed file's own `source` field so the program can state where
  -- its numbers came from without that living only in a script.
  add column source_reference text;

-- One seeded framework per coach -- re-seeding is an update, never a
-- silent duplicate. Partial so the column stays NULL-able for the
-- coach-authored programs that have no framework key at all.
create unique index idx_training_programs_framework_key_per_coach
  on public.training_programs (coach_id, framework_key) where framework_key is not null;

alter table public.training_phases
  -- Which peak-volume level produced this athlete's phase, alongside the
  -- program/phase-definition/duration-variant provenance already recorded
  -- (20260925030000). Set null on delete, exactly like its siblings: losing
  -- the variant must never cascade into deleting an athlete's real
  -- training history.
  add column source_program_volume_variant_id uuid
    references public.program_volume_variants (id) on delete set null;

alter table public.program_volume_variants enable row level security;
alter table public.program_phase_week_volumes enable row level security;

-- Coach-only, own library -- verbatim mirror of
-- program_duration_variants_all_own / program_phase_weeks_all_own
-- (20260925010000/20260925020000). Never athlete-visible at any layer;
-- only the generated output is.
create policy "program_volume_variants_all_own" on public.program_volume_variants
  for all to authenticated using (
    exists (select 1 from public.training_programs p where p.id = program_id and p.coach_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.training_programs p where p.id = program_id and p.coach_id = (select auth.uid()))
  );

create policy "program_phase_week_volumes_all_own" on public.program_phase_week_volumes
  for all to authenticated using (
    exists (
      select 1 from public.program_volume_variants v
      join public.training_programs p on p.id = v.program_id
      where v.id = volume_variant_id and p.coach_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.program_volume_variants v
      join public.training_programs p on p.id = v.program_id
      where v.id = volume_variant_id and p.coach_id = (select auth.uid())
    )
  );
