-- Phase 5 (adaptive coaching) needs somewhere to keep the pre-adaptation
-- prescription so a proposed change can be undone, and to know when/why a
-- workout was last adapted so the UI can show "adjusted 2 hours ago" until
-- the athlete dismisses it. Kept directly on workouts rather than a new
-- table -- only one "currently visible adaptation" per workout matters at
-- a time.
alter table public.workouts
  add column original_prescription jsonb,
  add column adapted_at timestamptz,
  add column adaptation_reason text;

comment on column public.workouts.original_prescription is
  'Snapshot of prescription before the most recent adaptation; null if never adapted. Set once and preserved across repeated adaptations so Undo always restores the true original, not the prior adapted state.';
comment on column public.workouts.adapted_at is
  'When the current adaptation was applied; null if never adapted or after Undo.';
comment on column public.workouts.adaptation_reason is
  'The athlete''s own words for the request that produced the current adaptation (e.g. "I only have 35 minutes today").';
