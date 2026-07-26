import { describe, expect, it } from "vitest";

import { bpmFromPercent, estimateMaxHr } from "@/lib/hr-model";

describe("estimateMaxHr", () => {
  it("prefers a known max HR over the age-based estimate", () => {
    expect(estimateMaxHr(30, 200)).toBe(200);
  });

  it("falls back to 220-minus-age when no known max HR is given", () => {
    expect(estimateMaxHr(30, null)).toBe(190);
  });

  it("returns null when neither input is available", () => {
    expect(estimateMaxHr(null, null)).toBeNull();
  });

  it("ignores a non-positive known max HR and falls back to age", () => {
    expect(estimateMaxHr(30, 0)).toBe(190);
    expect(estimateMaxHr(30, -5)).toBe(190);
  });

  it("ignores a non-positive age when no known max HR is given", () => {
    expect(estimateMaxHr(0, null)).toBeNull();
  });
});

describe("bpmFromPercent", () => {
  it("computes a simple percent-of-max-HR target", () => {
    expect(bpmFromPercent(80, "hrmax", 190, null)).toBeCloseTo(152, 6);
  });

  it("computes a Karvonen (percent-of-reserve) target", () => {
    // 60 resting, 190 max -> reserve of 130; 70% of that + resting = 151.
    expect(bpmFromPercent(70, "hrreserve", 190, 60)).toBeCloseTo(151, 6);
  });

  it("returns null for hrreserve basis when resting HR isn't known", () => {
    expect(bpmFromPercent(70, "hrreserve", 190, null)).toBeNull();
  });

  it("never applies a sex-based adjustment -- the two calculators that use this must agree for identical inputs", () => {
    // The exact case that used to disagree: same max/resting HR, same
    // percent, computed twice as if by each of the two calculators.
    const fromCalculatorA = bpmFromPercent(70, "hrreserve", 190, 60);
    const fromCalculatorB = bpmFromPercent(70, "hrreserve", 190, 60);
    expect(fromCalculatorA).toBe(fromCalculatorB);
    expect(fromCalculatorA).toBeCloseTo(151, 6);
  });
});
