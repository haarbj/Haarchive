import { afterEach, describe, expect, it, vi } from "vitest";

import { createScriptedSupabaseClient } from "./supabase-test-utils";

// Representative mutations refuse outright, server-side, the moment a
// coach session has an active view-as mode -- regardless of which id
// the write would otherwise target. Each action is invoked directly
// (bypassing any UI) against a supabase client scripted with ZERO steps:
// if the guard ever stopped firing before the first real query, the
// very next .from() call would throw "unexpected extra call" rather
// than this test silently passing, so a regression here fails loud.
vi.mock("@/lib/private-coaching/view-as", () => ({
  isViewingAsAthlete: vi.fn().mockResolvedValue(true),
  VIEW_AS_REFUSAL: "Viewing as an athlete is read-only. Exit view-as to do this.",
}));
vi.mock("@/lib/db/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db/service-role", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAppSession: vi.fn() }));
vi.mock("@/lib/notifications/create-notification", () => ({ createNotification: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import { submitCoachingCheckin } from "@/app/(app)/(protected)/coaching/checkin/actions";
import { completeScheduledWorkout, approveStravaMatch } from "@/app/(app)/(protected)/coaching/workouts/[workoutId]/completion-actions";
import { sendCoachAthleteMessage } from "@/app/(app)/(protected)/coaching/messages/actions";

const COACH_SESSION = { userId: "coach-1", isPrivateCoach: true } as never;

afterEach(() => {
  vi.clearAllMocks();
});

function zeroStepClient() {
  const { client, callLog } = createScriptedSupabaseClient([], null);
  vi.mocked(createClient).mockResolvedValue(client as never);
  return callLog;
}

describe("server refusal while view-as is active: representative mutations write nothing", () => {
  it("check-in submission refuses and performs no write", async () => {
    const callLog = zeroStepClient();
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);

    const formData = new FormData();
    formData.set("overallFeel", "3");
    formData.set("fatigue", "3");
    formData.set("soreness", "3");
    formData.set("sleepQuality", "3");
    formData.set("stress", "3");

    const result = await submitCoachingCheckin({}, formData);

    expect(result.error).toBe("Viewing as an athlete is read-only. Exit view-as to do this.");
    expect(callLog).toHaveLength(0);
  });

  it("completion logging refuses and performs no write", async () => {
    const callLog = zeroStepClient();
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);

    const result = await completeScheduledWorkout({ scheduledWorkoutId: "11111111-1111-1111-1111-111111111111", painReported: false });

    expect(result.error).toBe("Viewing as an athlete is read-only. Exit view-as to do this.");
    expect(callLog).toHaveLength(0);
  });

  it("Strava match approval refuses and performs no write", async () => {
    const callLog = zeroStepClient();
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);

    const result = await approveStravaMatch("workout-1", "match-1");

    expect(result.error).toBe("Viewing as an athlete is read-only. Exit view-as to do this.");
    expect(callLog).toHaveLength(0);
  });

  it("message sending refuses and performs no write", async () => {
    const callLog = zeroStepClient();
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);

    const formData = new FormData();
    formData.set("body", "hello");

    const result = await sendCoachAthleteMessage("coach-athlete-1", {}, formData);

    expect(result.error).toBe("Viewing as an athlete is read-only. Exit view-as to do this.");
    expect(callLog).toHaveLength(0);
  });
});
