import { describe, expect, it } from "vitest";

import { articleDraftSchema, citationSchema } from "@/lib/validation/articles";

function baseDraftInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Whole Food Most of the Time, Fast Fuel When It Matters",
    subtitle: "",
    articleType: "article",
    evidenceCategory: "",
    tagsInput: "fueling, marathon",
    coverImageUrl: "",
    contentJson: "[]",
    ...overrides,
  };
}

describe("articleDraftSchema", () => {
  it("accepts a minimal valid draft", () => {
    const result = articleDraftSchema.safeParse(baseDraftInput());
    expect(result.success).toBe(true);
  });

  it("rejects a title under 8 characters", () => {
    const result = articleDraftSchema.safeParse(baseDraftInput({ title: "Hi" }));
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized article type", () => {
    const result = articleDraftSchema.safeParse(baseDraftInput({ articleType: "blog_post" }));
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized evidence category", () => {
    const result = articleDraftSchema.safeParse(baseDraftInput({ evidenceCategory: "vibes" }));
    expect(result.success).toBe(false);
  });

  it("accepts a blank evidence category (none selected)", () => {
    const result = articleDraftSchema.safeParse(baseDraftInput({ evidenceCategory: "" }));
    expect(result.success).toBe(true);
  });

  it("lowercases, dedupes, and caps tags at 8", () => {
    const many = Array.from({ length: 12 }, (_, i) => `Tag${i}`).join(", ");
    const result = articleDraftSchema.safeParse(baseDraftInput({ tagsInput: many }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tagsInput).toHaveLength(8);
  });

  it("rejects invalid JSON in contentJson", () => {
    const result = articleDraftSchema.safeParse(baseDraftInput({ contentJson: "{not json" }));
    expect(result.success).toBe(false);
  });

  it("rejects contentJson that parses but fails block validation", () => {
    const result = articleDraftSchema.safeParse(
      baseDraftInput({ contentJson: JSON.stringify([{ type: "heading", text: "" }]) }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts valid contentJson blocks", () => {
    const result = articleDraftSchema.safeParse(
      baseDraftInput({ contentJson: JSON.stringify([{ type: "paragraph", text: "Hello" }]) }),
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.contentJson).toHaveLength(1);
  });

  it("rejects a non-http(s) cover image URL", () => {
    const result = articleDraftSchema.safeParse(baseDraftInput({ coverImageUrl: "ftp://example.com/x.jpg" }));
    expect(result.success).toBe(false);
  });
});

describe("citationSchema", () => {
  it("accepts a minimal citation with only a title", () => {
    const result = citationSchema.safeParse({ paperTitle: "Some Paper" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty paper title", () => {
    const result = citationSchema.safeParse({ paperTitle: "" });
    expect(result.success).toBe(false);
  });

  it("coerces a string year to a number", () => {
    const result = citationSchema.safeParse({ paperTitle: "X", year: "2020" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.year).toBe(2020);
  });

  it("rejects an out-of-range year", () => {
    const result = citationSchema.safeParse({ paperTitle: "X", year: "1500" });
    expect(result.success).toBe(false);
  });

  it("allows year to be omitted", () => {
    const result = citationSchema.safeParse({ paperTitle: "X" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.year).toBeUndefined();
  });

  it("accepts topic and claimSupported, blank or filled", () => {
    const filled = citationSchema.safeParse({ paperTitle: "X", topic: "RED-S", claimSupported: "Energy availability" });
    expect(filled.success).toBe(true);
    if (filled.success) {
      expect(filled.data.topic).toBe("RED-S");
      expect(filled.data.claimSupported).toBe("Energy availability");
    }

    const blank = citationSchema.safeParse({ paperTitle: "X", topic: "", claimSupported: "" });
    expect(blank.success).toBe(true);
    if (blank.success) {
      expect(blank.data.topic).toBeUndefined();
      expect(blank.data.claimSupported).toBeUndefined();
    }
  });
});
