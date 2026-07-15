-- Articles: the database-driven counterpart to Foundations (sections.ts).
-- Foundations stays code-controlled by design (see the contributor-platform
-- planning discussion) -- this table exists so contributors who can't push
-- code can still publish. Draft -> in_review -> approved -> published,
-- mirroring the questions table's "editorial pipeline, not a discussion
-- board" precedent: only the final `published` state is publicly
-- readable via RLS, every other read/write for this table (and its three
-- satellite tables below) is service-role-mediated via server actions
-- gated on session.isAdmin / content permissions / article_contributors
-- membership -- building correct multi-role RLS policies for "primary
-- author, or a listed reviewer, or admin" is significantly more complex
-- than this schema needs, and this project has already hit real recursion
-- bugs (see team_memberships) trying to do that kind of thing in RLS.
--
-- `content` reuses the exact ContentBlock[] shape Foundations sections
-- already use (src/lib/sections.ts) so ArticleLayout renders both without
-- a fork. `article_type` and `evidence_category` are plain text, not
-- Postgres enums, deliberately: both are meant to grow a wider list over
-- time (see src/lib/articles/constants.ts) without a migration each time.

create type public.article_status as enum ('draft', 'in_review', 'approved', 'published');
create type public.article_contributor_role as enum ('author', 'reviewer', 'contributor');

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  subtitle text,
  article_type text not null default 'article',
  evidence_category text,
  tags text[] not null default '{}',
  cover_image_url text,
  content jsonb not null default '[]',
  status public.article_status not null default 'draft',
  primary_author_id uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger on_articles_updated
  before update on public.articles
  for each row execute function public.set_updated_at();

create index idx_articles_status on public.articles (status);
create index idx_articles_primary_author_id on public.articles (primary_author_id);

-- One row per person per article -- a contributor holds exactly one role
-- on a given article (author/reviewer/contributor), not several at once.
-- title_override lets a byline show a role specific to that piece (e.g.
-- "Elite Distance Runner" here, something else on a different article)
-- without changing the person's default contributor_profiles.title.
create table public.article_contributors (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  contributor_role public.article_contributor_role not null,
  title_override text,
  created_at timestamptz not null default now(),
  unique (article_id, user_id)
);

create index idx_article_contributors_article_id on public.article_contributors (article_id);
create index idx_article_contributors_user_id on public.article_contributors (user_id);

-- article_id is nullable on purpose: Phase 3 only attaches citations to a
-- specific draft, but a later phase adds standalone citation submissions
-- not tied to any article yet -- this avoids an ALTER TABLE dropping a
-- NOT NULL constraint against a table that already has real rows.
create table public.article_citations (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references public.articles (id) on delete cascade,
  paper_title text not null,
  authors text,
  year int,
  link_or_doi text,
  notes text,
  submitted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_article_citations_article_id on public.article_citations (article_id);

-- block_index anchors a comment to a specific content block (its position
-- in the article's content array); null means a general, whole-article
-- comment.
create table public.article_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  block_index int,
  comment text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_article_comments_article_id on public.article_comments (article_id);

alter table public.articles enable row level security;
alter table public.article_contributors enable row level security;
alter table public.article_citations enable row level security;
alter table public.article_comments enable row level security;

create policy "articles_select_published" on public.articles
  for select to public using (status = 'published');

-- Bylines on a published article need to show who wrote/reviewed it, so
-- article_contributors rows for a published article are public too --
-- scoped by a subquery against articles.status, not self-referential, so
-- this doesn't hit the same recursion class as the team_memberships bug.
create policy "article_contributors_select_published" on public.article_contributors
  for select to public using (
    exists (
      select 1 from public.articles
      where articles.id = article_contributors.article_id and articles.status = 'published'
    )
  );

-- Retroactive fix alongside the above: contributor_profiles has been
-- publicly readable since it was introduced, but profiles itself never
-- gained a public-read policy, so /contributors/[id] has been unable to
-- read any OTHER user's display_name/avatar_url since that page shipped
-- (profiles_select_own only covers your own row). Scoped narrowly to
-- exactly the users who opted into a public presence by creating a
-- contributor_profiles row -- not a blanket "profiles are public" policy.
create policy "profiles_select_contributor_public" on public.profiles
  for select to public using (
    exists (select 1 from public.contributor_profiles where contributor_profiles.user_id = profiles.id)
  );
