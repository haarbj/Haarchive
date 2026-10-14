-- Private coaching's own day-labeling vocabulary, deliberately decoupled
-- from the shared public.workout_type enum (used structurally by the
-- self-serve/team generation engine's pace-zone/template/prescription
-- logic -- extending it would ripple into all three products). day_label
-- is plain free text with an app-level <datalist> of suggested values, not
-- a Postgres enum -- private coaching's vocabulary should never need a
-- migration just to add a new label a coach wants. day_label must never be
-- translated into or compared against workout_type.
alter table public.scheduled_workouts
  add column day_label text,
  -- Plain nullable text, not a CHECK-constrained enum -- this is a session
  -- slot concept (a coach may eventually want Double/Midday/Other, not
  -- just AM/PM), and the suggested AM/PM values are an app-level
  -- <datalist>, so adding a third slot later needs no migration.
  add column session_slot text,
  -- Flat array of exact display strings (e.g. {'Strides','Drills','10 min
  -- mobility'}) -- an annotation list, not a relational entity. Suggested
  -- values are normalized to their exact label; free-typed entries are
  -- stored verbatim.
  add column extras text[],
  add column planned_distance_max_m numeric;

-- Explicit distance-range invariants, enforced here as a backstop (the app
-- layer validates the same rule for a real error message): min-only is a
-- point value, min+max is a range, a max without a min or a max below the
-- min are both invalid.
alter table public.scheduled_workouts
  add constraint scheduled_workouts_distance_range_valid check (
    planned_distance_max_m is null
    or (planned_distance_m is not null and planned_distance_max_m >= planned_distance_m)
  );

alter table public.workout_templates
  add column day_label text;
