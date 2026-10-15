import { describe, it, expect } from "vitest";
import {
  CHOOSE_TWO_LINE,
  DEFAULT_PLAN_WEEKS,
  STANDARD_PLAN_WEEKS,
  durationSelectionGuidance,
} from "@/lib/private-coaching/plan-selection-guidance";

describe("durationSelectionGuidance (Part D item 9)", () => {
  it("has 12 and 18 as the two standard lengths, with 18 as the default", () => {
    expect(STANDARD_PLAN_WEEKS).toEqual([12, 18]);
    expect(DEFAULT_PLAN_WEEKS).toBe(18);
  });

  it("does not flag an exact match to either standard layout", () => {
    expect(durationSelectionGuidance(12).flagged).toBe(false);
    expect(durationSelectionGuidance(18).flagged).toBe(false);
  });

  it("offers extend/compress of the 12- and 18-week layouts for a 14-week horizon", () => {
    const result = durationSelectionGuidance(14);
    expect(result.flagged).toBe(true);
    expect(result.detail).toMatch(/Extend the 12-week layout/);
    expect(result.detail).toMatch(/compress the 18-week layout/);
    expect(result.actions.join(" ")).toMatch(/Extend the 12-week layout/);
    expect(result.actions.join(" ")).toMatch(/compress the 18-week layout/);
  });

  it("offers extend/compress of the 12- and 18-week layouts for a 21-week horizon", () => {
    const result = durationSelectionGuidance(21);
    expect(result.flagged).toBe(true);
    expect(result.detail).toMatch(/Extend the 12-week layout/);
    expect(result.detail).toMatch(/compress the 18-week layout/);
  });

  it("prepends base building rather than stretching the 18-week layout at exactly 24 weeks", () => {
    const result = durationSelectionGuidance(24);
    expect(result.flagged).toBe(true);
    expect(result.detail).toMatch(/prepend a dedicated base-building block/);
    expect(result.actions.join(" ")).not.toMatch(/stretch/i);
    expect(result.actions.join(" ")).toMatch(/6 weeks of base building/);
  });

  it("suggests a mini-cycle before the standard buildup for horizons over 24 weeks", () => {
    const result = durationSelectionGuidance(30);
    expect(result.flagged).toBe(true);
    expect(result.detail).toMatch(/mini-cycle/);
    expect(result.detail).toMatch(/shorter distances, trail, or unstructured running/);
    expect(result.actions.join(" ")).toMatch(/mini-cycle/);
  });

  it("includes the choose-two risk-framing line on every flagged branch (item 10)", () => {
    for (const weeks of [14, 21, 24, 30]) {
      expect(durationSelectionGuidance(weeks).detail).toContain(CHOOSE_TWO_LINE);
    }
  });

  it("frames risk as proportional to the size of the change, not absolute mileage or weeks", () => {
    expect(durationSelectionGuidance(14).detail).toMatch(/drastic/);
    expect(durationSelectionGuidance(24).detail).toMatch(/drastic/);
    expect(durationSelectionGuidance(30).detail).toMatch(/drastic/);
  });

  it("handles a non-finite or non-positive horizon without throwing", () => {
    expect(durationSelectionGuidance(0).flagged).toBe(false);
    expect(durationSelectionGuidance(-3).flagged).toBe(false);
    expect(durationSelectionGuidance(NaN).flagged).toBe(false);
  });
});
