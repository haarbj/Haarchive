import { describe, expect, it } from "vitest";

import { buildSavedAnalysis } from "@/lib/environmental/saved-analysis";

const baseParams = {
  courseType: "road" as const,
  goalMode: "analyze" as const,
  workoutType: "easy" as const,
  distanceMeters: 5000,
  actualTimeSeconds: 1500,
  equivalentTimeSeconds: 1480,
  equivalentLowSeconds: 1470,
  equivalentHighSeconds: 1490,
  conditions: {
    tempC: 20,
    relativeHumidityPct: 50,
    windSpeedMS: 3,
    windFromBearingDeg: 180,
    windExposureScore: 25,
    elevationGainM: 10,
    elevationLossM: 10,
  },
  confidenceLevel: "high" as const,
};

describe("buildSavedAnalysis", () => {
  it("stamps a schema version for future migrations", () => {
    const saved = buildSavedAnalysis({ ...baseParams, breakdown: [], recordedAtIso: null });
    expect(saved.schemaVersion).toBe(1);
  });

  it("ranks the breakdown by impact and identifies the dominant factor", () => {
    const saved = buildSavedAnalysis({
      ...baseParams,
      breakdown: [
        { factor: "Heat", adjustmentSeconds: 2 },
        { factor: "Elevation", adjustmentSeconds: -14 },
        { factor: "Wind", adjustmentSeconds: 5 },
      ],
      recordedAtIso: null,
    });
    expect(saved.breakdown.map((f) => f.factor)).toEqual(["Elevation", "Wind", "Heat"]);
    expect(saved.dominantFactor).toBe("Elevation");
  });

  it("has a null dominant factor when there's no breakdown", () => {
    const saved = buildSavedAnalysis({ ...baseParams, breakdown: [], recordedAtIso: null });
    expect(saved.dominantFactor).toBeNull();
  });

  it("uses the provided recordedAtIso when given, falling back to now otherwise", () => {
    const withTimestamp = buildSavedAnalysis({ ...baseParams, breakdown: [], recordedAtIso: "2026-01-01T00:00:00.000Z" });
    expect(withTimestamp.recordedAtIso).toBe("2026-01-01T00:00:00.000Z");

    const withoutTimestamp = buildSavedAnalysis({ ...baseParams, breakdown: [], recordedAtIso: null });
    expect(() => new Date(withoutTimestamp.recordedAtIso)).not.toThrow();
    expect(Number.isNaN(new Date(withoutTimestamp.recordedAtIso).getTime())).toBe(false);
  });

  it("passes through a null conditions object unchanged", () => {
    const saved = buildSavedAnalysis({ ...baseParams, conditions: null, breakdown: [], recordedAtIso: null });
    expect(saved.conditions).toBeNull();
  });
});
