-- Athlete-authored season goal: "what would make this season a success
-- for you," in the athlete's own words -- distinct from the structured
-- goal race (goals.race_name/goal_date/status, a fact) and distinct from
-- any future coach-defined success standard (a separate, later feature
-- this column is deliberately adjacent to in layout but not merged with
-- in data or authorship). One current value, no history in v1 -- editing
-- replaces it outright.
--
-- Lives on athlete_profiles, not a new table: this is one more fact
-- about the athlete (like training_background_summary, added the same
-- way), not an event with its own lifecycle the way a goal race is.
--
-- No RLS changes. athlete_profiles_select_own/_update_own (rls_policies
-- migration) and athlete_profiles_select_private_coach (existing-table-
-- access migration) are row-level policies -- they apply to every
-- column on the table, including this new one, with no per-column grant
-- restriction anywhere in this schema. There is deliberately no coach
-- UPDATE policy on athlete_profiles at all, and this migration adds
-- none: a coach can read this column through the exact same policy that
-- already lets them read training_background_summary, and has no write
-- path to it, full stop.
alter table public.athlete_profiles
  add column season_goal text check (char_length(season_goal) <= 500);

comment on column public.athlete_profiles.season_goal is
  'Athlete-authored, free text: what would make this season a success, in their own words. Athlete-writable only (no coach UPDATE policy exists on this table). Max 500 characters, enforced here and in the app layer. No history -- an edit replaces the current value.';
