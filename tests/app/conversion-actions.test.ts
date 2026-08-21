import { afterEach, describe, expect, it, vi } from "vitest";

import { createScriptedSupabaseClient } from "./supabase-test-utils";

// Same mocking shape as learning-actions.test.ts / knowledge-check-
// actions.test.ts: createClient() (next/headers-backed) needs a mock to
// run under Vitest's node environment. getOrCreateAnonId() is next/headers
// -backed too (reads/sets a cookie), so it needs the same treatment.
vi.mock("@/lib/db/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/anon-id", () => ({ getOrCreateAnonId: vi.fn() }));

import { createClient } from "@/lib/db/server";
import { getOrCreateAnonId } from "@/lib/anon-id";
import { recordConversionEvent } from "@/app/conversion-actions";

afterEach(() => {
  vi.clearAllMocks();
});

describe("recordConversionEvent", () => {
  it("inserts a conversion event with the anon id, event type, feature, and metadata as given", async () => {
    vi.mocked(getOrCreateAnonId).mockResolvedValue("anon-123");
    const { client, callLog } = createScriptedSupabaseClient(
      [{ table: "conversion_events", result: { data: null, error: null } }],
      null,
    );
    vi.mocked(createClient).mockResolvedValue(client as never);

    await recordConversionEvent("cta_shown", "bookmark", { surface: "bookmark_button" });

    expect(callLog).toHaveLength(1);
    expect(callLog[0].table).toBe("conversion_events");
    const insertCall = callLog[0].calls.find((c) => c.method === "insert");
    expect(insertCall?.args[0]).toMatchObject({
      anon_id: "anon-123",
      user_id: null,
      event_type: "cta_shown",
      feature: "bookmark",
      metadata: { surface: "bookmark_button" },
    });
  });

  it("attributes the event to the authenticated user's own id when a session exists", async () => {
    vi.mocked(getOrCreateAnonId).mockResolvedValue("anon-456");
    const { client, callLog } = createScriptedSupabaseClient(
      [{ table: "conversion_events", result: { data: null, error: null } }],
      "user-1",
    );
    vi.mocked(createClient).mockResolvedValue(client as never);

    await recordConversionEvent("first_learning_action", "learning_progress", { surface: "knowledge_check_submit" });

    const insertCall = callLog[0].calls.find((c) => c.method === "insert");
    expect(insertCall?.args[0]).toMatchObject({ anon_id: "anon-456", user_id: "user-1" });
  });

  it("passes each event type/feature/metadata combination through faithfully", async () => {
    const cases: Array<[Parameters<typeof recordConversionEvent>[0], Parameters<typeof recordConversionEvent>[1], Record<string, unknown>]> = [
      ["cta_clicked", "bookmark", { surface: "bookmark_button" }],
      ["cta_clicked", "notes", { surface: "notes_trigger" }],
      ["google_signup_clicked", "learning_progress", { page: "/login" }],
      ["account_created", "learning_progress", { method: "email" }],
    ];

    for (const [eventType, feature, metadata] of cases) {
      vi.mocked(getOrCreateAnonId).mockResolvedValue("anon-789");
      const { client, callLog } = createScriptedSupabaseClient(
        [{ table: "conversion_events", result: { data: null, error: null } }],
        null,
      );
      vi.mocked(createClient).mockResolvedValue(client as never);

      await recordConversionEvent(eventType, feature, metadata);

      const insertCall = callLog[0].calls.find((c) => c.method === "insert");
      expect(insertCall?.args[0]).toMatchObject({ event_type: eventType, feature, metadata });
    }
  });

  it("REGRESSION: a Supabase insert error must not throw or propagate -- analytics must fail open", async () => {
    vi.mocked(getOrCreateAnonId).mockResolvedValue("anon-fail");
    const { client } = createScriptedSupabaseClient(
      [{ table: "conversion_events", result: { data: null, error: { message: "connection reset", code: "57P01" } } }],
      null,
    );
    vi.mocked(createClient).mockResolvedValue(client as never);

    // The underlying insert "fails" (the scripted client resolves with a
    // Supabase-shaped error, matching how the real client behaves), but
    // recordConversionEvent's own contract is that this is never visible
    // to the caller -- a rejected/thrown promise here would mean a
    // tracking failure could interrupt whatever real feature called it.
    await expect(recordConversionEvent("cta_shown", "bookmark", {})).resolves.toBeUndefined();
  });

  it("REGRESSION: a thrown error anywhere in the write path (e.g. cookies() unavailable) must not propagate", async () => {
    vi.mocked(getOrCreateAnonId).mockRejectedValue(new Error("cookies() called outside request scope"));

    await expect(recordConversionEvent("cta_shown", "bookmark", {})).resolves.toBeUndefined();
  });
});
