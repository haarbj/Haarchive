import { describe, expect, it } from "vitest";

import { hasReadableContent } from "@/lib/mastery/readable-content";

describe("hasReadableContent", () => {
  it("is true for a standard essay topic with real sections.ts content", () => {
    expect(hasReadableContent("exercise-physiology")).toBe(true);
  });

  it("is true for coaching-library, athlete-library, and training-philosophy despite having no sections.ts content array", () => {
    // All three are bespoke templates with no `content` array, but all
    // three genuinely fire content_viewed/content_engaged from real prose
    // elsewhere (coach/athlete detail pages, the flagship essay page) --
    // see this module's own header comment for the full reasoning.
    expect(hasReadableContent("coaching-library")).toBe(true);
    expect(hasReadableContent("athlete-library")).toBe(true);
    expect(hasReadableContent("training-philosophy")).toBe(true);
  });

  it("is false for every tool-only topic (calculators, heat-tracker, training-plans)", () => {
    for (const slug of [
      "pace-calculator",
      "heat-tracker",
      "environmental-calculator",
      "gap-calculator",
      "pace-percent-calculator",
      "cv-threshold-calculator",
      "race-pace-calculator",
      "hr-threshold-calculator",
      "tinman-calculator",
      "marathon-pacing-calculator",
      "training-plans",
    ]) {
      expect(hasReadableContent(slug)).toBe(false);
    }
  });

  it("is false for an unrecognized slug", () => {
    expect(hasReadableContent("not-a-real-topic-slug")).toBe(false);
  });
});
