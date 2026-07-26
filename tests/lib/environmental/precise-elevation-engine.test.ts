import { describe, expect, it } from "vitest";

import { preciseElevationEngine } from "@/lib/environmental/precise-elevation-engine";
import { elevationEngine } from "@/lib/environmental/elevation-engine";
import type { PerformanceContext } from "@/lib/environmental/types";

const tenKContext: PerformanceContext = {
  distanceMeters: 10000,
  actualTimeSeconds: 2400,
  paceMS: 10000 / 2400,
};

describe("preciseElevationEngine.isApplicable", () => {
  it("is not applicable on a perfectly flat course", () => {
    expect(preciseElevationEngine.isApplicable({ perMileGrade: [0, 0, 0] })).toBe(false);
  });

  it("is not applicable with no mile data at all", () => {
    expect(preciseElevationEngine.isApplicable({ perMileGrade: [] })).toBe(false);
  });

  it("is applicable with any nonzero grade", () => {
    expect(preciseElevationEngine.isApplicable({ perMileGrade: [0, 0.03, 0] })).toBe(true);
  });
});

describe("preciseElevationEngine.compute", () => {
  it("costs time for a course that's entirely net-uphill", () => {
    const result = preciseElevationEngine.compute({ perMileGrade: [0.03, 0.03, 0.03] }, tenKContext);
    expect(result.adjustmentSeconds).toBeGreaterThan(0);
  });

  it("saves time for a course that's entirely net-downhill", () => {
    const result = preciseElevationEngine.compute({ perMileGrade: [-0.03, -0.03, -0.03] }, tenKContext);
    expect(result.adjustmentSeconds).toBeLessThan(0);
  });

  it("nets out to a smaller benefit than the cost of the same-magnitude climb, for an out-and-back profile", () => {
    const climbOnly = preciseElevationEngine.compute({ perMileGrade: [0.06, 0.06] }, tenKContext);
    const outAndBack = preciseElevationEngine.compute({ perMileGrade: [0.06, -0.06] }, tenKContext);
    // Same Minetti asymmetry as the coarse engine: descending doesn't recover the full climb cost.
    expect(outAndBack.adjustmentSeconds).toBeGreaterThan(0);
    expect(outAndBack.adjustmentSeconds).toBeLessThan(climbOnly.adjustmentSeconds);
  });

  it("has a tighter confidence band than the coarse, assumed-grade engine for a comparable course", () => {
    const precise = preciseElevationEngine.compute({ perMileGrade: [0.06, -0.06] }, tenKContext);
    const coarse = elevationEngine.compute({ elevationGainM: 100, elevationLossM: 100 }, tenKContext);
    const preciseBandWidth = precise.confidenceHighSeconds - precise.confidenceLowSeconds;
    const coarseBandWidth = coarse.confidenceHighSeconds - coarse.confidenceLowSeconds;
    expect(preciseBandWidth).toBeLessThan(coarseBandWidth);
  });

  it("distinguishes a short steep pitch from a long gentle rise of the same net grade differently than a flat total would", () => {
    // Two "courses" with the same overall average grade but different real
    // per-mile shapes -- Minetti's curve is convex, so concentrating the
    // same net climb into fewer, steeper miles costs more than spreading
    // it evenly. This is exactly the distinction the coarse engine (total
    // gain/loss only) cannot make.
    const evenlySpread = preciseElevationEngine.compute({ perMileGrade: [0.02, 0.02, 0.02, 0.02] }, tenKContext);
    const concentrated = preciseElevationEngine.compute({ perMileGrade: [0.08, 0, 0, 0] }, tenKContext);
    expect(concentrated.adjustmentSeconds).toBeGreaterThan(evenlySpread.adjustmentSeconds);
  });
});
