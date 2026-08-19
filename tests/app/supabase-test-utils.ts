import { vi } from "vitest";

// A minimal, ordered fake for the Supabase query-builder chain used by
// learning-actions.ts / knowledge-check-actions.ts (.from().select().eq()
// .in().contains().order().limit().maybeSingle()/.returns(), plus
// .insert()/.upsert()). Not a general-purpose Supabase mock -- just enough
// chain surface for these two files' actual call shapes.
//
// Deliberately a strict, ordered script rather than a table-keyed lookup:
// each test lists the exact sequence of .from(table) calls production code
// is expected to make, and each step's {data, error} is consumed once, in
// order. A call that doesn't match the next expected step throws
// immediately, so a test fails loudly (wrong step/table) instead of
// silently pairing a query with the wrong canned response -- and, more
// importantly, a regression that skips or adds a query is caught by a
// mismatched call count, not just a wrong final return value.

export type MockResult = { data: unknown; error: { message: string; code?: string } | null };
export type ScriptStep = { table: string; result: MockResult };
export type RecordedCall = { method: string; args: unknown[] };
export type RecordedFrom = { table: string; calls: RecordedCall[] };

function createQueryBuilder(result: MockResult, calls: RecordedCall[]) {
  const record = (method: string, args: unknown[]) => {
    calls.push({ method, args });
    return builder;
  };
  const builder: Record<string, unknown> = {
    select: (...args: unknown[]) => record("select", args),
    insert: (...args: unknown[]) => record("insert", args),
    upsert: (...args: unknown[]) => record("upsert", args),
    eq: (...args: unknown[]) => record("eq", args),
    in: (...args: unknown[]) => record("in", args),
    contains: (...args: unknown[]) => record("contains", args),
    order: (...args: unknown[]) => record("order", args),
    limit: (...args: unknown[]) => record("limit", args),
    returns: () => builder,
    maybeSingle: async () => result,
    single: async () => result,
    then: (onFulfilled: (r: MockResult) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return builder;
}

// userId: null simulates an unauthenticated session (getClaims() resolves
// with no claims.sub), matching every production call site's own check.
export function createScriptedSupabaseClient(script: ScriptStep[], userId: string | null) {
  let i = 0;
  const callLog: RecordedFrom[] = [];
  const client = {
    auth: {
      getClaims: vi.fn(async () => ({ data: userId ? { claims: { sub: userId } } : null })),
    },
    from(table: string) {
      const step = script[i];
      if (!step) {
        throw new Error(`Unexpected extra .from("${table}") call -- script only had ${script.length} step(s)`);
      }
      if (step.table !== table) {
        throw new Error(`Step ${i}: expected .from("${step.table}"), got .from("${table}")`);
      }
      i++;
      const calls: RecordedCall[] = [];
      callLog.push({ table, calls });
      return createQueryBuilder(step.result, calls);
    },
  };
  return { client, callLog };
}
