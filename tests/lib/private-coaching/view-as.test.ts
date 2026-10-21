import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { cookies } from "next/headers";
import { resolveViewAsState, isViewingAsAthlete, VIEW_AS_COOKIE } from "@/lib/private-coaching/view-as";

afterEach(() => {
  vi.clearAllMocks();
});

// A minimal fake matching only the one query shape view-as.ts actually
// issues (.from("coach_athletes").select().eq().eq().eq().maybeSingle()) --
// not the full scripted-client utility (tests/app/supabase-test-utils.ts),
// since that's `tests/app`-scoped and this module takes no cookie/action
// dependencies beyond this single query shape.
function fakeSupabase(relationshipExists: boolean) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: relationshipExists ? { id: "rel-1" } : null, error: null }),
  };
  return { from: () => builder } as unknown as Parameters<typeof resolveViewAsState>[0];
}

function mockCookie(value: string | null) {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) => (name === VIEW_AS_COOKIE && value != null ? { name, value } : undefined),
  } as never);
}

describe("resolveViewAsState", () => {
  it("is active for the coach's own active athlete", async () => {
    mockCookie("athlete-1");
    const state = await resolveViewAsState(fakeSupabase(true), "coach-1");
    expect(state).toEqual({ athleteId: "athlete-1" });
  });

  it("is inactive when no cookie is set at all", async () => {
    mockCookie(null);
    expect(await resolveViewAsState(fakeSupabase(true), "coach-1")).toBeNull();
  });

  it("is inactive for another coach's athlete -- no active (coach, athlete) relationship row", async () => {
    mockCookie("someone-elses-athlete");
    expect(await resolveViewAsState(fakeSupabase(false), "coach-1")).toBeNull();
  });

  it("is inactive for an ended relationship -- the query itself only matches status='active', so an ended row resolves the same as none", async () => {
    mockCookie("former-athlete");
    expect(await resolveViewAsState(fakeSupabase(false), "coach-1")).toBeNull();
  });

  it("is inactive when the cookie targets the caller themselves -- never 'view as yourself', even if somehow set", async () => {
    mockCookie("coach-1");
    // Not even queried: self-targeting is rejected before the DB round-trip.
    expect(await resolveViewAsState(fakeSupabase(true), "coach-1")).toBeNull();
  });

  it("falls back silently (null, no throw) rather than erroring on any invalid state", async () => {
    mockCookie("not-a-real-athlete");
    await expect(resolveViewAsState(fakeSupabase(false), "coach-1")).resolves.toBeNull();
  });
});

describe("isViewingAsAthlete", () => {
  it("true only when resolveViewAsState would return a real state", async () => {
    mockCookie("athlete-1");
    expect(await isViewingAsAthlete(fakeSupabase(true), "coach-1")).toBe(true);
  });

  it("false for a normal session with no view-as cookie at all -- a plain athlete submitting their own data is never refused", async () => {
    mockCookie(null);
    expect(await isViewingAsAthlete(fakeSupabase(true), "athlete-1")).toBe(false);
  });
});
