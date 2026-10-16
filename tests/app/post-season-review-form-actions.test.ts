import { afterEach, describe, expect, it, vi } from "vitest";

import { createScriptedSupabaseClient } from "./supabase-test-utils";

// Part H follow-up: loadPostSeasonReviewForm used to derive raceName by
// joining through goal_id, which left it null for a manually-sent review
// (no goal_id at all). It now reads race_name directly off the request
// row -- populated by sendPostSeasonReview for either path -- so a
// manually-sent review names its race on the athlete's own form exactly
// like a goal-race-anchored one does, with no goals query at all.

vi.mock("@/lib/db/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAppSession: vi.fn() }));
vi.mock("@/lib/notifications/create-notification", () => ({ createNotification: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import { loadPostSeasonReviewForm } from "@/app/(app)/(protected)/coaching/post-season-review/[requestId]/actions";

afterEach(() => {
  vi.clearAllMocks();
});

const ATHLETE_SESSION = { userId: "athlete-1" } as never;

describe("loadPostSeasonReviewForm", () => {
  it("names the race for a manually-sent request (null goal_id) without any goals query", async () => {
    vi.mocked(getAppSession).mockResolvedValue(ATHLETE_SESSION);
    const { client, callLog } = createScriptedSupabaseClient(
      [
        {
          table: "post_season_review_requests",
          result: {
            data: { id: "req-1", athlete_id: "athlete-1", coach_id: "coach-1", goal_id: null, race_name: "Local 10K", submitted_at: null },
            error: null,
          },
        },
        { table: "post_season_review_answers", result: { data: [], error: null } },
      ],
      "athlete-1",
    );
    vi.mocked(createClient).mockResolvedValue(client as never);

    const view = await loadPostSeasonReviewForm({ requestId: "req-1" });

    expect(view.raceName).toBe("Local 10K");
    expect(callLog.map((c) => c.table)).toEqual(["post_season_review_requests", "post_season_review_answers"]);
  });

  it("still names the race for a goal-race-anchored request", async () => {
    vi.mocked(getAppSession).mockResolvedValue(ATHLETE_SESSION);
    const { client } = createScriptedSupabaseClient(
      [
        {
          table: "post_season_review_requests",
          result: {
            data: { id: "req-2", athlete_id: "athlete-1", coach_id: "coach-1", goal_id: "goal-1", race_name: "Chicago Marathon", submitted_at: null },
            error: null,
          },
        },
        { table: "post_season_review_answers", result: { data: [], error: null } },
      ],
      "athlete-1",
    );
    vi.mocked(createClient).mockResolvedValue(client as never);

    const view = await loadPostSeasonReviewForm({ requestId: "req-2" });
    expect(view.raceName).toBe("Chicago Marathon");
  });
});
