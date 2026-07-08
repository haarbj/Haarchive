-- Every table is scoped to auth.uid(). Two deliberate conventions applied
-- throughout, per Supabase's own RLS performance guidance:
--   1. auth.uid() is wrapped in `select` so Postgres's planner caches it
--      once per statement instead of re-evaluating it per row.
--   2. Every policy is scoped `to authenticated` explicitly, rather than
--      relying on auth.uid() returning null to implicitly reject the
--      anon role.

alter table public.profiles enable row level security;
alter table public.athlete_profiles enable row level security;
alter table public.goals enable row level security;
alter table public.race_results enable row level security;
alter table public.injuries enable row level security;
alter table public.training_plans enable row level security;
alter table public.mesocycles enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_completions enable row level security;
alter table public.weekly_checkins enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.saved_calculations enable row level security;
alter table public.connected_accounts enable row level security;
alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;

-- profiles: keyed by id (= auth.users.id), not user_id. Rows are created by
-- the handle_new_user trigger (security definer, bypasses RLS) and removed
-- only via account deletion, which runs as the service role -- so there's
-- no insert/delete policy here for the authenticated role.
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- athlete_profiles: user_id is its own primary key
create policy "athlete_profiles_select_own" on public.athlete_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "athlete_profiles_insert_own" on public.athlete_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "athlete_profiles_update_own" on public.athlete_profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "athlete_profiles_delete_own" on public.athlete_profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

-- goals: full CRUD by owner
create policy "goals_select_own" on public.goals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "goals_insert_own" on public.goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "goals_update_own" on public.goals
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "goals_delete_own" on public.goals
  for delete to authenticated using ((select auth.uid()) = user_id);

-- race_results: full CRUD by owner
create policy "race_results_select_own" on public.race_results
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "race_results_insert_own" on public.race_results
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "race_results_update_own" on public.race_results
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "race_results_delete_own" on public.race_results
  for delete to authenticated using ((select auth.uid()) = user_id);

-- injuries: full CRUD by owner
create policy "injuries_select_own" on public.injuries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "injuries_insert_own" on public.injuries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "injuries_update_own" on public.injuries
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "injuries_delete_own" on public.injuries
  for delete to authenticated using ((select auth.uid()) = user_id);

-- training_plans: full CRUD by owner
create policy "training_plans_select_own" on public.training_plans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "training_plans_insert_own" on public.training_plans
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "training_plans_update_own" on public.training_plans
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "training_plans_delete_own" on public.training_plans
  for delete to authenticated using ((select auth.uid()) = user_id);

-- mesocycles: full CRUD by owner (user_id denormalized, see schema migration)
create policy "mesocycles_select_own" on public.mesocycles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "mesocycles_insert_own" on public.mesocycles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "mesocycles_update_own" on public.mesocycles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "mesocycles_delete_own" on public.mesocycles
  for delete to authenticated using ((select auth.uid()) = user_id);

-- workouts: full CRUD by owner (user_id denormalized, see schema migration)
create policy "workouts_select_own" on public.workouts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "workouts_insert_own" on public.workouts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "workouts_update_own" on public.workouts
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "workouts_delete_own" on public.workouts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- workout_completions: full CRUD by owner
create policy "workout_completions_select_own" on public.workout_completions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "workout_completions_insert_own" on public.workout_completions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "workout_completions_update_own" on public.workout_completions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "workout_completions_delete_own" on public.workout_completions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- weekly_checkins: full CRUD by owner
create policy "weekly_checkins_select_own" on public.weekly_checkins
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "weekly_checkins_insert_own" on public.weekly_checkins
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "weekly_checkins_update_own" on public.weekly_checkins
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "weekly_checkins_delete_own" on public.weekly_checkins
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ai_conversations: full CRUD by owner (deleting cascades to ai_messages)
create policy "ai_conversations_select_own" on public.ai_conversations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai_conversations_insert_own" on public.ai_conversations
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ai_conversations_update_own" on public.ai_conversations
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ai_conversations_delete_own" on public.ai_conversations
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ai_messages: append-only chat log (user_id denormalized) -- select and
-- insert only, no update/delete of individual messages
create policy "ai_messages_select_own" on public.ai_messages
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai_messages_insert_own" on public.ai_messages
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- notifications: system-generated (inserted via service role, which
-- bypasses RLS) -- the owner can only read and mark as read
create policy "notifications_select_own" on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "notifications_update_own" on public.notifications
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- saved_calculations: full CRUD by owner
create policy "saved_calculations_select_own" on public.saved_calculations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "saved_calculations_insert_own" on public.saved_calculations
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "saved_calculations_update_own" on public.saved_calculations
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "saved_calculations_delete_own" on public.saved_calculations
  for delete to authenticated using ((select auth.uid()) = user_id);

-- connected_accounts: full CRUD by owner
create policy "connected_accounts_select_own" on public.connected_accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "connected_accounts_insert_own" on public.connected_accounts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "connected_accounts_update_own" on public.connected_accounts
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "connected_accounts_delete_own" on public.connected_accounts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- teams: no policies yet -- RLS-enabled-with-zero-policies denies all
-- non-service-role access by default, which is correct until real team
-- features (§23) give someone a reason to create or read one.

-- team_memberships: a user can see their own membership rows once teams
-- exist; creation/management is a future, service-role-driven flow.
create policy "team_memberships_select_own" on public.team_memberships
  for select to authenticated using ((select auth.uid()) = user_id);
