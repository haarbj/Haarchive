-- Stage 2: lets a coach read/write their teammates' plan and practice data.
-- my_coach_team_id() already exists (added in the Stage 1 recursion fix);
-- this adds the remaining helpers and the actual coach-facing policies.
-- Every policy here is additive -- existing owner-only policies are
-- untouched, and Postgres ORs permissive policies for the same command, so
-- this can only widen access, never narrow what an athlete already has for
-- their own data.

create or replace function public.my_team_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select team_id from public.team_memberships where user_id = (select auth.uid());
$$;

create or replace function public.coaches_athlete(athlete_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.team_memberships athlete_tm
    where athlete_tm.user_id = athlete_id
      and athlete_tm.role = 'athlete'
      and athlete_tm.team_id = public.my_coach_team_id()
  );
$$;

create policy "profiles_select_team_coach" on public.profiles
  for select to authenticated using (public.coaches_athlete(id));

create policy "athlete_profiles_select_team_coach" on public.athlete_profiles
  for select to authenticated using (public.coaches_athlete(user_id));

-- Plan + practice data: full CRUD for a coach managing their roster.
create policy "goals_select_coach" on public.goals
  for select to authenticated using (public.coaches_athlete(user_id));
create policy "goals_insert_coach" on public.goals
  for insert to authenticated with check (public.coaches_athlete(user_id));
create policy "goals_update_coach" on public.goals
  for update to authenticated using (public.coaches_athlete(user_id)) with check (public.coaches_athlete(user_id));
create policy "goals_delete_coach" on public.goals
  for delete to authenticated using (public.coaches_athlete(user_id));

create policy "training_plans_select_coach" on public.training_plans
  for select to authenticated using (public.coaches_athlete(user_id));
create policy "training_plans_insert_coach" on public.training_plans
  for insert to authenticated with check (public.coaches_athlete(user_id));
create policy "training_plans_update_coach" on public.training_plans
  for update to authenticated using (public.coaches_athlete(user_id)) with check (public.coaches_athlete(user_id));
create policy "training_plans_delete_coach" on public.training_plans
  for delete to authenticated using (public.coaches_athlete(user_id));

create policy "mesocycles_select_coach" on public.mesocycles
  for select to authenticated using (public.coaches_athlete(user_id));
create policy "mesocycles_insert_coach" on public.mesocycles
  for insert to authenticated with check (public.coaches_athlete(user_id));
create policy "mesocycles_update_coach" on public.mesocycles
  for update to authenticated using (public.coaches_athlete(user_id)) with check (public.coaches_athlete(user_id));
create policy "mesocycles_delete_coach" on public.mesocycles
  for delete to authenticated using (public.coaches_athlete(user_id));

create policy "workouts_select_coach" on public.workouts
  for select to authenticated using (public.coaches_athlete(user_id));
create policy "workouts_insert_coach" on public.workouts
  for insert to authenticated with check (public.coaches_athlete(user_id));
create policy "workouts_update_coach" on public.workouts
  for update to authenticated using (public.coaches_athlete(user_id)) with check (public.coaches_athlete(user_id));
create policy "workouts_delete_coach" on public.workouts
  for delete to authenticated using (public.coaches_athlete(user_id));

-- Practice logs: read/write too, deliberately -- a coach who can't see how
-- practice actually went (RPE, actual pace) is missing the thing they'd
-- want first, and it's the identical pattern either way.
create policy "workout_completions_select_coach" on public.workout_completions
  for select to authenticated using (public.coaches_athlete(user_id));
create policy "workout_completions_insert_coach" on public.workout_completions
  for insert to authenticated with check (public.coaches_athlete(user_id));
create policy "workout_completions_update_coach" on public.workout_completions
  for update to authenticated using (public.coaches_athlete(user_id)) with check (public.coaches_athlete(user_id));
create policy "workout_completions_delete_coach" on public.workout_completions
  for delete to authenticated using (public.coaches_athlete(user_id));

create policy "weekly_checkins_select_coach" on public.weekly_checkins
  for select to authenticated using (public.coaches_athlete(user_id));
create policy "weekly_checkins_insert_coach" on public.weekly_checkins
  for insert to authenticated with check (public.coaches_athlete(user_id));
create policy "weekly_checkins_update_coach" on public.weekly_checkins
  for update to authenticated using (public.coaches_athlete(user_id)) with check (public.coaches_athlete(user_id));
create policy "weekly_checkins_delete_coach" on public.weekly_checkins
  for delete to authenticated using (public.coaches_athlete(user_id));
