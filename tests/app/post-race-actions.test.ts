import { afterEach, describe, expect, it, vi } from "vitest";

import { createScriptedSupabaseClient } from "./supabase-test-utils";

// Proves the fix for post-race.ts's own documented limitation: "review
// sent" used to be detected by ilike-searching coach_athlete_messages for
// POST_SEASON_REVIEW_MARKER, so renaming the questionnaire's title line
// broke recognition and the flow would offer to send it again even though
// it already had been. loadPostRaceFlow now derives reviewSent from a
// real post_season_review_requests row scoped to (coach_athlete_id,
// goal_id) -- the script below never includes a coach_athlete_messages
// step at all, so if production code regressed back to searching the
// thread, the mock would throw ("expected .from(\"post_season_review_
// requests\"), got .from(\"coach_athlete_messages\")") rather than silently
// passing.
//
// Same scripted-mock shape as private-coaching-step-fields.test.ts:
// createClient() is next/headers-backed and needs a mock to run under
// Vitest's node environment; getAppSession() is mocked directly since
// requireCoachOf calls it as a plain function, not through the supabase
// client.

vi.mock("@/lib/db/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAppSession: vi.fn() }));
vi.mock("@/lib/notifications/create-notification", () => ({ createNotification: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import { loadPostRaceFlow } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/post-race-actions";
import { POST_SEASON_REVIEW_TITLE } from "@/lib/private-coaching/post-race";

afterEach(() => {
  vi.clearAllMocks();
});

const COACH_SESSION = { userId: "coach-1", isPrivateCoach: true } as never;

function scriptUpTo(reviewRequestResult: { data: unknown; error: null }) {
  return createScriptedSupabaseClient(
    [
      { table: "coach_athletes", result: { data: { id: "rel-1" }, error: null } },
      {
        table: "goals",
        result: { data: [{ id: "goal-1", race_name: "Chicago Marathon", goal_date: "2026-10-11", status: "active" }], error: null },
      },
      { table: "training_programs", result: { data: { id: "program-1" }, error: null } },
      { table: "training_phases", result: { data: [], error: null } },
      { table: "post_season_review_requests", result: reviewRequestResult },
    ],
    "coach-1",
  );
}

describe("loadPostRaceFlow -- review-sent detection", () => {
  it("marks the review step done when a post_season_review_requests row exists for this race, without ever querying coach_athlete_messages", async () => {
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);
    const { client, callLog } = scriptUpTo({
      data: { id: "request-1", submitted_at: null },
      error: null,
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const view = await loadPostRaceFlow({ athleteId: "athlete-1" });

    expect(callLog.map((c) => c.table)).toEqual([
      "coach_athletes",
      "goals",
      "training_programs",
      "training_phases",
      "post_season_review_requests",
    ]);
    const review = view.flow?.steps.find((s) => s.key === "post-season-review");
    expect(review?.done).toBe(true);
    expect(view.reviewRequestId).toBe("request-1");
    expect(view.reviewSubmitted).toBe(false);
  });

  it("marks the review step NOT done when no request row exists for this race", async () => {
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);
    const { client } = scriptUpTo({ data: null, error: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const view = await loadPostRaceFlow({ athleteId: "athlete-1" });

    const review = view.flow?.steps.find((s) => s.key === "post-season-review");
    expect(review?.done).toBe(false);
    expect(view.reviewRequestId).toBeNull();
  });

  it("REGRESSION: detection is unaffected by what POST_SEASON_REVIEW_TITLE currently is -- the query never references it", async () => {
    // Earlier versions detected a resend with
    // `.ilike("body", \`%${POST_SEASON_REVIEW_MARKER}%\`)` against
    // coach_athlete_messages, so renaming the title broke recognition.
    // There is no title/marker string anywhere in the script below, and
    // the call-order assertion in the first test already proves
    // coach_athlete_messages is never touched -- this test just pins down
    // that the title constant exists and is a plain string (so a future
    // rename is possible at all) without this suite depending on its
    // value.
    expect(typeof POST_SEASON_REVIEW_TITLE).toBe("string");

    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);
    const { client } = scriptUpTo({ data: { id: "request-2", submitted_at: "2026-10-14T00:00:00Z" }, error: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const view = await loadPostRaceFlow({ athleteId: "athlete-1" });

    expect(view.flow?.steps.find((s) => s.key === "post-season-review")?.done).toBe(true);
    expect(view.reviewSubmitted).toBe(true);
  });
});
