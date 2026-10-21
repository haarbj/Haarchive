import { afterEach, describe, expect, it, vi } from "vitest";

// Same mocking shape conversion-actions.test.ts already establishes for
// a next/headers-backed action: createClient needs a mock to run under
// Vitest's node environment, and cookies()/redirect() need mocks of
// their own since there's no real Next request scope here.
vi.mock("@/lib/db/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAppSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { enterViewAsAthlete, exitViewAsAthlete } from "@/lib/private-coaching/view-as-actions";
import { VIEW_AS_COOKIE } from "@/lib/private-coaching/view-as";

afterEach(() => {
  vi.clearAllMocks();
});

function fakeSupabase(relationshipExists: boolean) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: relationshipExists ? { id: "rel-1" } : null, error: null }),
  };
  return { from: () => builder };
}

function mockCookieStore() {
  const set = vi.fn();
  const del = vi.fn();
  let stored: string | null = null;
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) => (name === VIEW_AS_COOKIE && stored != null ? { name, value: stored } : undefined),
    set: (name: string, value: string) => {
      stored = value;
      set(name, value);
    },
    delete: (name: string) => {
      stored = null;
      del(name);
    },
  } as never);
  return { set, del, setStoredDirectly: (v: string | null) => (stored = v) };
}

describe("enterViewAsAthlete: authorization", () => {
  it("denies a session that isn't a private coach at all", async () => {
    vi.mocked(getAppSession).mockResolvedValue({ userId: "user-1", isPrivateCoach: false } as never);
    const result = await enterViewAsAthlete("athlete-1", {}, new FormData());
    expect(result.error).toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("denies targeting yourself -- no view-as button is ever shown for the self row, and this is the backstop", async () => {
    vi.mocked(getAppSession).mockResolvedValue({ userId: "coach-1", isPrivateCoach: true } as never);
    const result = await enterViewAsAthlete("coach-1", {}, new FormData());
    expect(result.error).toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("denies a target that isn't the caller's own active athlete (another coach's athlete, or an ended relationship)", async () => {
    vi.mocked(getAppSession).mockResolvedValue({ userId: "coach-1", isPrivateCoach: true } as never);
    vi.mocked(createClient).mockResolvedValue(fakeSupabase(false) as never);
    const result = await enterViewAsAthlete("someone-elses-athlete", {}, new FormData());
    expect(result.error).toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("activates for the coach's own active athlete: sets the cookie and redirects to the athlete's home", async () => {
    vi.mocked(getAppSession).mockResolvedValue({ userId: "coach-1", isPrivateCoach: true } as never);
    vi.mocked(createClient).mockResolvedValue(fakeSupabase(true) as never);
    const { set } = mockCookieStore();

    await enterViewAsAthlete("athlete-1", {}, new FormData());

    expect(set).toHaveBeenCalledWith(VIEW_AS_COOKIE, "athlete-1");
    expect(redirect).toHaveBeenCalledWith("/coaching");
  });
});

describe("exitViewAsAthlete", () => {
  it("clears the cookie and returns to that athlete's coach-side detail page", async () => {
    const { del, setStoredDirectly } = mockCookieStore();
    setStoredDirectly("athlete-1");

    await exitViewAsAthlete();

    expect(del).toHaveBeenCalledWith(VIEW_AS_COOKIE);
    expect(redirect).toHaveBeenCalledWith("/coaching/athletes/athlete-1");
  });

  it("never errors even if the cookie was already gone -- falls back to the roster", async () => {
    mockCookieStore();
    await exitViewAsAthlete();
    expect(redirect).toHaveBeenCalledWith("/coaching/roster");
  });
});
