import { describe, expect, it } from "vitest";

import { altitudeEngine } from "@/lib/environmental/altitude-engine";
import type { PerformanceContext } from "@/lib/environmental/types";

const FT_PER_M = 3.28084;
function ftToM(ft: number): number {
  return ft / FT_PER_M;
}

const marathonContext: PerformanceContext = {
  distanceMeters: 42195,
  actualTimeSeconds: 4 * 3600,
  paceMS: 42195 / (4 * 3600),
};

const mileContext: PerformanceContext = {
  distanceMeters: 1609.344,
  actualTimeSeconds: 6 * 60,
  paceMS: 1609.344 / (6 * 60),
};

const fiveKContext: PerformanceContext = {
  distanceMeters: 5000,
  actualTimeSeconds: 22 * 60,
  paceMS: 5000 / (22 * 60),
};

describe("altitudeEngine.isApplicable", () => {
  it("is not applicable at sea level", () => {
    expect(altitudeEngine.isApplicable({ altitudeM: 0 })).toBe(false);
  });

  it("is applicable above sea level (no hard threshold -- the curve itself tapers to ~0)", () => {
    expect(altitudeEngine.isApplicable({ altitudeM: 500 })).toBe(true);
  });
});

// Daniels' Altitude Adjustment Tables' marathon multipliers -- the exact
// calibration target for altitudeEngine's quadratic. At marathon duration
// (the model's duration-scale anchor of 1.0), adjustmentSeconds / actual
// time should reproduce (multiplier - 1) directly.
describe("altitudeEngine.compute -- marathon multiplier calibration", () => {
  const DANIELS_MARATHON_MULTIPLIER: [number, number][] = [
    [3000, 1.011],
    [4000, 1.017],
    [5000, 1.025],
    [6000, 1.034],
    [7000, 1.045],
    [8000, 1.058],
  ];

  it.each(DANIELS_MARATHON_MULTIPLIER)("matches the %ift marathon multiplier within 0.001", (ft, multiplier) => {
    const result = altitudeEngine.compute({ altitudeM: ftToM(ft) }, marathonContext);
    const impliedMultiplier = 1 + result.adjustmentSeconds / marathonContext.actualTimeSeconds;
    expect(impliedMultiplier).toBeCloseTo(multiplier, 3);
  });

  it("costs roughly twice as much at 7,000ft as at 5,000ft, not the ~25x a hard-threshold model would predict", () => {
    const at5000 = altitudeEngine.compute({ altitudeM: ftToM(5000) }, marathonContext);
    const at7000 = altitudeEngine.compute({ altitudeM: ftToM(7000) }, marathonContext);
    const ratio = at7000.adjustmentSeconds / at5000.adjustmentSeconds;
    expect(ratio).toBeGreaterThan(1.6);
    expect(ratio).toBeLessThan(2.4);
  });

  it("is smooth and accelerating -- no discontinuity around any fixed threshold", () => {
    const seconds = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000].map(
      (ft) => altitudeEngine.compute({ altitudeM: ftToM(ft) }, marathonContext).adjustmentSeconds,
    );
    for (let i = 1; i < seconds.length; i++) {
      expect(seconds[i]).toBeGreaterThan(seconds[i - 1]);
    }
    // Accelerating (convex): each 1,000ft step should cost more than the last.
    const steps = seconds.slice(1).map((s, i) => s - seconds[i]);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    }
  });

  it("caps the modeled effect rather than extrapolating past Daniels' own calibrated range", () => {
    const atCap = altitudeEngine.compute({ altitudeM: ftToM(14000) }, marathonContext);
    const wayBeyondCap = altitudeEngine.compute({ altitudeM: ftToM(20000) }, marathonContext);
    expect(wayBeyondCap.adjustmentSeconds).toBeCloseTo(atCap.adjustmentSeconds, 6);
  });
});

describe("altitudeEngine.compute -- distance/duration scaling", () => {
  it("costs proportionally less over a mile than a marathon at the same altitude, matching Daniels' Mile multiplier being smaller than his Marathon multiplier", () => {
    const marathon = altitudeEngine.compute({ altitudeM: ftToM(5000) }, marathonContext);
    const mile = altitudeEngine.compute({ altitudeM: ftToM(5000) }, mileContext);
    const marathonFraction = marathon.adjustmentSeconds / marathonContext.actualTimeSeconds;
    const mileFraction = mile.adjustmentSeconds / mileContext.actualTimeSeconds;
    expect(mileFraction).toBeLessThan(marathonFraction);
    // Daniels' 5,000ft Mile multiplier (1.007) implies a ~0.7% fraction --
    // this should land in that neighborhood, not near heat's ~0.15x floor
    // (which would predict something far smaller).
    expect(mileFraction).toBeGreaterThan(0.005);
    expect(mileFraction).toBeLessThan(0.01);
  });

  it("costs a 5K closer to marathon-like impairment than a mile does, matching Daniels' 5K multiplier sitting much closer to his Marathon multiplier than his Mile multiplier does", () => {
    const marathon = altitudeEngine.compute({ altitudeM: ftToM(5000) }, marathonContext);
    const mile = altitudeEngine.compute({ altitudeM: ftToM(5000) }, mileContext);
    const fiveK = altitudeEngine.compute({ altitudeM: ftToM(5000) }, fiveKContext);
    const marathonFraction = marathon.adjustmentSeconds / marathonContext.actualTimeSeconds;
    const mileFraction = mile.adjustmentSeconds / mileContext.actualTimeSeconds;
    const fiveKFraction = fiveK.adjustmentSeconds / fiveKContext.actualTimeSeconds;
    expect(fiveKFraction).toBeGreaterThan(mileFraction);
    expect(fiveKFraction).toBeLessThan(marathonFraction);
    // Closer to marathon than to mile, per the table's ~0.71 vs ~0.29 ratios.
    expect(marathonFraction - fiveKFraction).toBeLessThan(fiveKFraction - mileFraction);
  });

  it("does not scale beyond marathon duration -- an ultra gets the same duration-scale as a marathon", () => {
    const marathon = altitudeEngine.compute({ altitudeM: ftToM(5000) }, marathonContext);
    const ultraContext: PerformanceContext = { distanceMeters: 80000, actualTimeSeconds: 8 * 3600, paceMS: 80000 / (8 * 3600) };
    const ultra = altitudeEngine.compute({ altitudeM: ftToM(5000) }, ultraContext);
    const marathonFraction = marathon.adjustmentSeconds / marathonContext.actualTimeSeconds;
    const ultraFraction = ultra.adjustmentSeconds / ultraContext.actualTimeSeconds;
    expect(ultraFraction).toBeCloseTo(marathonFraction, 6);
  });
});

describe("altitudeEngine.compute -- confidence band", () => {
  it("returns a wider confidence band than the heat/humidity engines, reflecting individual altitude variability", () => {
    const result = altitudeEngine.compute({ altitudeM: ftToM(5000) }, marathonContext);
    const bandWidth = result.confidenceHighSeconds - result.confidenceLowSeconds;
    expect(bandWidth).toBeGreaterThan(result.adjustmentSeconds * 0.6);
  });
});
