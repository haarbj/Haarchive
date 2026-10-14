-- training_programs / program_phase_definitions / program_duration_variants
-- / program_variant_phases: the reusable, coach-authored methodology layer
-- above workout_templates -- a Program is "this coach's General->Supportive
-- ->Specific structure, offered as 12- and 18-week variants," never tied to
-- any one athlete, exactly analogous to how workout_templates is a coach's
-- reusable single-day library (see 20260825020000's own header comment).
-- Nothing here is athlete-visible; a Program only becomes real, athlete-
-- facing data once assign_program_generation() (see the provenance/RPC
-- migrations) copies it into training_phases/scheduled_workouts -- the
-- exact same copy-not-reference discipline workout_templates ->
-- scheduled_workouts already established.
--
-- Deliberately NOT a fork per plan duration: Supportive/Specific-style
-- phases that are genuinely identical across a coach's 12- and 18-week
-- variants are authored once (one program_phase_definitions row) and
-- referenced by both variants via program_variant_phases; a phase whose
-- content genuinely differs by variant (e.g. a shorter General) is simply
-- a second, independently-authored phase definition referenced by only
-- one variant. This avoids forcing a coach to duplicate and hand-sync
-- phases that are actually the same across their own plan lengths.

create table public.training_programs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  -- Whether assignment scales this program's authored distances/durations
  -- to an athlete's target peak weekly mileage -- two independent flags,
  -- both off by default, since neither is a universal assumption: a
  -- coach's methodology might not be mileage-driven at all, and even when
  -- it is, distance and duration aren't assumed to scale together just
  -- because one does (a coach may want fixed-duration recovery sessions
  -- that never lengthen just because peak mileage went up). The New
  -- Program form presents both as a real, explicit, un-pre-selected
  -- choice -- never silently defaulted on to match one coach's own needs.
  scales_distance_with_mileage boolean not null default false,
  scales_duration_with_mileage boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_training_programs_coach_id on public.training_programs (coach_id);

-- One ordered phase "blueprint" per program -- General/Supportive/Specific/
-- Base/whatever a coach calls their own methodology's blocks. phase_key is
-- free text with the same SUGGESTED_PHASE_TYPES <datalist> training_phases
-- already uses (training-phases.ts), never a closed enum -- a phase
-- definition's phase_key IS the eventual training_phases.phase_type,
-- copied verbatim at assignment time.
--
-- duration_weeks_min/_max is a real range, not a fixed number, so ONE
-- mechanism expresses both a fixed-length phase (min = max, e.g. General is
-- always exactly 10 weeks in an 18-week Canyon-style variant) and a
-- variable-length one (min < max, e.g. an optional Base Phase offered as
-- anywhere from 2-8 weeks of lead-in depending on how much time an athlete
-- has before their block needs to start) -- the coach picks the real count
-- within this range at assignment time (see program-generation.ts). is_
-- optional marks a phase (like Base) a coach may skip entirely for a given
-- athlete/variant at assignment time -- it does NOT mean duration_weeks_min
-- may be 0; skipping is a yes/no inclusion choice, not a zero-length phase.
create table public.program_phase_definitions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.training_programs (id) on delete cascade,
  phase_key text not null,
  name text,
  position int not null,
  duration_weeks_min int not null check (duration_weeks_min >= 1),
  duration_weeks_max int not null,
  is_optional boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  constraint program_phase_definitions_duration_range_valid check (duration_weeks_max >= duration_weeks_min),
  unique (program_id, position)
);
create index idx_program_phase_definitions_program_id on public.program_phase_definitions (program_id);

-- A named, selectable overall plan length ("12-Week", "18-Week") -- see
-- this migration's own header comment on why this is a variant OVER a
-- shared pool of phase_definitions, not two entirely separate Programs.
-- Total week count is deliberately NOT stored here -- always derived by
-- summing the variant's own program_variant_phases' phase_definitions'
-- selected duration at generation time, so it can never drift out of sync
-- with what's actually authored.
create table public.program_duration_variants (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.training_programs (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (program_id, name)
);
create index idx_program_duration_variants_program_id on public.program_duration_variants (program_id);

-- The many-to-many join deciding which phase_definitions compose a given
-- variant, and in what order -- a phase_definition (Supportive, say) can be
-- referenced by more than one variant unchanged; a variant-specific phase
-- (a differently-authored General for a 12-week vs. 18-week variant) is
-- simply a SEPARATE phase_definition row referenced by only one variant.
-- No duration override lives here on purpose -- if two variants genuinely
-- need a phase's length or content to differ, that's what a distinct
-- phase_definition is for; this table only composes and orders existing,
-- independently-defined phases.
create table public.program_variant_phases (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.program_duration_variants (id) on delete cascade,
  phase_definition_id uuid not null references public.program_phase_definitions (id) on delete cascade,
  position int not null,
  unique (variant_id, position),
  unique (variant_id, phase_definition_id)
);
create index idx_program_variant_phases_variant_id on public.program_variant_phases (variant_id);
create index idx_program_variant_phases_phase_definition_id on public.program_variant_phases (phase_definition_id);

alter table public.training_programs enable row level security;
alter table public.program_phase_definitions enable row level security;
alter table public.program_duration_variants enable row level security;
alter table public.program_variant_phases enable row level security;

-- Coach-only, own library -- verbatim mirror of workout_templates_all_own's
-- shape (see 20260825020000). Never athlete-visible at any layer; only a
-- Program's generated OUTPUT (real training_phases/scheduled_workouts rows)
-- is ever athlete-facing, exactly like workout_templates itself.
create policy "training_programs_all_own" on public.training_programs
  for all to authenticated using (coach_id = (select auth.uid())) with check (coach_id = (select auth.uid()));

create policy "program_phase_definitions_all_own" on public.program_phase_definitions
  for all to authenticated using (
    exists (select 1 from public.training_programs p where p.id = program_id and p.coach_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.training_programs p where p.id = program_id and p.coach_id = (select auth.uid()))
  );

create policy "program_duration_variants_all_own" on public.program_duration_variants
  for all to authenticated using (
    exists (select 1 from public.training_programs p where p.id = program_id and p.coach_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.training_programs p where p.id = program_id and p.coach_id = (select auth.uid()))
  );

create policy "program_variant_phases_all_own" on public.program_variant_phases
  for all to authenticated using (
    exists (
      select 1 from public.program_duration_variants v
      join public.training_programs p on p.id = v.program_id
      where v.id = variant_id and p.coach_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.program_duration_variants v
      join public.training_programs p on p.id = v.program_id
      where v.id = variant_id and p.coach_id = (select auth.uid())
    )
  );
