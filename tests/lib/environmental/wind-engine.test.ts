import { describe, expect, it } from "vitest";

import { windEngine, type WindEngineInput } from "@/lib/environmental/wind-engine";
import type { PerformanceContext } from "@/lib/environmental/types";

const fiveKContext: PerformanceContext = {
  distanceMeters: 5000,
  actualTimeSeconds: 1200,
  paceMS: 5000 / 1200,
};

const baseInput: WindEngineInput = {
  windSpeedMS: 5,
  windFromBearingDeg: 0,
  runnerHeadingBearingDeg: 0,
  windExposureScore: 50,
  weightKg: 70,
};

describe("windEngine.isApplicable", () => {
  it("is not applicable when there is no wind", () => {
    expect(windEngine.isApplicable({ ...baseInput, windSpeedMS: 0 })).toBe(false);
  });

  it("is applicable when wind speed is positive", () => {
    expect(windEngine.isApplicable(baseInput)).toBe(true);
  });
});

describe("windEngine.compute", () => {
  it("costs time for a direct headwind (wind from the direction you're heading toward)", () => {
    const result = windEngine.compute(baseInput, fiveKContext);
    expect(result.adjustmentSeconds).toBeGreaterThan(0);
  });

  it("saves time for a direct tailwind (wind from behind)", () => {
    const tailwind: WindEngineInput = { ...baseInput, windFromBearingDeg: 180 };
    const result = windEngine.compute(tailwind, fiveKContext);
    expect(result.adjustmentSeconds).toBeLessThan(0);
  });

  it("costs more for a stronger headwind than a weaker one", () => {
    const weak = windEngine.compute(baseInput, fiveKContext);
    const strong = windEngine.compute({ ...baseInput, windSpeedMS: 10 }, fiveKContext);
    expect(strong.adjustmentSeconds).toBeGreaterThan(weak.adjustmentSeconds);
  });

  it("reduces the effective wind for a more sheltered exposure score", () => {
    const open = windEngine.compute({ ...baseInput, windExposureScore: 90 }, fiveKContext);
    const sheltered = windEngine.compute({ ...baseInput, windExposureScore: 5 }, fiveKContext);
    expect(sheltered.adjustmentSeconds).toBeLessThan(open.adjustmentSeconds);
  });

  it("always returns a confidence band straddling the estimate for a nonzero adjustment", () => {
    const result = windEngine.compute(baseInput, fiveKContext);
    expect(result.confidenceLowSeconds).toBeLessThan(result.adjustmentSeconds);
    expect(result.confidenceHighSeconds).toBeGreaterThan(result.adjustmentSeconds);
  });
});
