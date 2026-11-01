-- Closes a real exposure found while verifying 20261101020000 on
-- production: training_program_names (a plain `select id, name from
-- training_programs where ...` view, no GROUP BY/DISTINCT/aggregates) is
-- structurally auto-updatable by Postgres's own rules -- confirmed via
-- information_schema.views (is_updatable = YES, is_insertable_into =
-- YES), unlike the codebase's one other precedent, public_personal_
-- records (20260721010000), whose GROUP BY makes it non-auto-updatable
-- (confirmed NO/NO the same way).
--
-- Combined with security_invoker = false (intentional -- see
-- 20261101020000's own header for why) and this project's default
-- per-object grants (anon and authenticated both nominally hold INSERT/
-- UPDATE/DELETE/TRUNCATE on every new relation in public, confirmed via
-- information_schema.role_table_grants, not something either migration
-- here ever asked for), an authenticated session -- or even anon --
-- could issue a real UPDATE/INSERT/DELETE through this view and have
-- Postgres translate it into a write against the underlying
-- training_programs row, running as the view owner (bypassing
-- training_programs' RLS entirely, the same way the view's own read
-- does on purpose). That's a real write path to a coach's program data
-- for a role that was only ever meant to read a name -- "let an athlete
-- read the Program name... nothing more" quite literally requires this.
--
-- Revoke down to exactly what was always intended: authenticated gets
-- SELECT only; anon gets nothing at all (this is an authenticated-only
-- coaching feature, never meant to be public).
revoke all on public.training_program_names from anon;
revoke all on public.training_program_names from authenticated;
grant select on public.training_program_names to authenticated;
