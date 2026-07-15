import { describe, expect, it } from "vitest";

import { submitContactMessageSchema } from "@/lib/validation/contact";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Jordan Runner",
    email: "jordan@example.com",
    message: "I'd love to talk about a training plan for my next marathon.",
    ...overrides,
  };
}

describe("submitContactMessageSchema", () => {
  it("accepts a valid submission", () => {
    const result = submitContactMessageSchema.safeParse(baseInput());
    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const result = submitContactMessageSchema.safeParse(baseInput({ name: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = submitContactMessageSchema.safeParse(baseInput({ email: "not-an-email" }));
    expect(result.success).toBe(false);
  });

  it("rejects a message that's too short", () => {
    const result = submitContactMessageSchema.safeParse(baseInput({ message: "Hi" }));
    expect(result.success).toBe(false);
  });

  it("rejects a message over 4000 characters", () => {
    const result = submitContactMessageSchema.safeParse(baseInput({ message: "a".repeat(4001) }));
    expect(result.success).toBe(false);
  });

  it("rejects submissions where the honeypot field is filled", () => {
    const result = submitContactMessageSchema.safeParse(baseInput({ website: "http://spam.example" }));
    expect(result.success).toBe(false);
  });
});
