import { describe, expect, it } from "vitest";

import { matchesUserSearch, matchesUserType, type FilterableUser } from "@/lib/admin/user-filters";

function makeUser(overrides: Partial<FilterableUser> = {}): FilterableUser {
  return {
    email: "jane@example.com",
    displayName: "Jane Doe",
    isAdmin: false,
    contentContributor: false,
    reviewer: false,
    trainingDashboardAccess: false,
    ...overrides,
  };
}

describe("matchesUserSearch", () => {
  it("matches on name, case-insensitively", () => {
    expect(matchesUserSearch(makeUser({ displayName: "Jane Doe" }), "jane")).toBe(true);
  });

  it("matches on email, case-insensitively", () => {
    expect(matchesUserSearch(makeUser({ email: "Jane@Example.com" }), "example.com")).toBe(true);
  });

  it("returns true for an empty/whitespace query", () => {
    expect(matchesUserSearch(makeUser(), "")).toBe(true);
    expect(matchesUserSearch(makeUser(), "   ")).toBe(true);
  });

  it("returns false when neither field matches", () => {
    expect(matchesUserSearch(makeUser(), "zzz")).toBe(false);
  });
});

describe("matchesUserType", () => {
  it("admin filter matches only admins", () => {
    expect(matchesUserType(makeUser({ isAdmin: true }), "admin")).toBe(true);
    expect(matchesUserType(makeUser({ isAdmin: false }), "admin")).toBe(false);
  });

  it("contributor filter matches only content contributors", () => {
    expect(matchesUserType(makeUser({ contentContributor: true }), "contributor")).toBe(true);
    expect(matchesUserType(makeUser({ contentContributor: false }), "contributor")).toBe(false);
  });

  it("reviewer filter matches only reviewers", () => {
    expect(matchesUserType(makeUser({ reviewer: true }), "reviewer")).toBe(true);
    expect(matchesUserType(makeUser({ reviewer: false }), "reviewer")).toBe(false);
  });

  it("coach filter matches only training dashboard access", () => {
    expect(matchesUserType(makeUser({ trainingDashboardAccess: true }), "coach")).toBe(true);
    expect(matchesUserType(makeUser({ trainingDashboardAccess: false }), "coach")).toBe(false);
  });

  it("none filter matches only users with no elevated role at all", () => {
    expect(matchesUserType(makeUser(), "none")).toBe(true);
    expect(matchesUserType(makeUser({ reviewer: true }), "none")).toBe(false);
    expect(matchesUserType(makeUser({ isAdmin: true }), "none")).toBe(false);
  });

  it("undefined type matches everyone (the 'All' pill)", () => {
    expect(matchesUserType(makeUser({ isAdmin: true }), undefined)).toBe(true);
    expect(matchesUserType(makeUser(), undefined)).toBe(true);
  });
});
