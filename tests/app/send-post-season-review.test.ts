import { afterEach, describe, expect, it, vi } from "vitest";

import { createScriptedSupabaseClient } from "./supabase-test-utils";

// Covers Part H's manual-send follow-up: sendPostSeasonReview now accepts
// an optional { raceName, raceDate } that decouples the request from a
// goal race entirely (goal_id stays null), while the original no-args
// call (PostRacePanel's own call site) keeps its exact prior behavior.
// Both paths write real race_name/race_date and dedup against each other
// through the same findExistingReviewRequest check -- see post-race-
// actions.ts's own comment on why that's keyed by (coach_athlete_id,
// race_name, race_date) rather than goal_id.

vi.mock("@/lib/db/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAppSession: vi.fn() }));
vi.mock("@/lib/notifications/create-notification", () => ({ createNotification: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import { createNotification } from "@/lib/notifications/create-notification";
import { sendPostSeasonReview } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/post-race-actions";

afterEach(() => {
  vi.clearAllMocks();
});

const COACH_SESSION = { userId: "coach-1", isPrivateCoach: true } as never;

describe("sendPostSeasonReview -- manual path (raceName/raceDate given)", () => {
  it("creates a request with the given race name/date and a null goal_id, never touching goals", async () => {
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);
    const { client, callLog } = createScriptedSupabaseClient(
      [
        { table: "coach_athletes", result: { data: { id: "rel-1" }, error: null } },
        // findExistingReviewRequest: no prior request for this race.
        { table: "post_season_review_requests", result: { data: null, error: null } },
        { table: "coach_athlete_messages", result: { data: { id: "msg-1" }, error: null } },
        { table: "post_season_review_requests", result: { data: { id: "request-1" }, error: null } },
        { table: "post_season_review_answers", result: { data: null, error: null } },
      ],
      "coach-1",
    );
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await sendPostSeasonReview({ athleteId: "athlete-1", raceName: "Local 10K", raceDate: "2026-09-01" });

    expect(result).toEqual({ ok: true, requestId: "request-1" });
    // No "goals" table call anywhere -- the manual path never needs a
    // goal race to exist.
    expect(callLog.map((c) => c.table)).toEqual([
      "coach_athletes",
      "post_season_review_requests",
      "coach_athlete_messages",
      "post_season_review_requests",
      "post_season_review_answers",
    ]);

    const insertCall = callLog[3].calls.find((c) => c.method === "insert")!;
    expect(insertCall.args[0]).toMatchObject({
      coach_athlete_id: "rel-1",
      athlete_id: "athlete-1",
      goal_id: null,
      race_name: "Local 10K",
      race_date: "2026-09-01",
    });

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "athlete-1", content: expect.stringContaining("Local 10K") }),
    );
  });

  it("rejects a future race date", async () => {
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);
    const { client, callLog } = createScriptedSupabaseClient([{ table: "coach_athletes", result: { data: { id: "rel-1" }, error: null } }], "coach-1");
    vi.mocked(createClient).mockResolvedValue(client as never);

    const farFuture = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
    const result = await sendPostSeasonReview({ athleteId: "athlete-1", raceName: "Future 10K", raceDate: farFuture });

    expect(result.error).toMatch(/future/i);
    // Rejected before any write -- only the coach-gate lookup happened.
    expect(callLog.map((c) => c.table)).toEqual(["coach_athletes"]);
  });

  it("requires a non-empty race name", async () => {
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);
    const { client } = createScriptedSupabaseClient([{ table: "coach_athletes", result: { data: { id: "rel-1" }, error: null } }], "coach-1");
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await sendPostSeasonReview({ athleteId: "athlete-1", raceName: "   ", raceDate: "2026-09-01" });
    expect(result.error).toMatch(/race name/i);
  });
});

