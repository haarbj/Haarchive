-- Foundational content suggestions and standalone research citations --
-- the two remaining collaboration surfaces from the original spec.
-- Foundations pages stay code-controlled (sections.ts) by design: a
-- suggestion here is never applied automatically, only reviewed and
-- manually integrated by an admin, same as the plan's own wording.
--
-- article_citations already exists (see the articles migration) and was
-- deliberately given a nullable article_id so this exact extension -- a
-- citation not attached to any specific draft -- doesn't require loosening
-- a NOT NULL constraint against a table that may already have real rows.
-- The new columns (topic, claim_supported, status, admin_notes) apply to
-- both per-article and standalone citations, since it's one review
-- workflow either way.
--
-- Neither table is publicly readable -- these are internal editorial
-- workflows, not reader-facing content -- so RLS is enabled with zero
-- policies, service-role-mediated only, matching articles/questions/
-- coach_invites.

create type public.suggestion_status as enum ('open', 'accepted', 'rejected');
create type public.citation_status as enum ('submitted', 'accepted', 'rejected');

create table public.content_suggestions (
  id uuid primary key default gen_random_uuid(),
  section_slug text not null,
  suggestion text not null,
  reason text,
  submitted_by uuid references public.profiles (id) on delete set null,
  status public.suggestion_status not null default 'open',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger on_content_suggestions_updated
  before update on public.content_suggestions
  for each row execute function public.set_updated_at();

create index idx_content_suggestions_status on public.content_suggestions (status);
create index idx_content_suggestions_submitted_by on public.content_suggestions (submitted_by);

alter table public.content_suggestions enable row level security;

alter table public.article_citations
  add column topic text,
  add column claim_supported text,
  add column status public.citation_status not null default 'submitted',
  add column admin_notes text;

create index idx_article_citations_status on public.article_citations (status);
create index idx_article_citations_submitted_by on public.article_citations (submitted_by);
