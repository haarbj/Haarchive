-- Minimal, faithful shim of the parts of the Supabase platform that this
-- project's own migrations/RLS policies actually depend on, WITHOUT the
-- full GoTrue/PostgREST/Storage-API/Realtime stack (which requires Docker,
-- unavailable in this environment -- see the RLS harness README). RLS
-- itself is pure Postgres: auth.uid() is just a SQL function reading a
-- session variable, and PostgREST's only real contribution to RLS
-- enforcement is (a) picking which Postgres role to run a request's
-- queries as, and (b) setting that session variable from a verified JWT
-- before running them. Both are reproduced directly here via SET LOCAL in
-- the test harness itself (see db-client.ts) -- this file only lays down
-- the schema/roles those SET LOCAL calls target.
--
-- Run once per fresh test database, BEFORE any project migration.

-- Real Supabase role names -- every "to authenticated"/"to anon" clause in
-- this project's migrations depends on these existing with these exact
-- names.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
-- Real Supabase's service_role has BYPASSRLS -- reproduced directly via
-- the role attribute, not a policy, since that's the actual mechanism.
create role service_role nologin noinherit bypassrls;

-- The migration-running role (this session's own login role, "postgres")
-- needs to be able to SET ROLE into each of these to run queries as them.
grant anon, authenticated, service_role to current_user;

create extension if not exists pgcrypto;

-- auth schema -- minimal. Only auth.users (an FK target for
-- public.profiles.id) and the auth.uid()/auth.role() functions this
-- project's policies actually call. auth.uid()'s implementation matches
-- Supabase's real one exactly (both the direct-claim and JSON-claims
-- fallback forms PostgREST supports), not a simplified stand-in.
create schema if not exists auth;

-- raw_user_meta_data is required here, not just for fidelity: this
-- project's own on_auth_user_created trigger (init_schema.sql, updated by
-- update_handle_new_user_oauth.sql) reads new.raw_user_meta_data when it
-- fires on every auth.users insert -- without this column the trigger
-- itself errors (`record "new" has no field "raw_user_meta_data"`) the
-- moment a fixture user is created, which is a real failure of this
-- project's real trigger code against a too-minimal shim, not a harness
-- bug to work around some other way.
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create or replace function auth.uid() returns uuid
  language sql stable
  as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;

create or replace function auth.role() returns text
  language sql stable
  as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
    )::text
  $$;

-- storage schema -- minimal. storage.buckets exists because
-- avatars_storage.sql / article_images_storage.sql / message_images
-- storage each do one `insert into storage.buckets`. storage.objects (plus
-- storage.foldername(), the one storage.* SQL function this project's own
-- policies call) exists specifically because
-- 20260826030000_private_coaching_message_images.sql adds this project's
-- first-ever storage.objects RLS policy -- prior migrations' own comments
-- said storage.objects was never touched, which was true until that one.
-- Columns/function bodies mirror Supabase's real storage-api schema
-- closely enough for RLS purposes, not the full thing (no owner/metadata/
-- versioning columns -- nothing here reads them).
create schema if not exists storage;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  created_at timestamptz not null default now()
);
-- Real Supabase force-enables RLS on storage.objects at the platform
-- level, before any project migration ever runs -- a real migration
-- author never needs to (and 20260826030000 correctly doesn't). This
-- harness has to do it explicitly since it's creating the table itself,
-- starting from Postgres' own default of RLS off.
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
  language sql immutable
  as $$
    select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
  $$;

-- Real Supabase projects grant broad table-level privileges to anon/
-- authenticated/service_role automatically, at the PLATFORM level, outside
-- of and prior to any user migration -- RLS is what actually narrows
-- access from there, not the grant itself (see supabase/config.toml's own
-- comment on auto_expose_new_tables). ALTER DEFAULT PRIVILEGES (rather
-- than a one-time GRANT ALL run after every migration) reproduces this
-- faithfully: it applies automatically to each table as the migration
-- role creates it, and -- critically -- does NOT retroactively re-grant
-- anything a later migration explicitly REVOKEs (e.g.
-- 20260825030000_private_coaching_messaging.sql's own column-level
-- REVOKE/GRANT on coach_athlete_messages). A blanket end-of-script GRANT
-- ALL would have silently undone that fix and invalidated exactly the
-- test this harness exists to run.
alter default privileges for role current_user in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges for role current_user in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges for role current_user in schema auth
  grant select on tables to anon, authenticated, service_role;

grant usage on schema public, auth, storage to anon, authenticated, service_role;

-- storage.objects was created above, before the ALTER DEFAULT PRIVILEGES
-- block -- same as auth.users, default privileges only apply to tables
-- created AFTER the statement runs, so this table needs its own explicit
-- grant rather than inheriting one. anon and authenticated both get
-- SELECT (matching the broad-grant-then-RLS-narrows philosophy every
-- other table here follows -- see the ALTER DEFAULT PRIVILEGES comment
-- above) so message_images_select_participant's RLS is the thing actually
-- doing the denying for an anon caller (no auth.uid() to match), not a
-- bare permission error that would deny for an unrelated reason.
-- service_role needs full access so this harness's own fixture setup/
-- teardown (which has no Storage API to call through, unlike the real
-- app's uploadMessageImage) can insert/delete test rows directly.
grant select on storage.objects to anon, authenticated;
grant select, insert, update, delete on storage.objects to service_role;

-- service_role's BYPASSRLS attribute only bypasses ROW-level security --
-- it doesn't imply table-level GRANTs, which Postgres checks first. Real
-- Supabase never writes to auth.users via service_role either (that's
-- GoTrue's own, separate, more-privileged role) -- this grant exists
-- purely so this harness's own fixture setup/teardown (tests/rls/
-- fixtures.ts, which has no GoTrue to stand in for) can create/remove its
-- fake test identities. No project migration or RLS policy relies on this.
-- SELECT is included because `insert ... on conflict (id) do nothing`
-- (used throughout fixtures.ts to make setup safely re-runnable) requires
-- SELECT to evaluate the conflict check, not just INSERT -- this table
-- predates the ALTER DEFAULT PRIVILEGES block above, so that block's
-- schema-auth SELECT grant (which only applies to tables created AFTER
-- it) never reached this one.
grant select, insert, update, delete on auth.users to service_role;
