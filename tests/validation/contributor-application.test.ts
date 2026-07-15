import { describe, expect, it } from "vitest";

import { submitContributorApplicationSchema } from "@/lib/validation/contributor-application";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Jordan Runner",
    email: "jordan@example.com",
    contributionTypes: ["article"],
    background: "Ten years coaching high school cross country and a degree in exercise physiology.",
    motivation: "I want to help other coaches avoid the mistakes I made early on.",
    ...overrides,
  };
}

describe("submitContributorApplicationSchema", () => {
  it("accepts a valid submission", () => {
    const result = submitContributorApplicationSchema.safeParse(baseInput());
    expect(result.success).toBe(true);
  });

  it("rejects when no contribution type is selected", () => {
    const result = submitContributorApplicationSchema.safeParse(baseInput({ contributionTypes: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized contribution type", () => {
    const result = submitContributorApplicationSchema.safeParse(baseInput({ contributionTypes: ["not-real"] }));
    expect(result.success).toBe(false);
  });

  it("accepts multiple contribution types", () => {
    const result = submitContributorApplicationSchema.safeParse(
      baseInput({ contributionTypes: ["article", "review"] }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a background that's too short", () => {
    const result = submitContributorApplicationSchema.safeParse(baseInput({ background: "Coach." }));
    expect(result.success).toBe(false);
  });

  it("rejects a motivation that's too short", () => {
    const result = submitContributorApplicationSchema.safeParse(baseInput({ motivation: "Because." }));
    expect(result.success).toBe(false);
  });

  it("accepts an optional topic idea", () => {
    const result = submitContributorApplicationSchema.safeParse(
      baseInput({ topicIdea: "A piece on periodization for masters runners." }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects submissions where the honeypot field is filled", () => {
    const result = submitContributorApplicationSchema.safeParse(baseInput({ website: "http://spam.example" }));
    expect(result.success).toBe(false);
  });
});
