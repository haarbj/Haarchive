// Direct Postgres connection for RLS integration tests -- deliberately NOT
// @supabase/supabase-js (which talks to PostgREST over HTTP, not the
// database), and deliberately NOT the mocked query-builder in
// tests/app/supabase-test-utils.ts. This connects to a real, local Postgres
// instance and runs real SQL against real RLS policies.
//
// PostgREST's actual contribution to RLS enforcement is narrow: per
// request, it (1) picks a Postgres role based on the JWT's "role" claim
// (falling back to anon), and (2) SETs the JWT claims as session-local
// GUCs before running the request's queries, inside the same transaction.
// asUser/asAnon/asServiceRole below reproduce exactly that, directly --
// nothing else PostgREST does (routing, response shaping, etc.) has any
// bearing on RLS, which is a pure Postgres feature.
import { Pool, type PoolClient } from "pg";

const connectionString =
  process.env.RLS_TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:55432/haarchive_rls_test";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) pool = new Pool({ connectionString });
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/** Runs `fn` inside a transaction with the Postgres role switched to
 * `authenticated` and `request.jwt.claim.sub` set to `userId` -- exactly
 * the state a real PostgREST request would establish for a signed-in
 * user. Always rolls back, so tests never leave cross-test state behind
 * regardless of what they write. */
export async function asUser<T>(userId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
    const result = await fn(client);
    await client.query("rollback");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Same shape, but as the anon role with no jwt.sub -- auth.uid() returns
 * null, matching a signed-out request. */
export async function asAnon<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role anon");
    const result = await fn(client);
    await client.query("rollback");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** service_role has BYPASSRLS (see bootstrap.sql) -- used only for fixture
 * setup/teardown and for exercising the app's own service-role call sites,
 * never as a way to "prove" something an authenticated-role test should be
 * proving instead. */
export async function asServiceRole<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role service_role");
    const result = await fn(client);
    await client.query("rollback");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Fixture setup/teardown needs to persist ACROSS the per-test rollback
 * transactions above -- this runs and commits as service_role (bypasses
 * RLS, same as the app's own service-role client), outside any test's own
 * transaction. */
export async function withCommittedServiceRole<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role service_role");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
