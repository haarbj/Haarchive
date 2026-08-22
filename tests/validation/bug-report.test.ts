import { describe, expect, it } from "vitest";

import { submitBugReportSchema } from "@/lib/validation/bug-report";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    description: "The pace calculator shows NaN when I enter a marathon time under 3 hours.",
    pageUrl: "https://brodyhaar.com/pace-calculator",
    viewportWidth: 1440,
    viewportHeight: 900,
    devicePixelRatio: 2,
    userAgent: "Mozilla/5.0 (Macintosh)",
    ...overrides,
  };
}

describe("submitBugReportSchema", () => {
  it("accepts a valid submission with full metadata", () => {
    const result = submitBugReportSchema.safeParse(baseInput());
    expect(result.success).toBe(true);
  });

  it("accepts a submission with only the required fields (no optional metadata)", () => {
    const result = submitBugReportSchema.safeParse({
      description: "Something broke on the settings page and I can't tell what.",
      pageUrl: "https://brodyhaar.com/settings",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a description that's too short (avoids one-character spam)", () => {
    const result = submitBugReportSchema.safeParse(baseInput({ description: "bad" }));
    expect(result.success).toBe(false);
  });

  it("rejects an empty description", () => {
    const result = submitBugReportSchema.safeParse(baseInput({ description: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects a description over 2000 characters", () => {
    const result = submitBugReportSchema.safeParse(baseInput({ description: "a".repeat(2001) }));
    expect(result.success).toBe(false);
  });

  it("trims whitespace before checking length -- whitespace-only input is rejected", () => {
    const result = submitBugReportSchema.safeParse(baseInput({ description: "   \n\t   " }));
    expect(result.success).toBe(false);
  });

  it("accepts a description that's exactly at the minimum length after trimming", () => {
    const result = submitBugReportSchema.safeParse(baseInput({ description: "  0123456789  " }));
    expect(result.success).toBe(true);
  });

  it("rejects a missing page URL", () => {
    const result = submitBugReportSchema.safeParse(baseInput({ pageUrl: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects an implausibly large viewport dimension", () => {
    const result = submitBugReportSchema.safeParse(baseInput({ viewportWidth: 999999 }));
    expect(result.success).toBe(false);
  });

  it("rejects submissions where the honeypot field is filled", () => {
    const result = submitBugReportSchema.safeParse(baseInput({ website: "http://spam.example" }));
    expect(result.success).toBe(false);
  });

  it("accepts submissions where the honeypot field is empty", () => {
    const result = submitBugReportSchema.safeParse(baseInput({ website: "" }));
    expect(result.success).toBe(true);
  });
});
