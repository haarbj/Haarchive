-- Phase 3.1 integrity audit: note_taken was the one repeatable learning
-- signal with no day-scoping at all, unlike content_engaged/topic_revisited
-- (see idx_learning_events_once_per_day in the learning_progress
-- migration). Since algorithm.ts's diminishing-returns curve floors at 25%
-- of base weight rather than zero, an unlimited same-day count of trivial
-- (>=15 character, per notes/actions.ts) notes could buy real score and
-- activeSignalCount in a single sitting -- the one gap in an otherwise
-- consistent "trivial repetition can't masquerade as learning" guarantee.
-- This mirrors idx_learning_events_once_per_day's own exact expression
-- rather than widening that index's WHERE list, to avoid dropping/
-- recreating an index already serving production traffic.
create unique index idx_learning_events_note_once_per_day
  on public.learning_events (user_id, topic_id, event_type, ((created_at at time zone 'utc')::date))
  where event_type = 'note_taken';
