import { describe, expect, it } from "vitest";

import { routeWindEngine, type RouteWindEngineInput } from "@/lib/environmental/route-wind-engine";
import type { PerformanceContext } from "@/lib/environmental/types";

const context: PerformanceContext = {
  distanceMeters: 5000,
  actualTimeSeconds: 1200,
  paceMS: 5000 / 1200,
};

const baseInput: RouteWindEngineInput = {
  windSpeedMS: 5,
  windFromBearingDeg: 90,
  windExposureScore: 50,
  weightKg: 70,
  speedOrEffort: "constant-effort",
  headingSegments: [{ headingBearingDeg: 90, distanceM: 5000 }], // heading east, wind from the east -> headwind
};

describe("routeWindEngine.isApplicable", () => {
  it("is not applicable when there is no wind", () => {
    expect(routeWindEngine.isApplicable({ ...baseInput, windSpeedMS: 0 })).toBe(false);
  });

  it("is not applicable when there are no heading segments (e.g. an indoor/treadmill file with no GPS)", () => {
    expect(routeWindEngine.isApplicable({ ...baseInput, headingSegments: [] })).toBe(false);
  });

  it("is applicable with wind and at least one segment", () => {
    expect(routeWindEngine.isApplicable(baseInput)).toBe(true);
  });
});

describe("routeWindEngine.compute", () => {
  it("costs time for a headwind", () => {
    const result = routeWindEngine.compute(baseInput, context);
    expect(result.adjustmentSeconds).toBeGreaterThan(0);
  });

  it("saves time for a tailwind", () => {
    const tailwind: RouteWindEngineInput = { ...baseInput, windFromBearingDeg: 270 };
    const result = routeWindEngine.compute(tailwind, context);
    expect(result.adjustmentSeconds).toBeLessThan(0);
  });

  it("costs more for a stronger wind than a weaker one", () => {
    const weak = routeWindEngine.compute(baseInput, context);
    const strong = routeWindEngine.compute({ ...baseInput, windSpeedMS: 10 }, context);
    expect(strong.adjustmentSeconds).toBeGreaterThan(weak.adjustmentSeconds);
  });

  it("reduces the effective wind for a more sheltered exposure score", () => {
    const open = routeWindEngine.compute({ ...baseInput, windExposureScore: 90 }, context);
    const sheltered = routeWindEngine.compute({ ...baseInput, windExposureScore: 5 }, context);
    expect(sheltered.adjustmentSeconds).toBeLessThan(open.adjustmentSeconds);
  });

  it("accounts for a route that changes direction, unlike a single fixed heading", () => {
    // A route that heads east then west (an out-and-back) experiences both
    // a headwind and a tailwind leg for the same wind -- different from a
    // route that holds one heading the entire way.
    const outAndBack: RouteWindEngineInput = {
      ...baseInput,
      headingSegments: [
        { headingBearingDeg: 90, distanceM: 2500 },
        { headingBearingDeg: 270, distanceM: 2500 },
      ],
    };
    const oneWay = routeWindEngine.compute(baseInput, context);
    const roundTrip = routeWindEngine.compute(outAndBack, context);
    expect(roundTrip.adjustmentSeconds).not.toBeCloseTo(oneWay.adjustmentSeconds, 3);
  });

  it("always returns a confidence band straddling the estimate for a nonzero adjustment", () => {
    const result = routeWindEngine.compute(baseInput, context);
    expect(result.confidenceLowSeconds).toBeLessThan(result.adjustmentSeconds);
    expect(result.confidenceHighSeconds).toBeGreaterThan(result.adjustmentSeconds);
  });
});
