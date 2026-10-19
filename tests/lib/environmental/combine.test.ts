import { describe, expect, it } from "vitest";

import {
  combineAdjustments,
  convertBetweenConditions,
  equivalentIdealTime,
  netEngineResults,
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

  it("equals the manual two-step composition (A -> ideal via equivalentIdealTime, then ideal -> B via predictedActualTime) for the same inputs", () => {
    const combinedA = combineAdjustments([fakeResult("Heat", 18), fakeResult("Wind", -4), fakeResult("Elevation", 6)]);
    const combinedB = combineAdjustments([fakeResult("Heat", 3), fakeResult("Wind", 2), fakeResult("Elevation", 0)]);
    const actualTimeSeconds = 1234;

    const direct = convertBetweenConditions(actualTimeSeconds, combinedA, combinedB);

    const manualIdeal = equivalentIdealTime(actualTimeSeconds, combinedA);
    const manualProjected = predictedActualTime(manualIdeal.estimateSeconds, combinedB);

    expect(direct.estimateSeconds).toBeCloseTo(manualProjected.estimateSeconds, 9);
    expect(direct.lowSeconds).toBeCloseTo(predictedActualTime(manualIdeal.lowSeconds, combinedB).lowSeconds, 9);
    expect(direct.highSeconds).toBeCloseTo(predictedActualTime(manualIdeal.highSeconds, combinedB).highSeconds, 9);
  });
});

describe("the existing 'to ideal' (Analyze) math is unchanged -- a fixed pin, not just a relative check", () => {
  it("reproduces the exact same worked-example output this file has always pinned", () => {
    // Identical to the "subtracts the total adjustment..." case above,
    // kept as its own explicit, named pin so a future change to this
    // module that accidentally shifts Analyze mode's output fails here
    // specifically, not just incidentally via the shared describe block.
    const combined = combineAdjustments([fakeResult("Heat", 17), fakeResult("Wind", 4), fakeResult("Humidity", 3)]);
    const result = equivalentIdealTime(1005, combined);
    expect(result.estimateSeconds).toBeCloseTo(981, 6);
    expect(result.lowSeconds).toBeCloseTo(
      1005 - combineAdjustments([fakeResult("Heat", 17), fakeResult("Wind", 4), fakeResult("Humidity", 3)]).highSeconds,
      6,
    );
  });
});

describe("netEngineResults (Convert mode's per-factor net breakdown)", () => {
  it("is resultB minus resultA for a factor present on both sides", () => {
    const resultsA = [fakeResult("Heat", 20), fakeResult("Elevation", 6)];
    const resultsB = [fakeResult("Heat", 5), fakeResult("Elevation", 9)];
    const net = netEngineResults(resultsA, resultsB);

    const heat = net.find((r) => r.factor === "Heat")!;
    const elevation = net.find((r) => r.factor === "Elevation")!;
    expect(heat.adjustmentSeconds).toBeCloseTo(5 - 20, 6); // cooler in B -- helps (negative)
    expect(elevation.adjustmentSeconds).toBeCloseTo(9 - 6, 6); // higher in B -- costs (positive)
  });

  it("treats a factor missing from one side as a real 0, not a missing value", () => {
    const resultsA = [fakeResult("Heat", 10)]; // no wind in A (still air)
    const resultsB = [fakeResult("Heat", 10), fakeResult("Wind", 8)]; // real headwind in B
    const net = netEngineResults(resultsA, resultsB);

    const wind = net.find((r) => r.factor === "Wind")!;
    expect(wind.adjustmentSeconds).toBeCloseTo(8 - 0, 6);
    const heat = net.find((r) => r.factor === "Heat")!;
    expect(heat.adjustmentSeconds).toBeCloseTo(0, 6);
  });

  it("composes confidence bounds conservatively (B's most favorable vs. A's least favorable, and vice versa)", () => {
    const resultsA = [fakeResult("Heat", 20, 0.3)]; // low 14, high 26
    const resultsB = [fakeResult("Heat", 5, 0.3)]; // low 3.5, high 6.5
    const net = netEngineResults(resultsA, resultsB);
    const heat = net.find((r) => r.factor === "Heat")!;
    // net low = B.low - A.high = 3.5 - 26 = -22.5; net high = B.high - A.low = 6.5 - 14 = -7.5
    expect(heat.confidenceLowSeconds).toBeCloseTo(3.5 - 26, 6);
    expect(heat.confidenceHighSeconds).toBeCloseTo(6.5 - 14, 6);
  });

  it("returns a zero-difference, 'no meaningful difference' result when both sides are identical", () => {
    const resultsA = [fakeResult("Heat", 12)];
    const resultsB = [fakeResult("Heat", 12)];
    const net = netEngineResults(resultsA, resultsB);
    expect(net[0].adjustmentSeconds).toBeCloseTo(0, 6);
    expect(net[0].summary).toContain("No meaningful net difference");
  });

  it("every net result carries a human-readable summary mentioning whether it helps or costs", () => {
    const net = netEngineResults([fakeResult("Heat", 20)], [fakeResult("Heat", 2)]);
    expect(net[0].summary.toLowerCase()).toContain("helps");
  });
});
