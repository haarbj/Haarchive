import { describe, expect, it } from "vitest";

import { humidityEngine } from "@/lib/environmental/humidity-engine";
import type { PerformanceContext } from "@/lib/environmental/types";

const marathonContext: PerformanceContext = {
  distanceMeters: 42195,
  actualTimeSeconds: 4 * 3600,
  paceMS: 42195 / (4 * 3600),
};

describe("humidityEngine.isApplicable", () => {
  it("requires both temperature and humidity to be finite", () => {
    expect(humidityEngine.isApplicable({ tempC: 25, relativeHumidityPct: 60 })).toBe(true);
    expect(humidityEngine.isApplicable({ tempC: Number.NaN, relativeHumidityPct: 60 })).toBe(false);
  });
});

describe("humidityEngine.compute", () => {
  it("estimates essentially no marginal effect right at the dry-air reference humidity", () => {
    const result = humidityEngine.compute({ tempC: 30, relativeHumidityPct: 30 }, marathonContext);
    expect(result.adjustmentSeconds).toBeCloseTo(0, 6);
  });

  it("estimates a growing penalty as humidity rises above the dry-air reference", () => {
    const moderate = humidityEngine.compute({ tempC: 30, relativeHumidityPct: 60 }, marathonContext);
    const humid = humidityEngine.compute({ tempC: 30, relativeHumidityPct: 90 }, marathonContext);
    expect(humid.adjustmentSeconds).toBeGreaterThan(moderate.adjustmentSeconds);
    expect(moderate.adjustmentSeconds).toBeGreaterThan(0);
  });

  it("estimates a benefit when humidity is well below the dry-air reference", () => {
    // Real desert-dry air (well under the 30% reference) genuinely evaporates
    // sweat better than the reference condition -- this is a legitimate
    // negative ("benefit") value, not a bug, and is what keeps Heat +
    // Humidity mathematically equal to the full empirical effect below.
    const result = humidityEngine.compute({ tempC: 30, relativeHumidityPct: 5 }, marathonContext);
    expect(result.adjustmentSeconds).toBeLessThan(0);
  });

  it("does not double-count what heatEngine already attributes to dry heat", async () => {
    const { heatEngine } = await import("@/lib/environmental/heat-engine");
    const { logspeedAdjustment } = await import("@/lib/environmental/heat-humidity-model");
    const { secondsFromLogspeedAdjustment } = await import("@/lib/environmental/heat-model");

    const tempC = 28;
    const rh = 70;
    const heat = heatEngine.compute({ tempC }, marathonContext);
    const humidity = humidityEngine.compute({ tempC, relativeHumidityPct: rh }, marathonContext);

    const fullAdjustment = logspeedAdjustment(tempC, rh);
    const fullEffect = secondsFromLogspeedAdjustment(fullAdjustment, marathonContext);

    expect(heat.adjustmentSeconds + humidity.adjustmentSeconds).toBeCloseTo(fullEffect, 6);
  });
});
