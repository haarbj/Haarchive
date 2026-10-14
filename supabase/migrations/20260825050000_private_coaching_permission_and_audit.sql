-- Private 1-on-1 coaching, Phase 1: who can be a coach, and audit logging.
--
-- "Coach" access is gated the same way content_contributor/reviewer
-- already are (see content_permissions.sql): an admin-granted capability
-- in user_permissions, not a marketplace signup or a role anyone can
-- self-assign. This deliberately avoids the excluded "coach marketplace /
-- public coach discovery" MVP scope -- for now, Brody (or another admin)
-- decides who's allowed to coach, via the existing /admin/users screen.
-- Extending the existing content_permission enum (rather than a second,
-- parallel permission table) reuses 100% of the existing grant
-- mechanism/RLS/session-loading code (see src/lib/auth/permissions.ts,
-- src/lib/auth/session.ts) for a two-line migration, even though
-- "private_coach" isn't strictly a *content* permission -- the alternative
-- (a whole new admin-grant table+UI, structurally identical to this one)
-- would be exactly the kind of duplicate infrastructure the product brief
-- warns against.
--
-- ALTER TYPE ... ADD VALUE is isolated in its own migration file/
-- transaction on purpose -- Postgres does not allow a newly-added enum
-- value to be referenced by other DDL/DML in the same transaction it was
-- added in.
alter type public.content_permission add value if not exists 'private_coach';

-- Minimal, generic audit log for the mutations the product brief calls
-- out (athlete invited/accepted, relationship changed, workout created/
-- edited/deleted/assigned, message sent, check-in submitted, pain
-- reported, integration connected/disconnected). No existing audit-log
-- convention exists anywhere in this schema (confirmed in the Phase 0
-- audit) -- this is new, but intentionally small: one flat table, no
-- per-entity-type child tables, populated by Server Actions in later
-- phases (not by triggers, so the calling action controls exactly what
-- "metadata" is worth recording per mutation).
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_log_entity on public.audit_log (entity_type, entity_id);
create index idx_audit_log_actor on public.audit_log (actor_id, created_at);

alter table public.audit_log enable row level security;
-- Zero policies for authenticated/anon -- write/read both service-role
-- only for now (matching coach_invites' deny-all convention). A coach-
-- facing "activity history" view, if ever built, would add a scoped
-- select policy in its own migration rather than opening this table
-- broadly today.
