import { describe, expect, it } from "vitest";

import { submitContentSuggestionSchema } from "@/lib/validation/content-suggestions";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    sectionSlug: "nutrition-and-fueling",
    suggestion: "Add a section explaining performance fueling vs. general health eating.",
    reason: "Current wording may unintentionally oversimplify processed foods.",
    ...overrides,
  };
}

describe("submitContentSuggestionSchema", () => {
  it("accepts a valid suggestion", () => {
    expect(submitContentSuggestionSchema.safeParse(baseInput()).success).toBe(true);
  });

  it("accepts a submission with no reason", () => {
    const result = submitContentSuggestionSchema.safeParse(baseInput({ reason: "" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.reason).toBeUndefined();
  });

  it("rejects a section slug that isn't a real Foundations page", () => {
    expect(submitContentSuggestionSchema.safeParse(baseInput({ sectionSlug: "not-a-real-slug" })).success).toBe(
      false,
    );
  });

  it("rejects an Articles-category slug (Articles has its own contributor workflow)", () => {
    expect(submitContentSuggestionSchema.safeParse(baseInput({ sectionSlug: "articles" })).success).toBe(false);
  });

  it("rejects a suggestion under 10 characters", () => {
    expect(submitContentSuggestionSchema.safeParse(baseInput({ suggestion: "too short" })).success).toBe(false);
  });
});
