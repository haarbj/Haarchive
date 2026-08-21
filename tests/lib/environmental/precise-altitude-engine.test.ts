import { describe, expect, it } from "vitest";

import { altitudeEngine } from "@/lib/environmental/altitude-engine";
import { preciseAltitudeEngine } from "@/lib/environmental/precise-altitude-engine";
import type { PerformanceContext } from "@/lib/environmental/types";

const marathonContext: PerformanceContext = {
  distanceMeters: 42195,
  actualTimeSeconds: 4 * 3600,
  paceMS: 42195 / (4 * 3600),
};

describe("preciseAltitudeEngine.isApplicable", () => {
  it("is not applicable at sea level throughout", () => {
    expect(preciseAltitudeEngine.isApplicable({ perMileAltitudeM: [0, 0, 0] })).toBe(false);
  });

  it("is not applicable with no mile data at all", () => {
    expect(preciseAltitudeEngine.isApplicable({ perMileAltitudeM: [] })).toBe(false);
  });

  it("is applicable when any mile has real altitude", () => {
    expect(preciseAltitudeEngine.isApplicable({ perMileAltitudeM: [0, 2000, 0] })).toBe(true);
  });
});

describe("preciseAltitudeEngine.compute", () => {
  it("REGRESSION: a route that climbs from 7,000ft to 8,500ft is NOT treated the same as one that stays flat at 7,750ft the whole way", () => {
    // Both have the same simple average altitude, but because the
    // impairment curve is convex (accelerating), a mile-by-mile weighted
    // sum of a genuinely varying profile is NOT required to equal the
    // impairment of one constant "average" altitude applied throughout --
    // this proves the engine is actually costing each mile at its own
    // real altitude, not silently collapsing to one representative number.
    const ft = 0.3048;
    const climbing = preciseAltitudeEngine.compute(
      { perMileAltitudeM: [7000 * ft, 7500 * ft, 8000 * ft, 8500 * ft] },
      marathonContext,
    );
    const constantAtAverage = preciseAltitudeEngine.compute(
      { perMileAltitudeM: [7750 * ft, 7750 * ft, 7750 * ft, 7750 * ft] },
      marathonContext,
    );
    // Convexity means the varying profile costs MORE than the flat
    // average would (Jensen's inequality for a convex cost function).
    expect(climbing.adjustmentSeconds).toBeGreaterThan(constantAtAverage.adjustmentSeconds);
  });

  it("matches the coarse engine when every mile is at the same altitude", () => {
    const altitudeM = 2500;
    const precise = preciseAltitudeEngine.compute({ perMileAltitudeM: [altitudeM, altitudeM, altitudeM] }, marathonContext);
    const coarse = altitudeEngine.compute({ altitudeM }, marathonContext);
    expect(precise.adjustmentSeconds).toBeCloseTo(coarse.adjustmentSeconds, 1);
  });

  it("costs nothing for a route entirely at sea level", () => {
    const result = preciseAltitudeEngine.compute({ perMileAltitudeM: [0, 0, 0] }, marathonContext);
    expect(result.adjustmentSeconds).toBe(0);
  });

  it("has a tighter confidence band than the coarse engine for a comparable altitude", () => {
    const altitudeM = 2500;
    const precise = preciseAltitudeEngine.compute({ perMileAltitudeM: [altitudeM, altitudeM] }, marathonContext);
    const coarse = altitudeEngine.compute({ altitudeM }, marathonContext);
    const preciseBandWidth = precise.confidenceHighSeconds - precise.confidenceLowSeconds;
    const coarseBandWidth = coarse.confidenceHighSeconds - coarse.confidenceLowSeconds;
    expect(preciseBandWidth).toBeLessThan(coarseBandWidth);
  });

  it("mentions the real altitude range in its summary when the route's altitude varies meaningfully", () => {
    const result = preciseAltitudeEngine.compute({ perMileAltitudeM: [2000, 2200, 2400] }, marathonContext);
    expect(result.summary).toMatch(/2,000|2000/);
    expect(result.summary).toMatch(/2,400|2400/);
  });

  it("does not claim a range when the route's altitude is essentially constant", () => {
    const result = preciseAltitudeEngine.compute({ perMileAltitudeM: [2500, 2505, 2498] }, marathonContext);
    expect(result.summary).not.toMatch(/ranged/);
  });
});
