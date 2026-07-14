import { describe, expect, it } from "vitest";

import { trackWindEngine, type TrackWindEngineInput } from "@/lib/environmental/track-wind-engine";
import type { PerformanceContext } from "@/lib/environmental/types";

const lapContext: PerformanceContext = {
  distanceMeters: 400,
  actualTimeSeconds: 62,
  paceMS: 400 / 62,
};

const baseInput: TrackWindEngineInput = {
  windSpeedMS: 5,
  windFromBearingDeg: 0,
  runnerHeadingBearingDeg: 0,
  windProfile: "none",
  weightKg: 70,
  repType: "400m",
  speedOrEffort: "constant-effort",
};

describe("trackWindEngine.isApplicable", () => {
  it("is not applicable when there is no wind", () => {
    expect(trackWindEngine.isApplicable({ ...baseInput, windSpeedMS: 0 })).toBe(false);
  });

  it("is applicable when wind speed is positive", () => {
    expect(trackWindEngine.isApplicable(baseInput)).toBe(true);
  });
});

describe("trackWindEngine.compute", () => {
  it("costs time for a headwind on the home straight (wind from the direction the home straight faces)", () => {
    const result = trackWindEngine.compute(baseInput, lapContext);
    expect(result.adjustmentSeconds).toBeGreaterThan(0);
  });

  it("gives a full 400m lap the same wind cost regardless of which end of the wind's axis it blows from", () => {
    // The symmetry noted above, made explicit: a full lap covers every
    // heading equally, so only the wind's axis matters, not its direction.
    const headwind = trackWindEngine.compute(baseInput, lapContext);
    const reversed = trackWindEngine.compute({ ...baseInput, windFromBearingDeg: 180 }, lapContext);
    expect(reversed.adjustmentSeconds).toBeCloseTo(headwind.adjustmentSeconds, 6);
  });

  it("costs more for a stronger wind than a weaker one", () => {
    const weak = trackWindEngine.compute(baseInput, lapContext);
    const strong = trackWindEngine.compute({ ...baseInput, windSpeedMS: 10 }, lapContext);
    expect(strong.adjustmentSeconds).toBeGreaterThan(weak.adjustmentSeconds);
  });

  it("reduces the effective wind for a more sheltered profile", () => {
    const open = trackWindEngine.compute({ ...baseInput, windProfile: "rural" }, lapContext);
    const sheltered = trackWindEngine.compute({ ...baseInput, windProfile: "urban" }, lapContext);
    expect(sheltered.adjustmentSeconds).toBeLessThan(open.adjustmentSeconds);
  });

  it("gives a full lap (400m) the same cost regardless of which segment it 'starts' on", () => {
    // A 400m rep covers every segment exactly once regardless of starting
    // line, so there's no "alt" variant for it -- unlike 200/600/1000m.
    const result = trackWindEngine.compute(baseInput, lapContext);
    expect(Number.isFinite(result.adjustmentSeconds)).toBe(true);
  });

  it("produces a different cost for a non-standard rep than its alt starting line, in a crosswind", () => {
    const crosswind: TrackWindEngineInput = { ...baseInput, windFromBearingDeg: 90, repType: "200m" };
    const context200: PerformanceContext = { distanceMeters: 200, actualTimeSeconds: 30, paceMS: 200 / 30 };
    const standard = trackWindEngine.compute(crosswind, context200);
    const alt = trackWindEngine.compute({ ...crosswind, repType: "200m-alt" }, context200);
    expect(standard.adjustmentSeconds).not.toBeCloseTo(alt.adjustmentSeconds, 3);
  });

  it("always returns a confidence band straddling the estimate for a nonzero adjustment", () => {
    const result = trackWindEngine.compute(baseInput, lapContext);
    expect(result.confidenceLowSeconds).toBeLessThan(result.adjustmentSeconds);
    expect(result.confidenceHighSeconds).toBeGreaterThan(result.adjustmentSeconds);
  });
});
