-- Content collaboration permissions: a user can hold any combination of
-- content_contributor / reviewer, independent of both admin status (still a
-- pure ADMIN_EMAILS env allowlist -- not stored here, not grantable through
-- this table) and training-dashboard access (still team_memberships.role,
-- untouched by this migration). One junction table per user per permission,
-- not a single role column, since the whole point is that these stack.
--
-- All writes are service-role-mediated via an admin-gated server action
-- (only admins manage permissions), same as coach_invites/questions. Reads
-- follow the team_memberships_select_own precedent instead: a user can see
-- their own permission rows (getAppSession() needs this on every request to
-- compute session.permissions), which is harmless since it's read-only.

create type public.content_permission as enum ('content_contributor', 'reviewer');

create table public.user_permissions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  permission public.content_permission not null,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, permission)
);

create index idx_user_permissions_user_id on public.user_permissions (user_id);

alter table public.user_permissions enable row level security;

create policy "user_permissions_select_own" on public.user_permissions
  for select to authenticated using ((select auth.uid()) = user_id);
