import { afterEach, describe, expect, it, vi } from "vitest";

import { createScriptedSupabaseClient } from "./supabase-test-utils";

// publishWorkouts is the batch equivalent of WorkoutForm's single
// "Published" checkbox + save round-trip (see actions.ts's own header
// comment on the function) -- one atomic UPDATE, scoped to athlete_id +
// coach_id + published_at IS NULL, so only still-draft rows in the given
// id set ever flip. Same scripted-mock shape as post-race-actions.test.ts:
// createClient() is next/headers-backed and needs a mock to run under
// Vitest's node environment; getAppSession() is mocked directly since the
// action calls it as a plain function.

vi.mock("@/lib/db/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db/service-role", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAppSession: vi.fn() }));
vi.mock("@/lib/notifications/create-notification", () => ({ createNotification: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import { publishWorkouts } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/actions";

afterEach(() => {
  vi.clearAllMocks();
});

const COACH_SESSION = { userId: "coach-1", isPrivateCoach: true } as never;

describe("publishWorkouts", () => {
  it("flips only the still-draft rows in the given id set, leaving already-published rows alone", async () => {
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);
    const { client, callLog } = createScriptedSupabaseClient(
      [
        { table: "coach_athletes", result: { data: { id: "rel-1" }, error: null } },
        // Three ids requested (one draft, one already-published, one
        // completed) -- the WHERE clause's published_at IS NULL means the
        // database itself only matches the one real draft, which is what
        // the scripted response simulates by returning a single row.
        { table: "scheduled_workouts", result: { data: [{ id: "workout-draft" }], error: null } },
      ],
      "coach-1",
    );
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await publishWorkouts(["workout-draft", "workout-published", "workout-completed"], "athlete-1");

    expect(result.error).toBeUndefined();
    expect(result.publishedCount).toBe(1);
    expect(callLog.map((c) => c.table)).toEqual(["coach_athletes", "scheduled_workouts"]);

    const updateCall = callLog[1].calls.find((c) => c.method === "update");
    expect(updateCall).toBeTruthy();
    const isCall = callLog[1].calls.find((c) => c.method === "is");
    expect(isCall?.args).toEqual(["published_at", null]);
    const inCall = callLog[1].calls.find((c) => c.method === "in");
    expect(inCall?.args).toEqual(["id", ["workout-draft", "workout-published", "workout-completed"]]);
  });

  it("refuses to publish when the caller doesn't coach this athlete, and never touches scheduled_workouts", async () => {
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);
    const { client, callLog } = createScriptedSupabaseClient(
      [{ table: "coach_athletes", result: { data: null, error: null } }],
      "coach-1",
    );
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await publishWorkouts(["workout-draft"], "someone-elses-athlete");

    expect(result.error).toBe("You don't coach this athlete.");
    expect(result.publishedCount).toBeUndefined();
    expect(callLog.map((c) => c.table)).toEqual(["coach_athletes"]);
  });

  it("is idempotent -- calling it again on an already-published set publishes nothing new", async () => {
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);
    const { client } = createScriptedSupabaseClient(
      [
        { table: "coach_athletes", result: { data: { id: "rel-1" }, error: null } },
        // The published_at IS NULL filter now matches zero rows -- the
        // workout was already published by a prior call, or by the single-
        // workout editor in the meantime.
        { table: "scheduled_workouts", result: { data: [], error: null } },
      ],
      "coach-1",
    );
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await publishWorkouts(["workout-already-published"], "athlete-1");

    expect(result.error).toBeUndefined();
    expect(result.publishedCount).toBe(0);
  });

  it("short-circuits on an empty id list without querying the database at all", async () => {
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);
    const { client, callLog } = createScriptedSupabaseClient([], "coach-1");
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await publishWorkouts([], "athlete-1");

    expect(result).toEqual({ publishedCount: 0 });
    expect(callLog).toEqual([]);
  });
});
