-- Phase 5 (Personal Knowledge Hub): "Saved Topics" -- a private, one-click
-- bookmark on a topic, deliberately distinct from a Note (a bookmark means
-- "I want to come back to this," not an annotation on a specific passage).
--
-- Deliberately minimal: topic_slug only, no duplicated topic metadata
-- (title/category/mastery all come from taxonomy.ts/sections.ts and
-- user_topic_mastery at read time, the same "don't cache what you can
-- derive" convention learning_events already follows for content_slug).
-- Same owner-only RLS shape as notes.sql -- no update policy, since a
-- bookmark has nothing to edit, only create/remove (a toggle, not a form).
create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  topic_slug text not null,
  created_at timestamptz not null default now(),
  -- One bookmark per (user, topic) -- the DB-level guarantee "no duplicate
  -- rows" needs, not just an app-level check-then-insert that a race could
  -- still slip past.
  unique (user_id, topic_slug)
);

create index idx_bookmarks_user_id on public.bookmarks (user_id);

alter table public.bookmarks enable row level security;

create policy "bookmarks_select_own" on public.bookmarks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "bookmarks_insert_own" on public.bookmarks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "bookmarks_delete_own" on public.bookmarks
  for delete to authenticated using ((select auth.uid()) = user_id);
