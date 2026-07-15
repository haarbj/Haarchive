import { describe, expect, it } from "vitest";

import { updateContributorProfileSchema } from "@/lib/validation/contributor-profile";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Elite Distance Runner",
    bio: "Marathoner and coach.",
    expertiseInput: "Marathon Training, Fueling, Recovery",
    avatarUrl: "",
    ...overrides,
  };
}

describe("updateContributorProfileSchema", () => {
  it("accepts a minimal valid submission with everything blank", () => {
    const result = updateContributorProfileSchema.safeParse(
      baseInput({ title: "", bio: "", expertiseInput: "", avatarUrl: "" }),
    );
    expect(result.success).toBe(true);
  });

  it("parses comma-separated expertise, preserving case", () => {
    const result = updateContributorProfileSchema.safeParse(baseInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expertiseInput).toEqual(["Marathon Training", "Fueling", "Recovery"]);
    }
  });

  it("dedupes expertise case-insensitively", () => {
    const result = updateContributorProfileSchema.safeParse(
      baseInput({ expertiseInput: "Fueling, fueling, FUELING" }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expertiseInput).toEqual(["Fueling"]);
    }
  });

  it("caps expertise at 12 items", () => {
    const many = Array.from({ length: 20 }, (_, i) => `Topic ${i}`).join(", ");
    const result = updateContributorProfileSchema.safeParse(baseInput({ expertiseInput: many }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expertiseInput).toHaveLength(12);
    }
  });

  it("rejects a title over 80 characters", () => {
    const result = updateContributorProfileSchema.safeParse(baseInput({ title: "a".repeat(81) }));
    expect(result.success).toBe(false);
  });

  it("rejects a bio over 1000 characters", () => {
    const result = updateContributorProfileSchema.safeParse(baseInput({ bio: "a".repeat(1001) }));
    expect(result.success).toBe(false);
  });

  it("accepts an empty avatarUrl (clearing the avatar)", () => {
    const result = updateContributorProfileSchema.safeParse(baseInput({ avatarUrl: "" }));
    expect(result.success).toBe(true);
  });

  it("accepts a valid http(s) avatarUrl", () => {
    const result = updateContributorProfileSchema.safeParse(baseInput({ avatarUrl: "https://example.com/me.jpg" }));
    expect(result.success).toBe(true);
  });

  it("rejects a non-http(s) avatarUrl", () => {
    const result = updateContributorProfileSchema.safeParse(baseInput({ avatarUrl: "javascript:alert(1)" }));
    expect(result.success).toBe(false);
  });
});
