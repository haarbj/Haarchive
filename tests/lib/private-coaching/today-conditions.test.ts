import { describe, expect, it } from "vitest";

import { conditionsAdjustedPaceSPerMi, heatCautionFor, peakHeatReading } from "@/lib/private-coaching/today-conditions";
import { heatEngine } from "@/lib/environmental/heat-engine";
import { humidityEngine } from "@/lib/environmental/humidity-engine";
import { combineAdjustments, predictedActualTime } from "@/lib/environmental/combine";
import { estimateWBGT, heatZoneFor, heatGuidance } from "@/lib/heat-physics";
import type { WeatherConditions } from "@/lib/environmental/fetch-weather-conditions";
import { MILE_METERS } from "@/lib/race-distances";

function conditions(overrides: Partial<WeatherConditions> = {}): WeatherConditions {
  return {
    tempC: 15,
    relativeHumidityPct: 40,
    dewPointC: 5,
    cloudCoverPct: 20,
    pressureHPa: 1013,
    windSpeedMS: 2,
    windFromBearingDeg: 90,
    windGustsMS: 3,
    elevationM: 100,
    source: "forecast",
    ...overrides,
  };
}

const CALM_COOL = conditions();
const HOT_HUMID = conditions({ tempC: 29, relativeHumidityPct: 70 });

describe("conditionsAdjustedPaceSPerMi -- composition correctness", () => {
  it("equals a direct engine call with the same conditions + target (heat+humidity only, via combine.ts's own Predict mode)", () => {
    const targetPaceSPerMi = 370; // 6:10/mi
    const adjusted = conditionsAdjustedPaceSPerMi(targetPaceSPerMi, HOT_HUMID);

    const context = { distanceMeters: MILE_METERS, actualTimeSeconds: targetPaceSPerMi, paceMS: MILE_METERS / targetPaceSPerMi };
    const heatInput = { tempC: HOT_HUMID.tempC };
    const humidityInput = { tempC: HOT_HUMID.tempC, relativeHumidityPct: HOT_HUMID.relativeHumidityPct };
    const results = [heatEngine.compute(heatInput, context), humidityEngine.compute(humidityInput, context)];
    const expected = predictedActualTime(targetPaceSPerMi, combineAdjustments(results)).estimateSeconds;

    expect(adjusted).toBeCloseTo(expected, 6);
  });

  it("a calm, cool day leaves the target pace essentially unchanged", () => {
    const adjusted = conditionsAdjustedPaceSPerMi(370, CALM_COOL);
    expect(adjusted).toBeCloseTo(370, 0);
  });

  it("a hot, humid day makes the same effort slower (a larger seconds/mile number), never faster", () => {
    const adjusted = conditionsAdjustedPaceSPerMi(370, HOT_HUMID);
    expect(adjusted).toBeGreaterThan(370);
  });

  it("matches the task's own worked example in direction and rough magnitude: ~6:10/mi becomes slower in 84°F heat", () => {
    // 84°F ~= 28.9°C
    const adjusted = conditionsAdjustedPaceSPerMi(370, conditions({ tempC: 28.9, relativeHumidityPct: 50 }));
    expect(adjusted).toBeGreaterThan(370);
    expect(adjusted).toBeLessThan(430); // sanity bound -- not an absurd blowup
  });
});

describe("heatCautionFor -- reuses heat-tracker.tsx's own materiality threshold, never a new one", () => {
  it("null on a calm, cool day -- heatGuidance's own raceTip is unset below the threshold", () => {
    expect(heatCautionFor(CALM_COOL)).toBeNull();
  });

  it("non-null once conditions cross the exact same threshold heatGuidance uses for its own raceTip", () => {
    const result = heatCautionFor(HOT_HUMID);
    const wbgtC = estimateWBGT(HOT_HUMID.tempC, HOT_HUMID.relativeHumidityPct);
    const expectedGuidance = heatGuidance(wbgtC, heatZoneFor(wbgtC).name);
    expect(expectedGuidance.raceTip).toBeDefined();
    expect(result).toEqual(expectedGuidance);
  });

  it("boundary: mild heat below the 60°F impair threshold stays null even though it's technically the 'yellow' zone", () => {
    // ~58°F, upper edge of ideal -- heatGuidance's own "still comfortable" branch, no raceTip.
    const result = heatCautionFor(conditions({ tempC: 14.4, relativeHumidityPct: 40 }));
    expect(result).toBeNull();
  });
});

describe("peakHeatReading", () => {
  it("picks the hottest of several readings, not the first or the average", () => {
    const readings = [conditions({ tempC: 18 }), conditions({ tempC: 29 }), conditions({ tempC: 22 })];
    expect(peakHeatReading(readings)?.tempC).toBe(29);
  });

  it("null for an empty list", () => {
    expect(peakHeatReading([])).toBeNull();
  });

  it("a single reading is its own peak", () => {
    expect(peakHeatReading([conditions({ tempC: 20 })])?.tempC).toBe(20);
  });
});
