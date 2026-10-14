-- Private 1-on-1 coaching, Phase 1: extend private-coach read access onto
-- the existing, product-agnostic profile/onboarding tables.
--
-- goals, race_results, injuries, and athlete_profiles are already generic
-- per-user tables, not specific to the self-serve or team products (see
-- Phase 0 audit) -- reused outright here rather than duplicated. All
-- policies are additive (Postgres ORs permissive policies for the same
-- command), so nothing an athlete already has access to is narrowed.
--
-- athlete_profiles and goals already carry a coach policy from
-- coach_athlete_rls.sql, but it's scoped to the team-based coaches_athlete()
-- helper; race_results and injuries have never had a coach policy at all
-- (a real gap noted in the audit). All four get the same private-coach
-- read access here, via coaches_this_athlete().
--
-- Read-only, deliberately -- a private coach reviewing an athlete's
-- profile/goals/races/injuries doesn't need to edit them on the athlete's
-- behalf; the athlete owns and edits their own onboarding data via
-- Settings, same as today.
create policy "athlete_profiles_select_private_coach" on public.athlete_profiles
  for select to authenticated using (public.coaches_this_athlete(user_id));

create policy "goals_select_private_coach" on public.goals
  for select to authenticated using (public.coaches_this_athlete(user_id));

create policy "race_results_select_private_coach" on public.race_results
  for select to authenticated using (public.coaches_this_athlete(user_id));

create policy "injuries_select_private_coach" on public.injuries
  for select to authenticated using (public.coaches_this_athlete(user_id));

-- profiles: a private coach needs to resolve their athlete's display
-- name/avatar (roster, workout headers, message thread), same as the
-- team-based coaches_athlete() policy already grants for team coaches.
create policy "profiles_select_private_coach" on public.profiles
  for select to authenticated using (public.coaches_this_athlete(id));
