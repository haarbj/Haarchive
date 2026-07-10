-- Publishing moves from group_plans (one flag for the whole plan) to
-- group_plan_workouts (one flag per entry) -- a coach publishes a week by
-- bulk-setting published_at on every entry scheduled within it, instead of
-- being forced to publish months of not-yet-finalized weeks just to reveal
-- this week.

alter table public.group_plan_workouts add column published_at timestamptz;

-- Both existing member-select policies reference group_plans.published_at,
-- so they have to go before that column can be dropped.
drop policy if exists "group_plans_select_member" on public.group_plans;
drop policy if exists "group_plan_workouts_select_member" on public.group_plan_workouts;

alter table public.group_plans drop column published_at;

-- Members can always see the group_plans row itself (the "waiting for your
-- coach" empty state needs this); the real gate now lives entirely on the
-- workout rows.
create policy "group_plans_select_member" on public.group_plans
  for select to authenticated using (public.is_member_of_group(group_id));

create policy "group_plan_workouts_select_member" on public.group_plan_workouts
  for select to authenticated using (
    published_at is not null
    and group_plan_id in (
      select id from public.group_plans where public.is_member_of_group(group_id)
    )
  );
