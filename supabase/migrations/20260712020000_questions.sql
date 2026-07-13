-- Questions feature: an editorial pipeline, not a discussion board. Readers
-- (signed in or not) submit questions/topic suggestions and upvote them;
-- Brody triages them into an existing article, a new one, an FAQ entry, or
-- a research topic.
--
-- This is the first feature that accepts writes from unauthenticated
-- visitors. Rather than inventing new `anon`-role RLS policies (every other
-- table in this schema is `to authenticated` only), all writes go through
-- server actions using the service-role client -- the same pattern already
-- used for coach_invites and notifications. Identity is "hybrid": a row
-- carries either a real user_id (signed in) or an anon_id (a cookie-issued
-- uuid for signed-out visitors), never both, enforced by a check constraint.
-- RLS here exists only to make reads public, not to arbitrate writes.

create type public.question_type as enum ('question', 'topic_suggestion');
create type public.question_status as enum (
  'new', 'under_review', 'planned', 'researching', 'answered', 'added_to_library'
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  type public.question_type not null default 'question',
  title text not null,
  description text,
  category text,
  tags text[] not null default '{}',
  status public.question_status not null default 'new',
  user_id uuid references public.profiles (id) on delete set null,
  anon_id uuid,
  display_name text,
  source_section_slug text,
  upvote_count int not null default 0,
  admin_notes text,
  admin_response text,
  is_faq boolean not null default false,
  merged_into_id uuid references public.questions (id) on delete set null,
  linked_section_slug text,
  ai_suggestion jsonb,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_identity_xor check (
    (user_id is not null and anon_id is null) or (user_id is null and anon_id is not null)
  )
);

-- Generated tsvector, not maintained by hand -- title carries more weight
-- than description in ranked search results.
alter table public.questions
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;

create index idx_questions_search_vector on public.questions using gin (search_vector);
create index idx_questions_status on public.questions (status);
create index idx_questions_category on public.questions (category);
create index idx_questions_visible on public.questions (visible);
create index idx_questions_upvote_count on public.questions (upvote_count desc);
create index idx_questions_created_at on public.questions (created_at desc);
create index idx_questions_user_id on public.questions (user_id);
create index idx_questions_anon_id on public.questions (anon_id);

create table public.question_upvotes (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  anon_id uuid,
  created_at timestamptz not null default now(),
  constraint question_upvotes_identity_xor check (
    (user_id is not null and anon_id is null) or (user_id is null and anon_id is not null)
  )
);

-- Partial unique indexes (not a plain unique constraint) because exactly one
-- of user_id/anon_id is ever set, and a plain unique(question_id, user_id)
-- would treat every anon row's null user_id as distinct -- Postgres already
-- does that correctly for unique constraints, but a partial index makes the
-- one-vote-per-identity intent explicit and cheaper to maintain.
create unique index idx_question_upvotes_user_unique
  on public.question_upvotes (question_id, user_id) where user_id is not null;
create unique index idx_question_upvotes_anon_unique
  on public.question_upvotes (question_id, anon_id) where anon_id is not null;
create index idx_question_upvotes_question_id on public.question_upvotes (question_id);

create function public.handle_question_upvote_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    update public.questions set upvote_count = upvote_count + 1 where id = new.question_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.questions set upvote_count = greatest(upvote_count - 1, 0) where id = old.question_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger on_question_upvote_change
  after insert or delete on public.question_upvotes
  for each row execute function public.handle_question_upvote_change();

create function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_questions_updated
  before update on public.questions
  for each row execute function public.set_updated_at();

-- RLS: public read of visible questions only (matches the rest of the
-- site's educational content, which needs no auth to read). No write
-- policies for anon/authenticated -- every write is service-role-mediated
-- via a server action, per the comment at the top of this file.
alter table public.questions enable row level security;
alter table public.question_upvotes enable row level security;

create policy "questions_select_visible" on public.questions
  for select to public using (visible = true);
