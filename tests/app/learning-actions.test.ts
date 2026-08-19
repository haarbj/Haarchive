import { afterEach, describe, expect, it, vi } from "vitest";

import { computeMastery } from "@/lib/mastery/algorithm";
import { createScriptedSupabaseClient } from "./supabase-test-utils";

// logLearningEvent() calls createClient() (next/headers-backed) and
// revalidatePath() (next/cache) internally -- both need mocking to run
// this file under Vitest's node environment. recomputeTopicMastery()
// takes its Supabase client as a parameter, so it needs neither mock and
// is tested by passing a scripted client directly.
vi.mock("@/lib/db/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createClient } from "@/lib/db/server";
import { revalidatePath } from "next/cache";
import { logLearningEvent, recomputeTopicMastery } from "@/app/learning-actions";

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("recomputeTopicMastery", () => {
  it("recomputes mastery from the fetched events and writes it under the given user/topic", async () => {
    const rawEvents = [
      { event_type: "content_viewed", concept_id: null, created_at: "2026-01-01T00:00:00Z", metadata: null },
      { event_type: "content_engaged", concept_id: null, created_at: "2026-01-01T00:00:00Z", metadata: null },
      { event_type: "note_taken", concept_id: null, created_at: "2026-01-02T00:00:00Z", metadata: null },
    ];
    const { client, callLog } = createScriptedSupabaseClient(
      [
        { table: "learning_events", result: { data: rawEvents, error: null } },
        { table: "user_topic_mastery", result: { data: null, error: null } },
      ],
      "user-1",
    );

    const result = await recomputeTopicMastery(client as never, "user-1", "topic-1");

    // computeMastery() actually received the retrieved events, mapped
    // faithfully -- not re-derived some other way.
    const expected = computeMastery(
      rawEvents.map((e) => ({
        eventType: e.event_type,
        conceptId: e.concept_id,
        createdAt: e.created_at,
        metadata: e.metadata,
      })),
    );
    expect(result).toEqual(expected);

    // The read used the correct user/topic.
    expect(callLog[0].table).toBe("learning_events");
    expect(callLog[0].calls).toContainEqual({ method: "eq", args: ["user_id", "user-1"] });
    expect(callLog[0].calls).toContainEqual({ method: "eq", args: ["topic_id", "topic-1"] });

    // The write persisted exactly the computed result under the same ids.
    expect(callLog[1].table).toBe("user_topic_mastery");
    const upsertCall = callLog[1].calls.find((c) => c.method === "upsert");
    expect(upsertCall?.args[0]).toMatchObject({
      user_id: "user-1",
      topic_id: "topic-1",
      score: result.score,
      level: result.level,
    });
  });

  it("REGRESSION: a failed learning_events read must not be treated as an empty event set", async () => {
    // Two steps configured: if the bug were reintroduced (discarding the
    // select's error and falling through to computeMastery([])), execution
    // would reach and consume this second step, and the call below would
    // resolve instead of reject -- failing this test against the bug.
    const { client, callLog } = createScriptedSupabaseClient(
      [
        {
          table: "learning_events",
          result: { data: null, error: { message: "connection reset", code: "57P01" } },
        },
        { table: "user_topic_mastery", result: { data: null, error: null } },
      ],
      "user-1",
    );

    await expect(recomputeTopicMastery(client as never, "user-1", "topic-1")).rejects.toThrow(/connection reset/);

    // The cache write must never have been reached.
    expect(callLog).toHaveLength(1);
  });

  it("REGRESSION: a failed mastery-cache write must not be silently swallowed", async () => {
    const rawEvents = [{ event_type: "content_viewed", concept_id: null, created_at: "2026-01-01T00:00:00Z", metadata: null }];
    const { client, callLog } = createScriptedSupabaseClient(
      [
        { table: "learning_events", result: { data: rawEvents, error: null } },
        { table: "user_topic_mastery", result: { data: null, error: { message: "upsert failed", code: "40001" } } },
      ],
      "user-1",
    );

    await expect(recomputeTopicMastery(client as never, "user-1", "topic-1")).rejects.toThrow(/upsert failed/);

    // The read did happen -- only the write failed, and that failure must
    // still surface rather than returning a result as if it had persisted.
    expect(callLog).toHaveLength(2);
  });
});

describe("logLearningEvent", () => {
  it("resolves the topic, inserts the event, and recomputes mastery for the same user/topic", async () => {
    const { client, callLog } = createScriptedSupabaseClient(
      [
        { table: "topics", result: { data: { id: "topic-1" }, error: null } },
        { table: "learning_events", result: { data: null, error: null } }, // insert
        { table: "learning_events", result: { data: [], error: null } }, // recompute select
        { table: "user_topic_mastery", result: { data: null, error: null } }, // recompute upsert
      ],
      "user-1",
    );
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await logLearningEvent("the-aerobic-base", "content_viewed");

    expect(result).toBeUndefined();
    expect(callLog).toHaveLength(4);

    const insertCall = callLog[1].calls.find((c) => c.method === "insert");
    expect(insertCall?.args[0]).toMatchObject({
      user_id: "user-1",
      event_type: "content_viewed",
      topic_id: "topic-1",
      content_slug: "the-aerobic-base",
    });

    expect(callLog[2].table).toBe("learning_events");
    expect(callLog[2].calls).toContainEqual({ method: "eq", args: ["topic_id", "topic-1"] });
    expect(callLog[3].table).toBe("user_topic_mastery");

    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("no-ops without writing anything for an unauthenticated visitor", async () => {
    const { client, callLog } = createScriptedSupabaseClient([], null);
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await logLearningEvent("the-aerobic-base", "content_viewed");

    expect(result).toBeUndefined();
    expect(callLog).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("treats a 23505 unique-violation on a once-per-day event as a harmless duplicate, not an error", async () => {
    const { client, callLog } = createScriptedSupabaseClient(
      [
        { table: "topics", result: { data: { id: "topic-1" }, error: null } },
        {
          table: "learning_events",
          result: { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } },
        },
        { table: "learning_events", result: { data: [], error: null } }, // recompute still runs
        { table: "user_topic_mastery", result: { data: null, error: null } },
      ],
      "user-1",
    );
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await logLearningEvent("the-aerobic-base", "content_engaged");

    // No error surfaced to the caller for a duplicate signal...
    expect(result).toBeUndefined();
    // ...and mastery recomputation still ran rather than short-circuiting.
    expect(callLog).toHaveLength(4);
    expect(callLog[3].table).toBe("user_topic_mastery");
  });

  it("surfaces a genuine (non-duplicate) insert error to the caller", async () => {
    const { client, callLog } = createScriptedSupabaseClient(
      [
        { table: "topics", result: { data: { id: "topic-1" }, error: null } },
        { table: "learning_events", result: { data: null, error: { code: "23514", message: "check constraint violated" } } },
      ],
      "user-1",
    );
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await logLearningEvent("the-aerobic-base", "content_engaged");

    expect(result).toEqual({ error: "check constraint violated" });
    // Mastery must not be recomputed off the back of a real failed write.
    expect(callLog).toHaveLength(2);
  });

  describe("topic_revisited duplicate handling", () => {
    it("logs topic_revisited when a content_viewed duplicate's first view was on an earlier calendar day", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-05T12:00:00Z"));

      const { client, callLog } = createScriptedSupabaseClient(
        [
          { table: "topics", result: { data: { id: "topic-1" }, error: null } },
          { table: "learning_events", result: { data: null, error: { code: "23505", message: "duplicate" } } }, // content_viewed insert
          { table: "learning_events", result: { data: { created_at: "2026-01-01T00:00:00Z" }, error: null } }, // firstView lookup, earlier day
          { table: "learning_events", result: { data: null, error: null } }, // topic_revisited insert
          { table: "learning_events", result: { data: [], error: null } }, // recompute select
          { table: "user_topic_mastery", result: { data: null, error: null } }, // recompute upsert
        ],
        "user-1",
      );
      vi.mocked(createClient).mockResolvedValue(client as never);

      await logLearningEvent("the-aerobic-base", "content_viewed");

      expect(callLog).toHaveLength(6);
      const revisitInsert = callLog[3].calls.find((c) => c.method === "insert");
      expect(revisitInsert?.args[0]).toMatchObject({
        user_id: "user-1",
        event_type: "topic_revisited",
        topic_id: "topic-1",
        content_slug: "the-aerobic-base",
      });
    });

    it("does NOT log topic_revisited when the first view was earlier the same day (once-per-day boundary)", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-05T12:00:00Z"));

      const { client, callLog } = createScriptedSupabaseClient(
        [
          { table: "topics", result: { data: { id: "topic-1" }, error: null } },
          { table: "learning_events", result: { data: null, error: { code: "23505", message: "duplicate" } } },
          { table: "learning_events", result: { data: { created_at: "2026-01-05T01:00:00Z" }, error: null } }, // same day
          { table: "learning_events", result: { data: [], error: null } }, // recompute select -- no revisit insert step
          { table: "user_topic_mastery", result: { data: null, error: null } },
        ],
        "user-1",
      );
      vi.mocked(createClient).mockResolvedValue(client as never);

      await logLearningEvent("the-aerobic-base", "content_viewed");

      // Only 5 steps consumed -- confirms no topic_revisited insert happened
      // (a 6th, unscripted .from() call would have thrown).
      expect(callLog).toHaveLength(5);
    });
  });
});
