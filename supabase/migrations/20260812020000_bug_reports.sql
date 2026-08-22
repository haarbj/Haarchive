-- "Report a Bug" -- a visitor-submitted diagnostic report, anonymous or
-- authenticated, reviewed only by an admin. Same hybrid-identity shape as
-- contact_messages/questions (user_id XOR anon_id, RLS enabled with zero
-- policies, service-role-mediated only -- see contact_messages.sql's own
-- comment for why this project doesn't invent per-feature anon-role
-- policies). Closer to contact_messages than questions specifically:
-- nothing here is ever publicly readable, and there's no in-app reply
-- workflow to build around -- an admin reads it, optionally changes
-- `status`, and (unlike contact_messages) that status is the whole review
-- workflow, so `updated_at` is real here.
--
-- Deliberately does NOT store: an email column (unlike contact_messages,
-- a bug report has no reply-to concept -- if the reporter is signed in,
-- user_id is already enough to look them up; if anonymous, there's nothing
-- to store), a `referrer` column (page_url plus the description already
-- cover the practical debugging need; a referrer chain adds a column with
-- real privacy surface for marginal diagnostic value), or a `browser`/`os`
-- breakdown (user_agent is the one raw string; deriving structured fields
-- from it is a v2 problem, not a schema one).
create type public.bug_report_status as enum ('new', 'investigating', 'resolved', 'dismissed');

create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  anon_id uuid,
  description text not null,
  page_url text not null,
  viewport_width integer,
  viewport_height integer,
  device_pixel_ratio real,
  user_agent text,
  -- Object path inside the private bug-report-screenshots bucket (see
  -- below), never a public URL -- an admin view resolves this to a
  -- short-lived signed URL on read. Null when capture failed or the
  -- reporter had none to attach; a bug report is never blocked on having
  -- a screenshot.
  screenshot_path text,
  status public.bug_report_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bug_reports_identity_xor check (
    (user_id is not null and anon_id is null) or (user_id is null and anon_id is not null)
  )
);

create trigger on_bug_reports_updated
  before update on public.bug_reports
  for each row execute function public.set_updated_at();

-- The admin inbox always reads newest-first; a rate-limit check always
-- filters by whichever identity column is populated, scoped to a recent
-- window -- the two real access patterns this table serves.
create index idx_bug_reports_created_at on public.bug_reports (created_at desc);
create index idx_bug_reports_status on public.bug_reports (status);
create index idx_bug_reports_user_id on public.bug_reports (user_id);
create index idx_bug_reports_anon_id on public.bug_reports (anon_id);

alter table public.bug_reports enable row level security;
-- No policies -- not publicly readable or writable by any role, exactly
-- like contact_messages/content_suggestions. Every access goes through
-- createServiceRoleClient() in a server action (submission) or an
-- isAdmin-gated admin page (review).

-- Private bucket -- the first one in this schema (article-images/avatars
-- are both public, since that content renders on public pages). A
-- screenshot can contain private Notes, account details, or anything else
-- visible in a signed-in visitor's viewport at the moment they reported a
-- bug, so `public: false` here is a deliberate, load-bearing choice, not
-- an oversight. Zero storage.objects policies, same reasoning as the table
-- above: the upload (submit action) and every read (admin page) are both
-- already service-role-mediated, so a policy-less private bucket simply
-- can't be written to *or read from* by anything other than that
-- server-side code -- there is no direct-from-browser path to this bucket
-- at all, unlike the public buckets where a public SELECT is the explicit
-- intent.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bug-report-screenshots', 'bug-report-screenshots', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;
