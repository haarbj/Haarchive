# RLS Integration Test Harness

Real PostgreSQL, real RLS policies from the actual, unmodified migration files in `supabase/migrations/`, exercised via real authenticated/anon/service_role Postgres roles -- not a mocked Supabase client (see `tests/app/supabase-test-utils.ts` for that different, pre-existing pattern, used elsewhere for pure Server-Action-logic tests, not RLS).

## Why this exists, and why it isn't `supabase start`

This repo's own established local-dev pattern (`supabase/config.toml`) is `supabase start`, which requires Docker to run the local Postgres + GoTrue + PostgREST + Storage containers. Docker is unavailable in some environments this project is developed in. RLS itself is a pure Postgres feature -- `auth.uid()` is just a SQL function reading a session variable, and PostgREST's only real contribution to RLS enforcement is picking a Postgres role per request and setting that variable from a verified JWT before running the request's queries. Neither GoTrue, PostgREST itself, Storage, nor Realtime participate in RLS evaluation at all.

So this harness reproduces the minimum: a real, standalone Postgres 17 instance (matching `supabase/config.toml`'s `major_version = 17`), a minimal, faithful shim of `auth.users`/`auth.uid()`/`auth.role()` and the `anon`/`authenticated`/`service_role` roles (`bootstrap.sql`), and a raw `pg` client (`db-client.ts`) that does directly, per test, exactly what PostgREST would do per request: `SET LOCAL ROLE`, then `set_config('request.jwt.claim.sub', ...)`.

**What this does NOT test:** the full Supabase HTTP/Auth/PostgREST request pipeline, GoTrue token issuance, Storage, Realtime, or anything about how a real JWT gets minted. Those aren't part of RLS enforcement, so they're out of scope for what this harness is for -- but a test passing here is not the same claim as "the full Supabase stack behaves identically," and this README says so on purpose.

## Setup (one-time per machine)

```bash
brew install postgresql@17
```

## Running

```bash
npm run test:rls:up      # init + start a dedicated local cluster in .rls-test-db/ (gitignored), apply bootstrap.sql + every migration in supabase/migrations/ in order
npm run test:rls          # run the actual adversarial test suite (vitest, vitest.rls.config.ts)
npm run test:rls:down     # stop the cluster (data persists in .rls-test-db/ until you rm -rf it)
```

`test:rls:up` applies **every** migration in `supabase/migrations/`, in order, not a hand-picked subset -- this is what lets it double as a real answer to "do the 7 private-coaching migrations actually apply cleanly against a representative schema," not just "do they apply in isolation."

## Layout

- `bootstrap.sql` -- the Supabase-platform shim (roles, `auth.uid()`, minimal `storage.buckets` for the two migrations that need it).
- `db-client.ts` -- `asUser(uuid, fn)` / `asAnon(fn)` / `asServiceRole(fn)` / `withCommittedServiceRole(fn)`. Test-body queries run inside a transaction that's always rolled back; fixture setup/teardown commits explicitly.
- `fixtures.ts` -- deterministic, fixed-UUID test identities (Coach A/B, Athlete A/B/C, one active relationship each for A and B, one published workout/template/message/completion/comment per relationship). Never collides with real data.
- `*.test.ts` -- the adversarial matrix, one file per area (coach isolation, athlete isolation, messaging, relationship revocation, invite lifecycle, service-role boundary) plus `regression-vulnerabilities.test.ts`, a dedicated, audit-finding-by-audit-finding regression suite.

## What this harness deliberately does not do

It does not invoke the real private-coaching Server Actions directly (`saveScheduledWorkout`, `deleteWorkoutCompletion`, etc.) -- those import `getAppSession()`/`createServiceRoleClient()`, which read real environment credentials and would risk connecting to the actual production Supabase project. Where a test's whole point is an application-layer fix (not RLS itself), this harness instead exercises the exact SQL pattern that fix's logic depends on, directly, against real RLS -- and says so in the test's own comment. The application-layer checks themselves are verified by code inspection (see the two prior audit passes) and by `tsc`/`eslint`/`build` passing, not re-executed here.
