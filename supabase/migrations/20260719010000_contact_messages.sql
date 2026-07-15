-- Contact form submissions from /contact. Reachable by any visitor, signed
-- in or not, same hybrid identity as questions (see that migration's own
-- comment) -- used only for rate-limiting here, since the submitted email
-- address is the real reply-to. Not publicly readable -- these are private
-- messages to Brody, not reader-facing content -- so RLS is enabled with
-- zero policies, service-role-mediated only, matching content_suggestions/
-- article_citations.

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  user_id uuid references public.profiles (id) on delete set null,
  anon_id uuid,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint contact_messages_identity_xor check (
    (user_id is not null and anon_id is null) or (user_id is null and anon_id is not null)
  )
);

create index idx_contact_messages_created_at on public.contact_messages (created_at desc);
create index idx_contact_messages_user_id on public.contact_messages (user_id);
create index idx_contact_messages_anon_id on public.contact_messages (anon_id);

alter table public.contact_messages enable row level security;
