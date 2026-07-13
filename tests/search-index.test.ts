import { describe, expect, it } from "vitest";

import { search } from "@/lib/search-index";

describe("search", () => {
  it("returns nothing for an empty or whitespace-only query", () => {
    expect(search("")).toEqual([]);
    expect(search("   ")).toEqual([]);
  });

  it("finds a category by title", () => {
    const results = search("coaching");
    expect(results.some((r) => r.title === "Coaching & Training")).toBe(true);
  });

  it("finds a section by title", () => {
    const results = search("nutrition");
    expect(results.some((r) => r.title === "Nutrition & Fueling")).toBe(true);
  });

  it("finds a specific heading nested inside a section's content", () => {
    const results = search("cardiac drift");
    expect(results.some((r) => r.href.includes("#cardiac-drift"))).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(search("CARDIAC DRIFT")).toEqual(search("cardiac drift"));
  });

  it("ranks an exact title match above a match that only appears in a mission or topic", () => {
    const results = search("tools");
    expect(results[0]?.title).toBe("Tools");
  });

  it("caps results at the requested limit", () => {
    const results = search("a", 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });
});
