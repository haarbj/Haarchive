import { describe, expect, it } from "vitest";

import { searchQuerySchema } from "@/lib/validation/search";

describe("searchQuerySchema", () => {
  it("accepts a normal query", () => {
    expect(searchQuerySchema.safeParse("cardiac drift").success).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const result = searchQuerySchema.safeParse("  threshold  ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("threshold");
  });

  it("rejects an empty or whitespace-only query", () => {
    expect(searchQuerySchema.safeParse("").success).toBe(false);
    expect(searchQuerySchema.safeParse("   ").success).toBe(false);
  });

  it("rejects a query over 120 characters", () => {
    expect(searchQuerySchema.safeParse("a".repeat(121)).success).toBe(false);
  });

  it("accepts a query at exactly the 120 character limit", () => {
    expect(searchQuerySchema.safeParse("a".repeat(120)).success).toBe(true);
  });
});