describe("sendPostSeasonReview -- goal-race path (no raceName/raceDate, PostRacePanel's own call)", () => {
  it("still populates race_name/race_date from the athlete's goal race, with a real goal_id", async () => {
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);
    const { client, callLog } = createScriptedSupabaseClient(
      [
        { table: "coach_athletes", result: { data: { id: "rel-1" }, error: null } },
        {
          table: "goals",
          result: { data: [{ id: "goal-1", race_name: "Chicago Marathon", goal_date: "2026-10-11", status: "active" }], error: null },
        },
        { table: "post_season_review_requests", result: { data: null, error: null } },
        { table: "coach_athlete_messages", result: { data: { id: "msg-1" }, error: null } },
        { table: "post_season_review_requests", result: { data: { id: "request-2" }, error: null } },
        { table: "post_season_review_answers", result: { data: null, error: null } },
      ],
      "coach-1",
    );
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await sendPostSeasonReview({ athleteId: "athlete-1" });

    expect(result).toEqual({ ok: true, requestId: "request-2" });
    const insertCall = callLog[4].calls.find((c) => c.method === "insert")!;
    expect(insertCall.args[0]).toMatchObject({
      goal_id: "goal-1",
      race_name: "Chicago Marathon",
      race_date: "2026-10-11",
    });
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("Chicago Marathon") }));
  });

  it("errors when there's no goal race and no raceName/raceDate given", async () => {
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);
    const { client } = createScriptedSupabaseClient(
      [
        { table: "coach_athletes", result: { data: { id: "rel-1" }, error: null } },
        { table: "goals", result: { data: [], error: null } },
      ],
      "coach-1",
    );
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await sendPostSeasonReview({ athleteId: "athlete-1" });
    expect(result.error).toMatch(/no race on record/i);
  });
});

describe("sendPostSeasonReview -- duplicate send for the same race is blocked", () => {
  it("surfaces the existing request id instead of creating a second one, for a manual send", async () => {
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);
    const { client, callLog } = createScriptedSupabaseClient(
      [
        { table: "coach_athletes", result: { data: { id: "rel-1" }, error: null } },
        { table: "post_season_review_requests", result: { data: { id: "existing-request", submitted_at: null }, error: null } },
      ],
      "coach-1",
    );
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await sendPostSeasonReview({ athleteId: "athlete-1", raceName: "Chicago Marathon", raceDate: "2026-10-11" });

    expect(result.error).toMatch(/already sent/i);
    expect(result.requestId).toBe("existing-request");
    // Never reaches the message/request/answers inserts.
    expect(callLog.map((c) => c.table)).toEqual(["coach_athletes", "post_season_review_requests"]);
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("blocks a manual send for a race already sent through the goal-race path, and vice versa (same race_name/race_date)", async () => {
    // This is the cross-path case the task calls out explicitly: a review
    // already sent one way is recognized by an attempt through the other
    // way, because both write the same race_name/race_date and dedup
    // reads by those columns, never goal_id.
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);
    const { client } = createScriptedSupabaseClient(
      [
        { table: "coach_athletes", result: { data: { id: "rel-1" }, error: null } },
        {
          table: "goals",
          result: { data: [{ id: "goal-1", race_name: "Chicago Marathon", goal_date: "2026-10-11", status: "active" }], error: null },
        },
        { table: "post_season_review_requests", result: { data: { id: "manually-sent-earlier", submitted_at: null }, error: null } },
      ],
      "coach-1",
    );
    vi.mocked(createClient).mockResolvedValue(client as never);

    // Goal-race path finds a request that was sent manually for the same race.
    const result = await sendPostSeasonReview({ athleteId: "athlete-1" });
    expect(result.error).toMatch(/already sent/i);
    expect(result.requestId).toBe("manually-sent-earlier");
  });
});

describe("sendPostSeasonReview -- RLS-equivalent coach gate", () => {
  it("rejects a non-coach session before touching the database", async () => {
    vi.mocked(getAppSession).mockResolvedValue({ userId: "someone", isPrivateCoach: false } as never);

    const result = await sendPostSeasonReview({ athleteId: "athlete-1", raceName: "5K", raceDate: "2026-09-01" });

    expect(result.error).toMatch(/not authorized/i);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects a coach with no active coaching relationship to this athlete", async () => {
    vi.mocked(getAppSession).mockResolvedValue(COACH_SESSION);
    const { client, callLog } = createScriptedSupabaseClient([{ table: "coach_athletes", result: { data: null, error: null } }], "coach-1");
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await sendPostSeasonReview({ athleteId: "athlete-1", raceName: "5K", raceDate: "2026-09-01" });

    expect(result.error).toMatch(/don't coach this athlete/i);
    expect(callLog.map((c) => c.table)).toEqual(["coach_athletes"]);
  });
});
