import { describe, expect, it } from "vitest";

import { heatEngine } from "@/lib/environmental/heat-engine";
import type { PerformanceContext } from "@/lib/environmental/types";

const marathonContext: PerformanceContext = {
  distanceMeters: 42195,
  actualTimeSeconds: 4 * 3600,
  paceMS: 42195 / (4 * 3600),
};

const fiveKContext: PerformanceContext = {
  distanceMeters: 5000,
  actualTimeSeconds: 1005,
  paceMS: 5000 / 1005,
};

describe("heatEngine.isApplicable", () => {
  it("is applicable whenever temperature is a finite number", () => {
    expect(heatEngine.isApplicable({ tempC: 25 })).toBe(true);
    expect(heatEngine.isApplicable({ tempC: Number.NaN })).toBe(false);
  });
});

describe("heatEngine.compute", () => {
  it("estimates essentially no penalty right at the grid's performance optimum", () => {
    const result = heatEngine.compute({ tempC: 10 }, marathonContext);
    expect(result.adjustmentSeconds).toBeCloseTo(0, 6);
  });

  it("estimates a growing penalty as temperature rises", () => {
    const mild = heatEngine.compute({ tempC: 20 }, marathonContext);
    const hot = heatEngine.compute({ tempC: 32 }, marathonContext);
    expect(hot.adjustmentSeconds).toBeGreaterThan(mild.adjustmentSeconds);
    expect(mild.adjustmentSeconds).toBeGreaterThan(0);
  });

  it("costs proportionally less over a shorter race than a marathon", () => {
    const marathon = heatEngine.compute({ tempC: 30 }, marathonContext);
    const fiveK = heatEngine.compute({ tempC: 30 }, fiveKContext);
    // Compare as a fraction of total time, not raw seconds -- the shorter race's
    // total penalty is smaller in absolute seconds regardless, so the fair
    // comparison is how much of the effort's own duration heat is eating into.
    expect(fiveK.adjustmentSeconds / fiveKContext.actualTimeSeconds).toBeLessThan(
      marathon.adjustmentSeconds / marathonContext.actualTimeSeconds,
    );
  });

  it("always returns a confidence band that straddles the estimate", () => {
    const result = heatEngine.compute({ tempC: 30 }, marathonContext);
    expect(result.confidenceLowSeconds).toBeLessThan(result.adjustmentSeconds);
    expect(result.confidenceHighSeconds).toBeGreaterThan(result.adjustmentSeconds);
  });
});
