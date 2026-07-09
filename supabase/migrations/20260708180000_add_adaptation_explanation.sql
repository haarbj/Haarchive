-- adaptation_reason already holds the athlete's own words (see its comment
-- in 20260708160000). The UX refresh separates that from the coach's own
-- distilled explanation of why the change was made, so both can be shown
-- as a small "You said / Coach's reasoning" timeline instead of one
-- ambiguous quoted line.
alter table public.workouts
  add column adaptation_explanation text;

comment on column public.workouts.adaptation_explanation is
  'The coach''s own explanation of why the current adaptation was made (from the AI response at the time it was applied), shown alongside adaptation_reason (the athlete''s original request). Null if never adapted or after Undo.';
