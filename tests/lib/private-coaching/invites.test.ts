import { describe, expect, it } from "vitest";

import { emailsMatch, isInviteExpired } from "@/lib/private-coaching/invites";

describe("isInviteExpired", () => {
  it("returns false for an invite expiring in the future", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(isInviteExpired("2026-01-15T00:00:00Z", now)).toBe(false);
  });

  it("returns true for an invite that already expired", () => {
    const now = new Date("2026-01-20T00:00:00Z");
    expect(isInviteExpired("2026-01-15T00:00:00Z", now)).toBe(true);
  });

  it("treats the exact expiry instant as expired (inclusive boundary)", () => {
    const now = new Date("2026-01-15T00:00:00Z");
    expect(isInviteExpired("2026-01-15T00:00:00Z", now)).toBe(true);
  });
});

describe("emailsMatch", () => {
  it("matches identical emails", () => {
    expect(emailsMatch("runner@example.com", "runner@example.com")).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(emailsMatch("Runner@Example.com", "runner@example.com")).toBe(true);
  });

  it("tolerates surrounding whitespace", () => {
    expect(emailsMatch("  runner@example.com  ", "runner@example.com")).toBe(true);
  });

  it("rejects a different email", () => {
    expect(emailsMatch("runner@example.com", "coach@example.com")).toBe(false);
  });
});
