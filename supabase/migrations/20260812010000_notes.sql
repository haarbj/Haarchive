-- Reading notes: personal, private annotations a signed-in user attaches to
-- any readable page -- a Foundations section (sections.ts) or a database
-- article (public.articles). Deliberately keyed by `content_slug` (the same
-- slug the whole site already routes on via /[slug]) rather than a foreign
-- key to public.articles: Foundations content has no database row at all,
-- and both content types already render through the exact same
-- ContentBlock[]/ArticleLayout pipeline, so scoping notes to only
-- database-backed articles would arbitrarily exclude most of the site's
-- actual reading material.
--
-- Unlike articles/article_comments (service-role-mediated, because their
-- access rules are genuinely multi-role -- author, reviewer, or admin, and
-- this project has already hit real RLS recursion trying to express that,
-- see articles.sql's own comment), a note has exactly one possible owner.
-- That's the same shape as saved_calculations/race_results/injuries, so
-- this copies their real select_own/insert_own/update_own/delete_own RLS
-- pattern verbatim rather than going through service-role mediation.
--
-- `anchor` is null for a general (unanchored) note. For a highlighted note
-- it holds a text-quote anchor, not a character offset or array-position
-- alone -- { prefix, suffix, blockIndex } (see src/lib/notes/anchor.ts).
-- blockIndex is only a fast-path hint checked first; prefix/suffix/
-- selected_text are what actually let a later read re-find the passage (or
-- correctly determine it's gone) if the article's content array changes.
-- Resolution is computed live against the article's current content on
-- every read, not cached here -- a stored "is this still valid" boolean
-- would go stale the moment content changes independently of the note, with
-- no trigger able to keep it honest.
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  content_slug text not null,
  body text not null default '',
  selected_text text,
  anchor jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every notes-panel open queries "this user's notes for this one slug" --
-- the single access pattern this table exists to serve.
create index idx_notes_user_content on public.notes (user_id, content_slug);

create trigger on_notes_updated
  before update on public.notes
  for each row execute function public.set_updated_at();

alter table public.notes enable row level security;

create policy "notes_select_own" on public.notes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "notes_insert_own" on public.notes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "notes_update_own" on public.notes
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "notes_delete_own" on public.notes
  for delete to authenticated using ((select auth.uid()) = user_id);
