-- program_phase_weeks originally shipped with only `label` (a short tag,
-- e.g. "Peak Week", surfaced inline next to a week's date and mirrored
-- into training_week_plans.label at assignment time). Real coach-authored
-- programs also carry a genuinely longer week-level narrative -- coaching
-- commentary explaining the purpose/focus of that week, distinct from any
-- one day's own prescription -- for which `label` was never the right
-- shape (it would overload a short-tag field meant for the athlete-facing
-- roadmap with a multi-paragraph note). `notes` mirrors the same
-- free-text, no-length-limit convention every other program_*/training_*
-- table's own `notes` column already uses (program_phase_definitions,
-- program_days, training_phases) -- authoring/reference content for the
-- coach, never generated into an athlete's schedule (unlike `label`,
-- which does flow into training_week_plans.label via
-- assign_program_generation).
alter table public.program_phase_weeks
  add column notes text;
