import { describe, expect, it } from "vitest";

import {
  combineAdjustments,
  convertBetweenConditions,
  equivalentIdealTime,
  predictedActualTime,
} from "@/lib/environmental/combine";
import type { EngineResult } from "@/lib/environmental/types";

function fakeResult(factor: string, adjustmentSeconds: number, bandFraction = 0.3): EngineResult {
  return {
    factor,
    adjustmentSeconds,
    confidenceLowSeconds: adjustmentSeconds - Math.abs(adjustmentSeconds) * bandFraction,
    confidenceHighSeconds: adjustmentSeconds + Math.abs(adjustmentSeconds) * bandFraction,
    summary: `${factor} summary`,
  };
}

describe("combineAdjustments", () => {
  it("sums point estimates and confidence bounds across every engine result", () => {
    const results = [fakeResult("Heat", 17), fakeResult("Wind", 6), fakeResult("Humidity", 3)];
    const combined = combineAdjustments(results);
    expect(combined.totalAdjustmentSeconds).toBeCloseTo(26, 6);
    expect(combined.lowSeconds).toBeCloseTo(
      results.reduce((sum, r) => sum + r.confidenceLowSeconds, 0),
      6,
    );
    expect(combined.highSeconds).toBeCloseTo(
      results.reduce((sum, r) => sum + r.confidenceHighSeconds, 0),
      6,
    );
  });

  it("returns a zero total for no applicable engines", () => {
    const combined = combineAdjustments([]);
    expect(combined.totalAdjustmentSeconds).toBe(0);
  });
});

describe("equivalentIdealTime (Analyze mode)", () => {
  it("subtracts the total adjustment from actual time, matching the worked example", () => {
    // 16:45 (1005s) actual, with a combined +24s environmental cost -> 16:21 (981s) equivalent.
    const combined = combineAdjustments([fakeResult("Heat", 17), fakeResult("Wind", 4), fakeResult("Humidity", 3)]);
    const result = equivalentIdealTime(1005, combined);
    expect(result.estimateSeconds).toBeCloseTo(981, 6);
  });

  it("puts the faster bound on the low end and the slower bound on the high end", () => {
    const combined = combineAdjustments([fakeResult("Heat", 20)]);
    const result = equivalentIdealTime(1000, combined);
    expect(result.lowSeconds).toBeLessThan(result.estimateSeconds);
    expect(result.highSeconds).toBeGreaterThan(result.estimateSeconds);
  });
});

describe("predictedActualTime (Predict mode)", () => {
  it("adds the total adjustment to an ideal time", () => {
    const combined = combineAdjustments([fakeResult("Heat", 20), fakeResult("Wind", -5)]);
    const result = predictedActualTime(1000, combined);
    expect(result.estimateSeconds).toBeCloseTo(1015, 6);
  });

  it("is the inverse of equivalentIdealTime for the same combined adjustment", () => {
    const combined = combineAdjustments([fakeResult("Heat", 12), fakeResult("Elevation", 8)]);
    const actual = 1000;
    const ideal = equivalentIdealTime(actual, combined);
    const predicted = predictedActualTime(ideal.estimateSeconds, combined);
    expect(predicted.estimateSeconds).toBeCloseTo(actual, 6);
  });
});

describe("convertBetweenConditions (Convert mode)", () => {
  it("routes actual time through a shared ideal baseline to the other condition's adjustment", () => {
    const combinedA = combineAdjustments([fakeResult("Heat", 20)]);
    const combinedB = combineAdjustments([fakeResult("Heat", 5)]);
    const result = convertBetweenConditions(1020, combinedA, combinedB);
    // 1020 actual under A (which cost +20) -> 1000 ideal -> +5 under B -> 1005
    expect(result.estimateSeconds).toBeCloseTo(1005, 6);
  });

  it("returns the same time when both conditions have identical adjustments", () => {
    const combinedA = combineAdjustments([fakeResult("Heat", 10)]);
    const combinedB = combineAdjustments([fakeResult("Heat", 10)]);
    const result = convertBetweenConditions(1000, combinedA, combinedB);
    expect(result.estimateSeconds).toBeCloseTo(1000, 6);
  });
});
