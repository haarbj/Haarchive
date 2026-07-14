import { describe, expect, it } from "vitest";

import { elevationEngine } from "@/lib/environmental/elevation-engine";
import type { PerformanceContext } from "@/lib/environmental/types";

const tenKContext: PerformanceContext = {
  distanceMeters: 10000,
  actualTimeSeconds: 2400,
  paceMS: 10000 / 2400,
};

describe("elevationEngine.isApplicable", () => {
  it("is not applicable on a perfectly flat course", () => {
    expect(elevationEngine.isApplicable({ elevationGainM: 0, elevationLossM: 0 })).toBe(false);
  });

  it("is applicable with any gain or loss", () => {
    expect(elevationEngine.isApplicable({ elevationGainM: 50, elevationLossM: 0 })).toBe(true);
    expect(elevationEngine.isApplicable({ elevationGainM: 0, elevationLossM: 50 })).toBe(true);
  });
});

describe("elevationEngine.compute", () => {
  it("costs time for a course that's pure climbing", () => {
    const result = elevationEngine.compute({ elevationGainM: 100, elevationLossM: 0 }, tenKContext);
    expect(result.adjustmentSeconds).toBeGreaterThan(0);
  });

  it("nets out to a smaller benefit than the cost of the same gain, for equal gain and loss", () => {
    const climbOnly = elevationEngine.compute({ elevationGainM: 100, elevationLossM: 0 }, tenKContext);
    const climbAndDescend = elevationEngine.compute({ elevationGainM: 100, elevationLossM: 100 }, tenKContext);
    // Descending the same 100m recovers only part of the climb's cost, per Minetti's asymmetry --
    // so the round-trip course still costs more time than a flat one, just less than pure climbing.
    expect(climbAndDescend.adjustmentSeconds).toBeGreaterThan(0);
    expect(climbAndDescend.adjustmentSeconds).toBeLessThan(climbOnly.adjustmentSeconds);
  });

  it("scales with the amount of gain", () => {
    const small = elevationEngine.compute({ elevationGainM: 50, elevationLossM: 0 }, tenKContext);
    const large = elevationEngine.compute({ elevationGainM: 200, elevationLossM: 0 }, tenKContext);
    expect(large.adjustmentSeconds).toBeGreaterThan(small.adjustmentSeconds);
  });

  it("matches a hand-verified reference value for equal gain and loss (regression guard)", () => {
    // Verified independently against gradeAddedCostJPerKgM(+/-0.06) and
    // flatPowerWPerKg at this pace -- net ~+35s, not the ~-59s an earlier,
    // buggier equivalent-flat-speed formulation produced for this same
    // input (see the module comment on why that approach was wrong).
    const result = elevationEngine.compute({ elevationGainM: 100, elevationLossM: 100 }, tenKContext);
    expect(result.adjustmentSeconds).toBeCloseTo(34.9, 0);
  });
});
