import { describe, expect, it } from "vitest";

import { submitQuestionSchema } from "@/lib/validation/questions";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    type: "question" as const,
    title: "Why does easy running never touch fast-twitch fibers?",
    ...overrides,
  };
}

describe("submitQuestionSchema", () => {
  it("accepts a minimal valid submission", () => {
    const result = submitQuestionSchema.safeParse(baseInput());
    expect(result.success).toBe(true);
  });

  it("rejects a title that's too short", () => {
    const result = submitQuestionSchema.safeParse(baseInput({ title: "Why?" }));
    expect(result.success).toBe(false);
  });

  it("rejects a title over 160 characters", () => {
    const result = submitQuestionSchema.safeParse(baseInput({ title: "a".repeat(161) }));
    expect(result.success).toBe(false);
  });

  it("rejects submissions where the honeypot field is filled", () => {
    const result = submitQuestionSchema.safeParse(baseInput({ website: "http://spam.example" }));
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized category", () => {
    const result = submitQuestionSchema.safeParse(baseInput({ category: "not-a-real-category" }));
    expect(result.success).toBe(false);
  });

  it("accepts a real category slug", () => {
    const result = submitQuestionSchema.safeParse(baseInput({ category: "the-science" }));
    expect(result.success).toBe(true);
  });

  it("parses comma-separated tags, trimmed and deduped", () => {
    const result = submitQuestionSchema.safeParse(
      baseInput({ tagsInput: " Threshold, threshold , VO2max " }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tagsInput).toEqual(["threshold", "vo2max"]);
    }
  });

  it("caps tags at 8", () => {
    const many = Array.from({ length: 12 }, (_, i) => `tag${i}`).join(",");
    const result = submitQuestionSchema.safeParse(baseInput({ tagsInput: many }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tagsInput.length).toBe(8);
    }
  });

  it("defaults type to 'question' when omitted", () => {
    const result = submitQuestionSchema.safeParse({ title: baseInput().title });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("question");
    }
  });
});
