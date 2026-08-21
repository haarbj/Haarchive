import { afterEach, describe, expect, it, vi } from "vitest";

import { createScriptedSupabaseClient } from "./supabase-test-utils";

vi.mock("@/lib/db/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db/service-role", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createClient } from "@/lib/db/server";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { revalidatePath } from "next/cache";
import { getKnowledgeCheckForTopic, submitKnowledgeCheckAnswer } from "@/app/knowledge-check-actions";

afterEach(() => {
  vi.clearAllMocks();
});

const QUESTION_ROW = {
  id: "q1",
  topic_id: "topic-1",
  concept_id: null,
  question: "What is the aerobic base?",
  options: [
    { id: "a", text: "The foundation of oxygen-delivery fitness" },
    { id: "b", text: "A type of shoe" },
  ],
  difficulty: "standard",
};

describe("getKnowledgeCheckForTopic", () => {
  it("returns a question that never exposes the answer key or explanation", async () => {
    const { client: serviceClient, callLog: serviceCallLog } = createScriptedSupabaseClient(
      [
        { table: "topics", result: { data: { id: "topic-1" }, error: null } },
        { table: "knowledge_checks", result: { data: [QUESTION_ROW], error: null } },
      ],
      null,
    );
    const { client: rlsClient } = createScriptedSupabaseClient(
      [
        { table: "learning_events", result: { data: [], error: null } },
        { table: "user_topic_mastery", result: { data: { level: "familiar" }, error: null } },
      ],
      "user-1",
    );
    vi.mocked(createServiceRoleClient).mockReturnValue(serviceClient as never);
    vi.mocked(createClient).mockResolvedValue(rlsClient as never);

    const result = await getKnowledgeCheckForTopic("the-aerobic-base");

    expect(result).not.toBeNull();
    expect(result!.question).toBe(QUESTION_ROW.question);
    expect(result!.currentLevel).toBe("familiar");

    // The public shape must never carry the answer key or explanation --
    // check both the returned object and the actual DB select column list,
    // since the real safety mechanism is the select statement itself.
    expect(result).not.toHaveProperty("correctOptionId");
    expect(result).not.toHaveProperty("explanation");
    expect(JSON.stringify(result)).not.toMatch(/correct_option_id|explanation/i);

    const kcSelect = serviceCallLog[1].calls.find((c) => c.method === "select");
    expect(kcSelect?.args[0]).not.toMatch(/correct_option_id|explanation/);
  });

  it("returns a question with no per-user state for an unauthenticated visitor, without touching user-scoped tables", async () => {
    const { client: serviceClient } = createScriptedSupabaseClient(
      [
        { table: "topics", result: { data: { id: "topic-1" }, error: null } },
        { table: "knowledge_checks", result: { data: [QUESTION_ROW], error: null } },
      ],
      null,
    );
    const { client: rlsClient, callLog: rlsCallLog } = createScriptedSupabaseClient([], null);
    vi.mocked(createServiceRoleClient).mockReturnValue(serviceClient as never);
    vi.mocked(createClient).mockResolvedValue(rlsClient as never);

    const result = await getKnowledgeCheckForTopic("the-aerobic-base");

    expect(result?.currentLevel).toBeNull();
    // learning_events/user_topic_mastery are gated behind `if (userId)` --
    // an anonymous visitor must never trigger either query.
    expect(rlsCallLog).toHaveLength(0);
  });

  it("reports questionNumber 1 of 1 for a topic with a single question", async () => {
    const { client: serviceClient } = createScriptedSupabaseClient(
      [
        { table: "topics", result: { data: { id: "topic-1" }, error: null } },
        { table: "knowledge_checks", result: { data: [QUESTION_ROW], error: null } },
      ],
      null,
    );
    vi.mocked(createServiceRoleClient).mockReturnValue(serviceClient as never);
    vi.mocked(createClient).mockResolvedValue(createScriptedSupabaseClient([], null).client as never);

    const result = await getKnowledgeCheckForTopic("the-aerobic-base");

    expect(result).toMatchObject({ questionNumber: 1, totalQuestions: 1 });
  });

  it("reports allQuestionsCompleted: false for an anonymous visitor regardless of the question set", async () => {
    const { client: serviceClient } = createScriptedSupabaseClient(
      [
        { table: "topics", result: { data: { id: "topic-1" }, error: null } },
        { table: "knowledge_checks", result: { data: [QUESTION_ROW], error: null } },
      ],
      null,
    );
    vi.mocked(createServiceRoleClient).mockReturnValue(serviceClient as never);
    vi.mocked(createClient).mockResolvedValue(createScriptedSupabaseClient([], null).client as never);

    const result = await getKnowledgeCheckForTopic("the-aerobic-base");

    expect(result).toMatchObject({ allQuestionsCompleted: false });
  });

  it("REGRESSION: reports allQuestionsCompleted: true, not a silent restart, once every question has been answered correctly", async () => {
    const q2 = { ...QUESTION_ROW, id: "q2", question: "What is threshold?" };
    const { client: serviceClient } = createScriptedSupabaseClient(
      [
        { table: "topics", result: { data: { id: "topic-1" }, error: null } },
        { table: "knowledge_checks", result: { data: [QUESTION_ROW, q2], error: null } },
      ],
      null,
    );
    const { client: rlsClient } = createScriptedSupabaseClient(
      [
        {
          table: "learning_events",
          result: {
            data: [
              { metadata: { questionId: "q1", correct: true } },
              { metadata: { questionId: "q2", correct: true } },
            ],
            error: null,
          },
        },
        { table: "user_topic_mastery", result: { data: { level: "proficient" }, error: null } },
      ],
      "user-1",
    );
    vi.mocked(createServiceRoleClient).mockReturnValue(serviceClient as never);
    vi.mocked(createClient).mockResolvedValue(rlsClient as never);

    const result = await getKnowledgeCheckForTopic("the-aerobic-base");

    // Falls back to the first question (existing, unchanged behavior) --
    // but this flag is what lets the UI distinguish that fallback from a
    // genuine next question, instead of silently restarting the sequence.
    expect(result).toMatchObject({ id: "q1", allQuestionsCompleted: true });
  });

  it("reports the real position and total for a multi-question topic, for both an anonymous and an authenticated visitor", async () => {
    const q2 = { ...QUESTION_ROW, id: "q2", question: "What is threshold?" };
    const q3 = { ...QUESTION_ROW, id: "q3", question: "What is VO2max?" };
    const allQuestions = [QUESTION_ROW, q2, q3];

    // Anonymous: always the first question in order, so 1/3.
    const { client: anonServiceClient } = createScriptedSupabaseClient(
      [
        { table: "topics", result: { data: { id: "topic-1" }, error: null } },
        { table: "knowledge_checks", result: { data: allQuestions, error: null } },
      ],
      null,
    );
    vi.mocked(createServiceRoleClient).mockReturnValue(anonServiceClient as never);
    vi.mocked(createClient).mockResolvedValue(createScriptedSupabaseClient([], null).client as never);
    const anonResult = await getKnowledgeCheckForTopic("the-aerobic-base");
    expect(anonResult).toMatchObject({ id: "q1", questionNumber: 1, totalQuestions: 3 });

    vi.clearAllMocks();

    // Authenticated, already answered q1 correctly: the second question is
    // returned, and questionNumber must reflect ITS real position (2), not
    // always default to 1.
    const { client: authServiceClient } = createScriptedSupabaseClient(
      [
        { table: "topics", result: { data: { id: "topic-1" }, error: null } },
        { table: "knowledge_checks", result: { data: allQuestions, error: null } },
      ],
      null,
    );
    const { client: rlsClient } = createScriptedSupabaseClient(
      [
        {
          table: "learning_events",
          result: { data: [{ metadata: { questionId: "q1", correct: true } }], error: null },
        },
        { table: "user_topic_mastery", result: { data: { level: "familiar" }, error: null } },
      ],
      "user-1",
    );
    vi.mocked(createServiceRoleClient).mockReturnValue(authServiceClient as never);
    vi.mocked(createClient).mockResolvedValue(rlsClient as never);
    const authResult = await getKnowledgeCheckForTopic("the-aerobic-base");
    expect(authResult).toMatchObject({ id: "q2", questionNumber: 2, totalQuestions: 3 });
  });

  it("resolves the correct topic slug", async () => {
    const { client: serviceClient, callLog: serviceCallLog } = createScriptedSupabaseClient(
      [
        { table: "topics", result: { data: { id: "topic-1" }, error: null } },
        { table: "knowledge_checks", result: { data: [QUESTION_ROW], error: null } },
      ],
      null,
    );
    vi.mocked(createServiceRoleClient).mockReturnValue(serviceClient as never);
    vi.mocked(createClient).mockResolvedValue(createScriptedSupabaseClient([], null).client as never);

    await getKnowledgeCheckForTopic("the-aerobic-base");

    expect(serviceCallLog[0].calls).toContainEqual({ method: "eq", args: ["section_slug", "the-aerobic-base"] });
    expect(serviceCallLog[1].calls).toContainEqual({ method: "eq", args: ["topic_id", "topic-1"] });
  });
});

