import { afterEach, describe, expect, it, vi } from "vitest";

import { createScriptedSupabaseClient } from "./supabase-test-utils";

// Approval resilience: approveStravaMatch's own completion/notification/
// audit-log writes must succeed and return {success: true} regardless of
// whether the post-approval conditions-analysis trigger throws -- the
// athlete's completion is already saved by the time that trigger ever
// runs. Mirrors publish-workouts-action.test.ts's own scripted-client
// pattern, across BOTH clients approveStravaMatch actually uses (the
// session-scoped `supabase` and the service-role `admin`).
//
// `next/server`'s `after()` requires a real Next.js request scope to run
// at all -- mocked here to invoke its callback immediately (and awaited),
// simulating what the runtime does after the response is sent, so the
// callback's own throw is exercised in this test rather than silently
// never running.

vi.mock("@/lib/db/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db/service-role", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAppSession: vi.fn() }));
vi.mock("@/lib/notifications/create-notification", () => ({ createNotification: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn((task: () => unknown) => task()) }));
vi.mock("@/lib/private-coaching/completion-conditions-service", () => ({ analyzeCompletedWorkoutConditions: vi.fn() }));
// Not under test here -- view-as mode is always inactive for this
// scripted coach session; isViewingAsAthlete itself reads cookies() via
// next/headers, which throws outside a real request scope the way this
// test's own comment above already explains for next/server's after().
vi.mock("@/lib/private-coaching/view-as", () => ({ isViewingAsAthlete: vi.fn().mockResolvedValue(false), VIEW_AS_REFUSAL: "Viewing as an athlete is read-only." }));

import { createClient } from "@/lib/db/server";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { getAppSession } from "@/lib/auth/session";
import { after } from "next/server";
import { analyzeCompletedWorkoutConditions } from "@/lib/private-coaching/completion-conditions-service";
import { approveStravaMatch } from "@/app/(app)/(protected)/coaching/workouts/[workoutId]/completion-actions";

afterEach(() => {
  vi.clearAllMocks();
});

const ATHLETE_SESSION = { userId: "athlete-1" } as never;

function sessionClientScript() {
  return [
    {
      table: "strava_pending_matches",
      result: {
        data: { id: "pending-1", strava_activity_id: 111, activity_distance_m: 5000, activity_duration_s: 1500, activity_avg_hr: 150, combined_activities: null },
        error: null,
      },
    },
    { table: "scheduled_workouts", result: { data: { id: "workout-1", coach_id: "coach-1", athlete_id: "athlete-1", title: null, day_label: "Easy" }, error: null } },
    { table: "completed_workouts", result: { data: { id: "cw-1" }, error: null } },
    { table: "strava_pending_matches", result: { data: null, error: null } },
    { table: "profiles", result: { data: { display_name: "Jordan" }, error: null } },
  ];
}

function serviceRoleClientScript() {
  return [
    { table: "scheduled_workouts", result: { data: null, error: null } },
    { table: "audit_log", result: { data: null, error: null } },
  ];
}

describe("approveStravaMatch -- analysis failure never affects the approval itself", () => {
  it("still returns success and completes every one of its own writes when the conditions-analysis trigger throws", async () => {
    vi.mocked(getAppSession).mockResolvedValue(ATHLETE_SESSION);
    const sessionScript = createScriptedSupabaseClient(sessionClientScript(), "athlete-1");
    const serviceScript = createScriptedSupabaseClient(serviceRoleClientScript(), null);
    vi.mocked(createClient).mockResolvedValue(sessionScript.client as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(serviceScript.client as never);
    vi.mocked(analyzeCompletedWorkoutConditions).mockRejectedValue(new Error("boom -- weather API is down"));

    const result = await approveStravaMatch("workout-1", "pending-1");

    expect(result).toEqual({ success: true });
    // Every one of approveStravaMatch's own steps ran -- the analysis
    // failure (thrown inside the after() callback this mock invoked
    // synchronously) never interrupted or rolled any of them back.
    expect(sessionScript.callLog.map((c) => c.table)).toEqual([
      "strava_pending_matches",
      "scheduled_workouts",
      "completed_workouts",
      "strava_pending_matches",
      "profiles",
    ]);
    expect(serviceScript.callLog.map((c) => c.table)).toEqual(["scheduled_workouts", "audit_log"]);

    // The trigger really was invoked, by the real completion's id.
    expect(after).toHaveBeenCalledTimes(1);
    expect(analyzeCompletedWorkoutConditions).toHaveBeenCalledWith("cw-1");
  });

  it("still returns success when the trigger resolves normally too (the common case)", async () => {
    vi.mocked(getAppSession).mockResolvedValue(ATHLETE_SESSION);
    const sessionScript = createScriptedSupabaseClient(sessionClientScript(), "athlete-1");
    const serviceScript = createScriptedSupabaseClient(serviceRoleClientScript(), null);
    vi.mocked(createClient).mockResolvedValue(sessionScript.client as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(serviceScript.client as never);
    vi.mocked(analyzeCompletedWorkoutConditions).mockResolvedValue(undefined);

    const result = await approveStravaMatch("workout-1", "pending-1");
    expect(result).toEqual({ success: true });
  });
});
