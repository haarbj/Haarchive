import { describe, expect, it } from "vitest";

import { resolveTopicMetadata } from "@/lib/library/resolve-content";

describe("resolveTopicMetadata", () => {
  it("resolves a real taxonomy topic to its title and category", () => {
    const result = resolveTopicMetadata("exercise-physiology");
    expect(result).toEqual({ title: "Exercise Physiology", categorySlug: "the-science", categoryTitle: "The Science" });
  });

  it("returns null for a slug that isn't a real section (e.g. a DB-backed contributor article)", () => {
    expect(resolveTopicMetadata("some-contributor-article-slug")).toBeNull();
  });

  it("resolves a tools-category topic correctly", () => {
    const result = resolveTopicMetadata("pace-calculator");
    expect(result?.categorySlug).toBe("tools");
    expect(result?.categoryTitle).toBe("Tools");
  });
});
