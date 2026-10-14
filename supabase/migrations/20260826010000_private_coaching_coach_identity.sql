-- Two small, additive columns on profiles for private coaches specifically:
--
-- coach_display_name: an optional name shown to athletes in coaching
-- contexts (their coaching-home intro, messages, workout comments)
-- instead of the account's regular display_name -- e.g. "Coach Haar" to
-- athletes vs. "Brody Haar" when commenting on an article or asking a
-- question. Null means "no override, use display_name" -- this is
-- deliberately just a name override, not the fuller separate-persona
-- system (own avatar/bio/switchable identity) discussed and set aside as
-- a real future idea, not something to build before real coaches are
-- using this.
--
-- coach_trains_self: whether a private coach also trains/races themselves.
-- Settings needs this to decide whether to show Athlete Profile/Race
-- Results/Injuries to a coach-only account ("no reason for all this
-- random data" if they never run) -- but it can't be inferred from
-- isAthlete/isCoachedAthlete alone, since most site visitors who fill in
-- those sections have neither a team_memberships row nor a coach_athletes
-- row at all (the whole site is open to self-directed runners, see the
-- four-domain IA migration's own comment in sections.ts). Null means "a
-- private coach who hasn't answered the required onboarding question yet"
-- (see /coaching's own prompt) -- always null for a non-coach, who is
-- never asked.
alter table public.profiles add column coach_display_name text;
alter table public.profiles add column coach_trains_self boolean;

-- No RLS changes needed: profiles_update_own / profiles_select_own (see
-- 20260708123358_rls_policies.sql) are row-level policies with no
-- column-level restriction, so they already cover these two new columns
-- exactly like every other profiles column.
