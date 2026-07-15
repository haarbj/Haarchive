import { describe, expect, it } from "vitest";

import { updateUserPermissionsSchema } from "@/lib/validation/user-permissions";

describe("updateUserPermissionsSchema", () => {
  it("accepts a valid userId with no boxes checked", () => {
    const result = updateUserPermissionsSchema.safeParse({ userId: "11111111-1111-4111-8111-111111111111" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentContributor).toBe(false);
      expect(result.data.reviewer).toBe(false);
      expect(result.data.trainingDashboardAccess).toBe(false);
    }
  });

  it("coerces checkbox 'true' string values from FormData", () => {
    const result = updateUserPermissionsSchema.safeParse({
      userId: "11111111-1111-4111-8111-111111111111",
      contentContributor: "true",
      reviewer: "true",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentContributor).toBe(true);
      expect(result.data.reviewer).toBe(true);
      expect(result.data.trainingDashboardAccess).toBe(false);
    }
  });

  it("rejects a non-uuid userId", () => {
    const result = updateUserPermissionsSchema.safeParse({ userId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing userId", () => {
    const result = updateUserPermissionsSchema.safeParse({ contentContributor: "true" });
    expect(result.success).toBe(false);
  });
});
