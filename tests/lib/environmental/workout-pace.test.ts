import { describe, expect, it } from "vitest";

import {
  perUnitAdjustmentSeconds,
  resolveWorkoutBout,
  scaleResultsPerUnit,
  trainingGuidance,
} from "@/lib/environmental/workout-pace";
import type { EngineResult } from "@/lib/environmental/types";

const MILE_M = 1609.344;

describe("resolveWorkoutBout", () => {
  it("derives time from pace and distance", () => {
    // 4 miles at a 7:00/mi pace -> 28:00 total.
    const result = resolveWorkoutBout(420, MILE_M, "distance", 4, null);
    expect(result).not.toBeNull();
    expect(result!.distanceMeters).toBeCloseTo(4 * MILE_M, 3);
    expect(result!.timeSeconds).toBeCloseTo(1680, 3);
  });

  it("derives distance from pace and duration", () => {
    // 7:00/mi pace held for 28:00 -> 4 miles.
    const result = resolveWorkoutBout(420, MILE_M, "duration", null, 1680);
    expect(result).not.toBeNull();
    expect(result!.distanceMeters / MILE_M).toBeCloseTo(4, 6);
    expect(result!.timeSeconds).toBe(1680);
  });

  it("returns null when pace is missing or non-positive", () => {
    expect(resolveWorkoutBout(null, MILE_M, "distance", 4, null)).toBeNull();
    expect(resolveWorkoutBout(0, MILE_M, "distance", 4, null)).toBeNull();
    expect(resolveWorkoutBout(-10, MILE_M, "distance", 4, null)).toBeNull();
  });

  it("returns null when the relevant distance/duration value is missing", () => {
    expect(resolveWorkoutBout(420, MILE_M, "distance", null, null)).toBeNull();
    expect(resolveWorkoutBout(420, MILE_M, "duration", null, null)).toBeNull();
  });
});

describe("perUnitAdjustmentSeconds", () => {
  it("divides a total adjustment by the number of distance units", () => {
    expect(perUnitAdjustmentSeconds(40, 4 * MILE_M, MILE_M)).toBeCloseTo(10, 6);
  });

  it("returns 0 for a zero-distance bout rather than dividing by zero", () => {
    expect(perUnitAdjustmentSeconds(40, 0, MILE_M)).toBe(0);
  });
});

describe("scaleResultsPerUnit", () => {
  const results: EngineResult[] = [
    { factor: "Heat", adjustmentSeconds: 20, confidenceLowSeconds: 14, confidenceHighSeconds: 26, summary: "" },
    { factor: "Wind", adjustmentSeconds: 8, confidenceLowSeconds: 6, confidenceHighSeconds: 10, summary: "" },
  ];

  it("scales every result's seconds fields down to a per-unit figure", () => {
    const scaled = scaleResultsPerUnit(results, 4 * MILE_M, MILE_M);
    expect(scaled[0].adjustmentSeconds).toBeCloseTo(5, 6);
    expect(scaled[0].confidenceLowSeconds).toBeCloseTo(3.5, 6);
    expect(scaled[1].adjustmentSeconds).toBeCloseTo(2, 6);
  });

  it("preserves factor and summary fields unchanged", () => {
    const scaled = scaleResultsPerUnit(results, 4 * MILE_M, MILE_M);
    expect(scaled[0].factor).toBe("Heat");
    expect(scaled[1].factor).toBe("Wind");
  });

  it("returns results unchanged for a zero-distance bout", () => {
    expect(scaleResultsPerUnit(results, 0, MILE_M)).toBe(results);
  });
});

describe("trainingGuidance", () => {
  it("recommends slowing down for a positive adjustment", () => {
    const text = trainingGuidance("lactate threshold", "Drift risk.", 10, "mile");
    expect(text).toContain("Slowing down");
    expect(text).toContain("10s per mile");
  });

  it("recommends speeding up for a negative adjustment", () => {
    const text = trainingGuidance("lactate threshold", "Drift risk.", -6, "mile");
    expect(text).toContain("Speeding up");
    expect(text).toContain("6s per mile");
  });

  it("notes negligible impact for a near-zero adjustment", () => {
    const text = trainingGuidance("lactate threshold", "Drift risk.", 0.4, "mile");
    expect(text).toMatch(/little effect/i);
  });
});
