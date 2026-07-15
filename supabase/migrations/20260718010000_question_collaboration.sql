-- Question collaboration: lets an admin assign a reader question to a
-- contributor to draft an answer, and to a reviewer to give feedback on
-- that draft, before the admin promotes it into the real, public-facing
-- admin_response (unchanged from the existing triage workflow -- see
-- question-triage-panel.tsx's EditForm, which this migration doesn't touch
-- at all). assigned_to/assigned_reviewer are single nullable columns
-- rather than a join table (unlike article_contributors): a question has
-- at most one person answering and one person reviewing, not several
-- authors/reviewers/contributors, so the extra table would be unused
-- complexity here.
--
-- draft_answer is deliberately separate from admin_response: it's the
-- contributor's workspace, never shown to readers until an admin
-- explicitly copies it over (see the "Use as public response" action).
--
-- question_comments mirrors article_comments' shape minus block_index --
-- a question has one draft_answer, not a content-block array, so there's
-- nothing to anchor a comment to beyond the question itself.

alter table public.questions
  add column assigned_to uuid references public.profiles (id) on delete set null,
  add column assigned_reviewer uuid references public.profiles (id) on delete set null,
  add column draft_answer text;

create index idx_questions_assigned_to on public.questions (assigned_to);
create index idx_questions_assigned_reviewer on public.questions (assigned_reviewer);

create table public.question_comments (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  comment text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_question_comments_question_id on public.question_comments (question_id);

-- No public exposure needed -- this is an internal editorial workflow, same
-- as questions' own admin_notes/admin_response fields. Service-role-mediated
-- only, matching article_comments.
alter table public.question_comments enable row level security;
