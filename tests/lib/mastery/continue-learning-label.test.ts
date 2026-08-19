import { describe, expect, it } from "vitest";

import { continueLearningLabel } from "@/lib/mastery/continue-learning-label";

describe("continueLearningLabel", () => {
  it("is \"Start with →\" when the recommended topic has no learning events at all", () => {
    expect(continueLearningLabel([], "the-aerobic-base")).toBe("Start with →");
  });

  it("is \"Continue →\" when the recommended topic has at least one learning event", () => {
    expect(continueLearningLabel(["the-aerobic-base"], "the-aerobic-base")).toBe("Continue →");
    expect(continueLearningLabel(["exercise-physiology", "the-aerobic-base"], "the-aerobic-base")).toBe(
      "Continue →",
    );
  });

  it("is \"Start with →\" when other topics have engagement but not the recommended one", () => {
    expect(continueLearningLabel(["exercise-physiology"], "the-aerobic-base")).toBe("Start with →");
  });
});
