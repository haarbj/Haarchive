import { afterEach, describe, expect, it, vi } from "vitest";

import { createScriptedSupabaseClient } from "./supabase-test-utils";

// deleteWorkouts is the batch equivalent of the single-workout
// deleteScheduledWorkout, for the same day/week/phase scopes
// publishWorkouts already covers (actions.ts's own header comment). Unlike
// publishWorkouts, there's no published_at filter on the delete itself --
// a batch delete clears drafts and already-published/completed workouts
// alike, same as the single-workout version already does regardless of
// status. Same scripted-mock shape as publish-workouts-action.test.ts.

vi.mock("@/lib/db/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db/service-role", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAppSession: vi.fn() }));
vi.mock("@/lib/notifications/create-notification", () => ({ createNotification: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createClient } from "@/lib/db/server";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { getAppSession } from "@/lib/auth/session";
import { createNotification } from "@/lib/notifications/create-notification";
import { deleteWorkouts } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/actions";

afterEach(() => {
  vi.clearAllMocks();
});

const COACH_SESSION = { userId: "coach-1", isPrivateCoach: true } as never;

function stubAdminClient() {
  const insert = vi.fn(async () => ({ data: null, error: null }));
  vi.mocked(createServiceRoleClient).mockReturnValue({ from: () => ({ insert }) } as never);
  return insert;
}

describe("deleteWorkouts", () => {
  it("deletes every id regardless of published/completed status, unlike publishWorkouts' draft-only filter", async () => {
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);
    stubAdminClient();
    const { client, callLog } = createScriptedSupabaseClient(
      [
        { table: "coach_athletes", result: { data: { id: "rel-1" }, error: null } },
        {
          table: "scheduled_workouts",
          result: {
            data: [
              { id: "workout-draft", published_at: null, day_label: "Easy", title: null },
              { id: "workout-published", published_at: "2026-10-01T00:00:00Z", day_label: "Long Run", title: null },
            ],
            error: null,
          },
        },
        { table: "scheduled_workouts", result: { data: [{ id: "workout-draft" }, { id: "workout-published" }], error: null } },
      ],
      "coach-1",
    );
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await deleteWorkouts(["workout-draft", "workout-published"], "athlete-1");

    expect(result.error).toBeUndefined();
    expect(result.deletedCount).toBe(2);
    expect(callLog.map((c) => c.table)).toEqual(["coach_athletes", "scheduled_workouts", "scheduled_workouts"]);

    // The actual delete call has no published_at filter at all -- that's
    // the whole point of this action existing separately from publish.
    const deleteCall = callLog[2].calls.find((c) => c.method === "delete");
    expect(deleteCall).toBeTruthy();
    const isCall = callLog[2].calls.find((c) => c.method === "is");
    expect(isCall).toBeUndefined();
  });

  it("notifies the athlete once, with a count, when more than one already-published workout was deleted", async () => {
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);
    stubAdminClient();
    const { client } = createScriptedSupabaseClient(
      [
        { table: "coach_athletes", result: { data: { id: "rel-1" }, error: null } },
        {
          table: "scheduled_workouts",
          result: {
            data: [
              { id: "w1", published_at: "2026-10-01T00:00:00Z", day_label: "Easy", title: null },
              { id: "w2", published_at: "2026-10-02T00:00:00Z", day_label: "Tempo", title: null },
            ],
            error: null,
          },
        },
        { table: "scheduled_workouts", result: { data: [{ id: "w1" }, { id: "w2" }], error: null } },
      ],
      "coach-1",
    );
    vi.mocked(createClient).mockResolvedValue(client as never);

    await deleteWorkouts(["w1", "w2"], "athlete-1");

    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: "athlete-1", content: "2 workouts were removed from your schedule" }));
  });

  it("never notifies when every deleted workout was still a draft", async () => {
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);
    stubAdminClient();
    const { client } = createScriptedSupabaseClient(
      [
        { table: "coach_athletes", result: { data: { id: "rel-1" }, error: null } },
        { table: "scheduled_workouts", result: { data: [{ id: "w1", published_at: null, day_label: "Easy", title: null }], error: null } },
        { table: "scheduled_workouts", result: { data: [{ id: "w1" }], error: null } },
      ],
      "coach-1",
    );
    vi.mocked(createClient).mockResolvedValue(client as never);

    await deleteWorkouts(["w1"], "athlete-1");

    expect(createNotification).not.toHaveBeenCalled();
  });

  it("refuses to delete when the caller doesn't coach this athlete, and never touches scheduled_workouts", async () => {
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);
    const { client, callLog } = createScriptedSupabaseClient(
      [{ table: "coach_athletes", result: { data: null, error: null } }],
      "coach-1",
    );
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await deleteWorkouts(["workout-1"], "someone-elses-athlete");

    expect(result.error).toBe("You don't coach this athlete.");
    expect(result.deletedCount).toBeUndefined();
    expect(callLog.map((c) => c.table)).toEqual(["coach_athletes"]);
  });

  it("short-circuits on an empty id list without querying the database at all", async () => {
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);
    const { client, callLog } = createScriptedSupabaseClient([], "coach-1");
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await deleteWorkouts([], "athlete-1");

    expect(result).toEqual({ deletedCount: 0 });
    expect(callLog).toEqual([]);
  });

  it("rejects a non-coach session before touching the database", async () => {
    vi.mocked(getAppSession).mockResolvedValue({ userId: "someone", isPrivateCoach: false } as never);

    const result = await deleteWorkouts(["workout-1"], "athlete-1");

    expect(result.error).toBe("Not authorized.");
    expect(createClient).not.toHaveBeenCalled();
  });
});
