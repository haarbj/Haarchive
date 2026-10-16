-- training_week_plans never carried the longer week-level coaching
-- narrative a Program's own program_phase_weeks.notes already holds (see
-- 20260925050000's own comment: "authoring/reference content for the
-- coach, never generated into an athlete's schedule"). That was true when
-- written, but it means a framework's hand-authored week notes -- real
-- coaching commentary explaining the purpose of that week, not a day's own
-- prescription -- never reach the athlete or the coach's own view of that
-- athlete's schedule, even though every other per-week field (label,
-- target volume) already does. This column closes that gap: notes mirrors
-- program_phase_weeks.notes' own free-text, no-length-limit shape, and
-- assign_program_generation/resync_program_phase_generation now copy it
-- across at assignment time exactly the way they already copy label.
--
-- A coach can also set/edit this directly on an athlete's own week via
-- WeekPlanEditor, same as label and target volume today -- it is not
-- read-only just because it can also arrive from a Program.
alter table public.training_week_plans
  add column notes text;
