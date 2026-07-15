-- Contributor applications: a public "apply to help build the library" form
-- at /contribute-apply, reviewed by an admin who approves or rejects.
-- Approving grants the content_contributor permission (see the
-- content_permissions migration) -- it does not auto-create a
-- contributor_profiles row, since that's a richer profile the contributor
-- fills in themselves once they have access (see /contribute/profile).
--
-- Same hybrid identity as questions/contact_messages (see those migrations'
-- own comments) -- an applicant doesn't need an account yet to apply, but
-- approval can only grant a permission once they do have one (a profiles
-- row), so email is the durable link between "applied" and "signed up" --
-- see reviewContributorApplication in admin/contributor-applications/
-- actions.ts, which resolves email -> user_id at approval time if the
-- applicant wasn't signed in when they applied.
--
-- Not publicly readable -- private review workflow, service-role-mediated
-- only, matching content_suggestions/contact_messages.

create type public.contributor_application_status as enum ('pending', 'approved', 'rejected');

create table public.contributor_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  contribution_types text[] not null default '{}',
  background text not null,
  topic_idea text,
  motivation text not null,
  status public.contributor_application_status not null default 'pending',
  user_id uuid references public.profiles (id) on delete set null,
  anon_id uuid,
  admin_notes text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint contributor_applications_identity_xor check (
    (user_id is not null and anon_id is null) or (user_id is null and anon_id is not null)
  )
);

create index idx_contributor_applications_status on public.contributor_applications (status);
create index idx_contributor_applications_created_at on public.contributor_applications (created_at desc);
create index idx_contributor_applications_email on public.contributor_applications (email);
create index idx_contributor_applications_user_id on public.contributor_applications (user_id);
create index idx_contributor_applications_anon_id on public.contributor_applications (anon_id);

alter table public.contributor_applications enable row level security;
