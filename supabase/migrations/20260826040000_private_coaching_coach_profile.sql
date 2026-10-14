-- Private 1-on-1 coaching: a coach's short bio + training philosophy,
-- readable by their own athlete(s). Deliberately just two more nullable
-- text columns on profiles, same pattern as coach_display_name/
-- coach_trains_self (20260826010000) -- a one-row-per-coach field, no
-- versioning/multiple-entries need, so no new table.
--
-- No new RLS policy: profiles_select_as_coached_athlete
-- (20260826020000's is_coached_by()) already grants an athlete SELECT on
-- their own coach's ENTIRE profiles row, not scoped to specific columns --
-- these two columns are covered by that existing grant automatically.
-- profiles_update_own (pre-existing) already covers the coach writing to
-- their own row the same way coach_display_name already does.
alter table public.profiles add column coach_bio text;
alter table public.profiles add column coach_philosophy text;