describe("submitKnowledgeCheckAnswer", () => {
  function scriptSubmit(opts: { priorAttempts: unknown[]; correctOptionId?: string }) {
    const { client: serviceClient } = createScriptedSupabaseClient(
      [
        {
          table: "knowledge_checks",
          result: {
            data: { ...QUESTION_ROW, correct_option_id: opts.correctOptionId ?? "a", explanation: "Because aerobic metabolism dominates most training." },
            error: null,
          },
        },
      ],
      null,
    );
    const { client: rlsClient, callLog: rlsCallLog } = createScriptedSupabaseClient(
      [
        { table: "learning_events", result: { data: opts.priorAttempts, error: null } }, // countPriorAttempts
        { table: "learning_events", result: { data: null, error: null } }, // insert
        { table: "learning_events", result: { data: [], error: null } }, // recompute select
        { table: "user_topic_mastery", result: { data: null, error: null } }, // recompute upsert
      ],
      "user-1",
    );
    vi.mocked(createServiceRoleClient).mockReturnValue(serviceClient as never);
    vi.mocked(createClient).mockResolvedValue(rlsClient as never);
    return { rlsCallLog };
  }

  it("grades a correct answer server-side, logs the event, and recomputes mastery", async () => {
    const { rlsCallLog } = scriptSubmit({ priorAttempts: [] });

    const result = await submitKnowledgeCheckAnswer("q1", "a");

    expect(result).toMatchObject({ correct: true, correctOptionId: "a", explanation: expect.any(String) });
    expect("newLevel" in result && result.newLevel).toBeDefined();

    const insertCall = rlsCallLog[1].calls.find((c) => c.method === "insert");
    expect(insertCall?.args[0]).toMatchObject({
      user_id: "user-1",
      event_type: "knowledge_check_answered",
      topic_id: "topic-1",
      metadata: { questionId: "q1", selectedOptionId: "a", correct: true, attemptNumber: 1 },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("grades an intentionally incorrect answer as correct: false, still determined server-side", async () => {
    const { rlsCallLog } = scriptSubmit({ priorAttempts: [] });

    // "a" is the real correct_option_id (see scriptSubmit); submitting "b"
    // must be graded false purely from the server-fetched question row --
    // the function accepts no client-supplied correctness value at all.
    const result = await submitKnowledgeCheckAnswer("q1", "b");

    expect(result).toMatchObject({ correct: false, correctOptionId: "a" });
    const insertCall = rlsCallLog[1].calls.find((c) => c.method === "insert");
    expect(insertCall?.args[0]).toMatchObject({ metadata: { correct: false } });
  });

  describe("attempt counting", () => {
    it("assigns attemptNumber 1 on a genuine first attempt", async () => {
      const { rlsCallLog } = scriptSubmit({ priorAttempts: [] });
      await submitKnowledgeCheckAnswer("q1", "a");
      const insertCall = rlsCallLog[1].calls.find((c) => c.method === "insert");
      expect((insertCall?.args[0] as { metadata: { attemptNumber: number } }).metadata.attemptNumber).toBe(1);
    });

    it("assigns attemptNumber 2 when one prior answer to this exact question already exists", async () => {
      const { rlsCallLog } = scriptSubmit({ priorAttempts: [{ id: "prior-event-1" }] });
      await submitKnowledgeCheckAnswer("q1", "a");
      const insertCall = rlsCallLog[1].calls.find((c) => c.method === "insert");
      expect((insertCall?.args[0] as { metadata: { attemptNumber: number } }).metadata.attemptNumber).toBe(2);

      // Prior-attempt counting is scoped to this exact question, not the
      // topic as a whole.
      const countQuery = rlsCallLog[0].calls;
      expect(countQuery).toContainEqual({ method: "contains", args: ["metadata", { questionId: "q1" }] });
    });
  });

  it("allows a replayed/duplicate submission for the same question to reach the DB -- no orchestration-level block, matching the file's own documented intent (distinct-question dedup lives in computeMastery, not here)", async () => {
    const { rlsCallLog } = scriptSubmit({ priorAttempts: [{ id: "prior-event-1" }] });

    const result = await submitKnowledgeCheckAnswer("q1", "a");

    expect("correct" in result).toBe(true);
    // The event insert for the replay actually happened -- not skipped.
    expect(rlsCallLog[1].calls.some((c) => c.method === "insert")).toBe(true);
  });

  it("rejects an unauthenticated submission before ever reaching the answer key", async () => {
    const { client: rlsClient } = createScriptedSupabaseClient([], null);
    vi.mocked(createClient).mockResolvedValue(rlsClient as never);

    const result = await submitKnowledgeCheckAnswer("q1", "a");

    expect(result).toEqual({ error: "Sign in to answer knowledge checks." });
    // The service-role client (the only place correct_option_id is ever
    // read) must never even be constructed for an unauthenticated request.
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("rejects an option id that isn't one of the question's real options", async () => {
    const { client: serviceClient } = createScriptedSupabaseClient(
      [{ table: "knowledge_checks", result: { data: { ...QUESTION_ROW, correct_option_id: "a", explanation: "Because." }, error: null } }],
      null,
    );
    const { client: rlsClient, callLog: rlsCallLog } = createScriptedSupabaseClient([], "user-1");
    vi.mocked(createServiceRoleClient).mockReturnValue(serviceClient as never);
    vi.mocked(createClient).mockResolvedValue(rlsClient as never);

    const result = await submitKnowledgeCheckAnswer("q1", "not-a-real-option-id");

    expect(result).toEqual({ error: "That's not a valid answer for this question." });
    expect(rlsCallLog).toHaveLength(0); // never logs an event or recomputes mastery for an invalid submission
  });
});
