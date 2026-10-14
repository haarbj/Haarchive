-- Provenance-only links from real, athlete-facing rows back to the Program
-- they were generated from -- exactly the gap rescalePhaseMileage's own
-- header comment (schedule/actions.ts) flags for the older training-plans
-- system, where a phase's source plan has to be re-derived by matching
-- phase_type text + week count against the static TRAINING_PLANS array
-- because nothing stores it directly. These columns close that gap for the
-- new Program system from day one: a future "resync/rescale this phase
-- from its Program" action can look the source up directly, no guessing.
--
-- Never a live reference -- on delete set null, not cascade, so deleting
-- or editing a Program later never retroactively touches or deletes an
-- athlete's already-generated real training (the same copy-not-reference
-- discipline template_id already established on scheduled_workouts).
alter table public.training_phases
  add column source_program_id uuid references public.training_programs (id) on delete set null,
  add column source_program_phase_definition_id uuid references public.program_phase_definitions (id) on delete set null,
  add column source_program_duration_variant_id uuid references public.program_duration_variants (id) on delete set null;

alter table public.scheduled_workouts
  add column source_program_day_id uuid references public.program_days (id) on delete set null;
