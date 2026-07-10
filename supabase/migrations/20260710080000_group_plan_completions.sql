-- Lets an athlete mark their own personal completion against a shared
-- group_plan_workouts entry, without the entry itself needing to be
-- duplicated per athlete. Mirrors the existing workout_id column exactly,
-- just pointed at the other table -- exactly one of the two is ever set.

alter table public.workout_completions
  add column group_plan_workout_id uuid references public.group_plan_workouts (id) on delete cascade,
  alter column workout_id drop not null,
  add constraint workout_completions_exactly_one_target check (
    (workout_id is not null) <> (group_plan_workout_id is not null)
  );

create index idx_workout_completions_group_plan_workout_id on public.workout_completions (group_plan_workout_id);

-- Athlete: full CRUD on their own completions for a workout in a group
-- they belong to (reuses is_member_of_group() -- no publish check needed
-- here since an athlete acting on a workout id they don't have visibility
-- into is a no-op, not a leak).
create policy "workout_completions_all_own_group" on public.workout_completions
  for all to authenticated using (
    user_id = (select auth.uid())
    and group_plan_workout_id in (
      select gpw.id from public.group_plan_workouts gpw
      join public.group_plans gp on gp.id = gpw.group_plan_id
      where public.is_member_of_group(gp.group_id)
    )
  )
  with check (
    user_id = (select auth.uid())
    and group_plan_workout_id in (
      select gpw.id from public.group_plan_workouts gpw
      join public.group_plans gp on gp.id = gpw.group_plan_id
      where public.is_member_of_group(gp.group_id)
    )
  );

-- Coach: read-only visibility into their team's group-workout completions.
create policy "workout_completions_select_coach_group" on public.workout_completions
  for select to authenticated using (
    group_plan_workout_id in (
      select gpw.id from public.group_plan_workouts gpw
      where gpw.team_id = public.my_coach_team_id()
    )
  );
