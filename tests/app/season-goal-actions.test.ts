import { afterEach, describe, expect, it, vi } from "vitest";

import { createScriptedSupabaseClient } from "./supabase-test-utils";

vi.mock("@/lib/db/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAppSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/private-coaching/view-as", () => ({
  isViewingAsAthlete: vi.fn().mockResolvedValue(false),
  VIEW_AS_REFUSAL: "Viewing as an athlete is read-only. Exit view-as to do this.",
}));

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import { isViewingAsAthlete } from "@/lib/private-coaching/view-as";
import { updateSeasonGoal } from "@/app/(app)/(protected)/coaching/season-goal-actions";
import { SEASON_GOAL_MAX_LENGTH } from "@/lib/validation/athlete-profile";

const ATHLETE_SESSION = { userId: "athlete-1", isPrivateCoach: false } as never;

afterEach(() => {
  vi.clearAllMocks();
});

function formDataWith(seasonGoal: string) {
  const fd = new FormData();
  fd.set("seasonGoal", seasonGoal);
  return fd;
}

describe("updateSeasonGoal", () => {
  it("sets a new season goal, upserted against the caller's own user_id (never another id)", async () => {
    const { client, callLog } = createScriptedSupabaseClient(
      [{ table: "athlete_profiles", result: { data: null, error: null } }],
      "athlete-1",
    );
    vi.mocked(getAppSession).mockResolvedValue(ATHLETE_SESSION);
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await updateSeasonGoal({}, formDataWith("Qualify for Boston and get there healthy enough to enjoy it."));

    expect(result.error).toBeUndefined();
    const upsertCall = callLog[0].calls.find((c) => c.method === "upsert");
    expect(upsertCall?.args[0]).toEqual({
      user_id: "athlete-1",
      season_goal: "Qualify for Boston and get there healthy enough to enjoy it.",
    });
  });

  it("editing replaces the value -- same action, same call shape, no history kept", async () => {
    const { client, callLog } = createScriptedSupabaseClient(
      [{ table: "athlete_profiles", result: { data: null, error: null } }],
      "athlete-1",
    );
    vi.mocked(getAppSession).mockResolvedValue(ATHLETE_SESSION);
    vi.mocked(createClient).mockResolvedValue(client as never);

    await updateSeasonGoal({}, formDataWith("Run one truly joyful marathon this year."));

    const upsertCall = callLog[0].calls.find((c) => c.method === "upsert");
    expect(upsertCall?.args[0]).toEqual({ user_id: "athlete-1", season_goal: "Run one truly joyful marathon this year." });
  });

  it("trims whitespace and stores an empty value as null, not an empty string", async () => {
    const { client, callLog } = createScriptedSupabaseClient(
      [{ table: "athlete_profiles", result: { data: null, error: null } }],
      "athlete-1",
    );
    vi.mocked(getAppSession).mockResolvedValue(ATHLETE_SESSION);
    vi.mocked(createClient).mockResolvedValue(client as never);

    await updateSeasonGoal({}, formDataWith("   "));

    const upsertCall = callLog[0].calls.find((c) => c.method === "upsert");
    expect(upsertCall?.args[0]).toEqual({ user_id: "athlete-1", season_goal: null });
  });

  it(`rejects a value longer than ${SEASON_GOAL_MAX_LENGTH} characters, writing nothing`, async () => {
    const { client, callLog } = createScriptedSupabaseClient([], "athlete-1");
    vi.mocked(getAppSession).mockResolvedValue(ATHLETE_SESSION);
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await updateSeasonGoal({}, formDataWith("x".repeat(SEASON_GOAL_MAX_LENGTH + 1)));

    expect(result.error).toBeTruthy();
    expect(callLog).toHaveLength(0);
  });

  it("requires a signed-in session", async () => {
    vi.mocked(getAppSession).mockResolvedValue(null);
    const result = await updateSeasonGoal({}, formDataWith("Anything"));
    expect(result.error).toBe("Sign in first.");
  });

  it("there is no coach write path: a coach in view-as mode is refused by the same guard every other athlete-surface mutation uses, writing nothing", async () => {
    const { client, callLog } = createScriptedSupabaseClient([], "coach-1");
    vi.mocked(getAppSession).mockResolvedValue({ userId: "coach-1", isPrivateCoach: true } as never);
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(isViewingAsAthlete).mockResolvedValue(true);

    const result = await updateSeasonGoal({}, formDataWith("Coach trying to write this"));

    expect(result.error).toBe("Viewing as an athlete is read-only. Exit view-as to do this.");
    expect(callLog).toHaveLength(0);
  });
});
