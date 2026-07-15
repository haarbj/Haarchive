import { describe, expect, it } from "vitest";

import {
  isFoundationsSuggestionTarget,
  listFoundationsSuggestionTargets,
} from "@/lib/content-suggestions/foundations-targets";

describe("listFoundationsSuggestionTargets", () => {
  it("includes a real Foundations page", () => {
    const targets = listFoundationsSuggestionTargets();
    expect(targets.some((t) => t.slug === "recovery")).toBe(true);
    expect(targets.some((t) => t.slug === "nutrition-and-fueling")).toBe(true);
  });

  it("excludes the writing-and-resources (Articles) category", () => {
    const targets = listFoundationsSuggestionTargets();
    expect(targets.some((t) => t.slug === "articles")).toBe(false);
    expect(targets.some((t) => t.slug === "why-running-is-valuable-for-everyone")).toBe(false);
  });

  it("excludes interactive tool pages", () => {
    const targets = listFoundationsSuggestionTargets();
    expect(targets.some((t) => t.slug === "pace-calculator")).toBe(false);
    expect(targets.some((t) => t.slug === "heat-tracker")).toBe(false);
  });

  it("carries the correct parent category title", () => {
    const targets = listFoundationsSuggestionTargets();
    const recovery = targets.find((t) => t.slug === "recovery");
    expect(recovery?.categoryTitle).toBe("Recovery & Fueling");
  });
});

describe("isFoundationsSuggestionTarget", () => {
  it("returns true for a real Foundations slug", () => {
    expect(isFoundationsSuggestionTarget("exercise-physiology")).toBe(true);
  });

  it("returns false for a non-Foundations slug", () => {
    expect(isFoundationsSuggestionTarget("articles")).toBe(false);
    expect(isFoundationsSuggestionTarget("not-a-real-slug")).toBe(false);
  });
});
