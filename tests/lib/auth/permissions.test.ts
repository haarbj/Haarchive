import { describe, expect, it } from "vitest";

import {
  CONTENT_PERMISSIONS,
  hasAnyContentPermission,
  hasContentPermission,
  type ContentPermission,
} from "@/lib/auth/permissions";

describe("hasContentPermission", () => {
  it("returns true when the permission is present", () => {
    expect(hasContentPermission(["reviewer"], "reviewer")).toBe(true);
  });

  it("returns false when the permission is absent", () => {
    expect(hasContentPermission(["reviewer"], "content_contributor")).toBe(false);
  });

  it("returns false for an empty permission set", () => {
    expect(hasContentPermission([], "content_contributor")).toBe(false);
  });

  it("supports a user holding multiple permissions at once", () => {
    const permissions: ContentPermission[] = ["content_contributor", "reviewer"];
    expect(hasContentPermission(permissions, "content_contributor")).toBe(true);
    expect(hasContentPermission(permissions, "reviewer")).toBe(true);
  });
});

describe("hasAnyContentPermission", () => {
  it("returns false for an empty array", () => {
    expect(hasAnyContentPermission([])).toBe(false);
  });

  it("returns true when at least one permission is present", () => {
    expect(hasAnyContentPermission(["reviewer"])).toBe(true);
  });
});

describe("CONTENT_PERMISSIONS", () => {
  it("never includes admin -- admin stays ADMIN_EMAILS-only", () => {
    expect(CONTENT_PERMISSIONS).not.toContain("admin");
    expect(CONTENT_PERMISSIONS).toEqual(["content_contributor", "reviewer"]);
  });
});
