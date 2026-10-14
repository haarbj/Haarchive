-- Private 1-on-1 coaching, Phase 1: direct coach<->athlete messaging.
--
-- No comparable table exists anywhere in the schema (see Phase 0 audit --
-- ai_conversations/ai_messages is a solo user<->AI chat with no coach
-- visibility; article/question comment threads are broadcast-on-a-shared-
-- document, not a private 1:1 conversation). This is a real DM thread
-- scoped to one coach_athletes relationship.
--
-- Delivery is poll-based (matching notification-bell.tsx's existing
-- 45s-poll precedent), not Supabase Realtime -- this repo has zero
-- existing Realtime/websocket usage, and introducing it would be new
-- operational surface for no MVP-required gain given the product's
-- zero-incremental-cost constraint.
create table public.coach_athlete_messages (
  id uuid primary key default gen_random_uuid(),
  coach_athlete_id uuid not null references public.coach_athletes (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_coach_athlete_messages_thread on public.coach_athlete_messages (coach_athlete_id, created_at);

alter table public.coach_athlete_messages enable row level security;

-- Either party on the relationship can read the whole thread and post to
-- it; only the recipient (not the sender) marks a message read, and only
-- the author can delete their own message.
--
-- Every exists() below additionally requires ca.status = 'active' -- pre-
-- fix, these only checked that a coach_athletes ROW existed linking the
-- two parties, never that the relationship was still active. Since
-- removeAthleteFromRoster soft-ends a relationship (status='ended') rather
-- than deleting the row, message access -- including sending NEW messages
-- -- was never actually revoked after a coach removed an athlete (caught
-- in the pre-apply security audit; this table doesn't cascade the fix
-- scheduled_workouts_all_coach now gets from coaches_this_athlete(), since
-- it queries coach_athletes directly rather than through
-- scheduled_workouts, and coach_athletes' own select policies
-- deliberately don't filter by status, by design, so a user can still see
-- their own relationship history).
create policy "coach_athlete_messages_select_participant" on public.coach_athlete_messages
  for select to authenticated using (
    exists (
      select 1 from public.coach_athletes ca
      where ca.id = coach_athlete_id
        and ca.status = 'active'
        and ((select auth.uid()) = ca.coach_id or (select auth.uid()) = ca.athlete_id)
    )
  );
create policy "coach_athlete_messages_insert_participant" on public.coach_athlete_messages
  for insert to authenticated with check (
    (select auth.uid()) = sender_id
    and exists (
      select 1 from public.coach_athletes ca
      where ca.id = coach_athlete_id
        and ca.status = 'active'
        and ((select auth.uid()) = ca.coach_id or (select auth.uid()) = ca.athlete_id)
    )
  );
create policy "coach_athlete_messages_update_recipient" on public.coach_athlete_messages
  for update to authenticated using (
    (select auth.uid()) <> sender_id
    and exists (
      select 1 from public.coach_athletes ca
      where ca.id = coach_athlete_id
        and ca.status = 'active'
        and ((select auth.uid()) = ca.coach_id or (select auth.uid()) = ca.athlete_id)
    )
  ) with check (
    (select auth.uid()) <> sender_id
  );
create policy "coach_athlete_messages_delete_own" on public.coach_athlete_messages
  for delete to authenticated using ((select auth.uid()) = sender_id);

-- Column-level privilege, not just RLS -- a row-level policy's with-check
-- can only constrain which ROWS are updatable, never which COLUMNS, so
-- coach_athlete_messages_update_recipient above (by itself) would still
-- let the recipient rewrite body/sender_id/coach_athlete_id on a message
-- that isn't theirs -- including reassigning it into a completely
-- unrelated coach_athlete_id they're not even part of, since with-check
-- above never re-verifies the NEW coach_athlete_id (caught in the pre-
-- apply security audit as a cross-tenant content-injection vector). The
-- application only ever sets read_at (markThreadRead) -- restricting the
-- grant to that one column closes the gap regardless of row-level policy,
-- using the standard Postgres primitive for "this role may only touch
-- this one column," not a second, more complex RLS policy.
revoke update on public.coach_athlete_messages from authenticated;
grant update (read_at) on public.coach_athlete_messages to authenticated;
