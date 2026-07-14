import { describe, expect, it } from "vitest";

import {
  CURVE_DISTANCE_M,
  REP_SEGMENTS,
  STRAIGHT_DISTANCE_M,
  TRACK_RADIUS_M,
  solveTrackWindEquivalentSpeedMS,
  type RepType,
} from "@/lib/track-wind-physics";

const WEIGHT_KG = 68;

describe("track geometry", () => {
  it("has a radius matching the World Athletics standard", () => {
    expect(TRACK_RADIUS_M).toBe(36.5);
  });

  it("adds up to a 400m lap", () => {
    expect(2 * CURVE_DISTANCE_M + 2 * STRAIGHT_DISTANCE_M).toBeCloseTo(400, 6);
  });
});

describe("REP_SEGMENTS", () => {
  it("adds up to the named distance for every rep type", () => {
    for (const rep of Object.values(REP_SEGMENTS)) {
      const total =
        (rep.firstCurveLaps + rep.secondCurveLaps) * CURVE_DISTANCE_M +
        (rep.backstretchLaps + rep.homestretchLaps) * STRAIGHT_DISTANCE_M;
      expect(total).toBeCloseTo(rep.distanceM, 6);
    }
  });

  it("gives the 600m and 600m-alt variants different segment coverage", () => {
    // The whole point of "alt" reps: which segment gets skipped differs.
    expect(REP_SEGMENTS["600m"].homestretchLaps).not.toBe(REP_SEGMENTS["600m-alt"].homestretchLaps);
    expect(REP_SEGMENTS["600m"].backstretchLaps).not.toBe(REP_SEGMENTS["600m-alt"].backstretchLaps);
  });
});

describe("solveTrackWindEquivalentSpeedMS", () => {
  const repTypes: RepType[] = ["200m", "200m-alt", "400m", "600m", "600m-alt", "1000m", "1000m-alt"];

  it("is a no-op round trip for every rep type and every case when there is no true wind", () => {
    const speedMS = 6; // roughly 400m in 66.7s
    for (const repType of repTypes) {
      for (const paceOrEffort of ["actual-pace", "calm-day-effort"] as const) {
        for (const speedOrEffort of ["constant-speed", "constant-effort"] as const) {
          const result = solveTrackWindEquivalentSpeedMS({
            speedMS,
            repType,
            trueWindMS: 0,
            windAngleDeg: 0,
            weightKg: WEIGHT_KG,
            paceOrEffort,
            speedOrEffort,
          });
          expect(result).toBeCloseTo(speedMS, 1);
        }
      }
    }
  });

  it("never nets a benefit for a full 400m lap under real wind, any direction (headwind costs more than tailwind saves)", () => {
    const speedMS = 6;
    for (const windAngleDeg of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const equivalent = solveTrackWindEquivalentSpeedMS({
        speedMS,
        repType: "400m",
        trueWindMS: 4,
        windAngleDeg,
        weightKg: WEIGHT_KG,
        paceOrEffort: "actual-pace",
        speedOrEffort: "constant-speed",
      });
      // Running the same actual speed cost more (or equal) power than calm air would,
      // so the calm-air-equivalent speed is always >= the actual speed run.
      expect(equivalent).toBeGreaterThanOrEqual(speedMS - 1e-6);
    }
  });

  it("produces a materially faster calm-air equivalent under a strong wind than a light one", () => {
    const speedMS = 6;
    const light = solveTrackWindEquivalentSpeedMS({
      speedMS,
      repType: "400m",
      trueWindMS: 1,
      windAngleDeg: 0,
      weightKg: WEIGHT_KG,
      paceOrEffort: "actual-pace",
      speedOrEffort: "constant-speed",
    });
    const strong = solveTrackWindEquivalentSpeedMS({
      speedMS,
      repType: "400m",
      trueWindMS: 6,
      windAngleDeg: 0,
      weightKg: WEIGHT_KG,
      paceOrEffort: "actual-pace",
      speedOrEffort: "constant-speed",
    });
    expect(strong).toBeGreaterThan(light);
  });

  it("gives 600m and 600m-alt different results under a strong one-directional wind", () => {
    const speedMS = 6;
    const standard = solveTrackWindEquivalentSpeedMS({
      speedMS,
      repType: "600m",
      trueWindMS: 6,
      windAngleDeg: 0,
      weightKg: WEIGHT_KG,
      paceOrEffort: "actual-pace",
      speedOrEffort: "constant-speed",
    });
    const alt = solveTrackWindEquivalentSpeedMS({
      speedMS,
      repType: "600m-alt",
      trueWindMS: 6,
      windAngleDeg: 0,
      weightKg: WEIGHT_KG,
      paceOrEffort: "actual-pace",
      speedOrEffort: "constant-speed",
    });
    expect(standard).not.toBeCloseTo(alt, 3);
  });

  it("distinguishes constant-effort from constant-speed under real wind", () => {
    const speedMS = 6;
    const constSpeed = solveTrackWindEquivalentSpeedMS({
      speedMS,
      repType: "400m",
      trueWindMS: 4,
      windAngleDeg: 0,
      weightKg: WEIGHT_KG,
      paceOrEffort: "actual-pace",
      speedOrEffort: "constant-speed",
    });
    const constEffort = solveTrackWindEquivalentSpeedMS({
      speedMS,
      repType: "400m",
      trueWindMS: 4,
      windAngleDeg: 0,
      weightKg: WEIGHT_KG,
      paceOrEffort: "actual-pace",
      speedOrEffort: "constant-effort",
    });
    expect(constSpeed).not.toBeCloseTo(constEffort, 3);
  });

  it("case 2 and case 1 are inverse operations for the same wind", () => {
    const actualSpeedMS = 6;
    const windAngleDeg = 30;
    const trueWindMS = 3;

    const calmEquivalent = solveTrackWindEquivalentSpeedMS({
      speedMS: actualSpeedMS,
      repType: "400m",
      trueWindMS,
      windAngleDeg,
      weightKg: WEIGHT_KG,
      paceOrEffort: "actual-pace",
      speedOrEffort: "constant-speed",
    });
    const backToActual = solveTrackWindEquivalentSpeedMS({
      speedMS: calmEquivalent,
      repType: "400m",
      trueWindMS,
      windAngleDeg,
      weightKg: WEIGHT_KG,
      paceOrEffort: "calm-day-effort",
      speedOrEffort: "constant-speed",
    });
    expect(backToActual).toBeCloseTo(actualSpeedMS, 1);
  });

  it("case 4 and case 3 are inverse operations for the same wind", () => {
    const goalCalmSpeedMS = 6;
    const windAngleDeg = 200;
    const trueWindMS = 3;

    const actualPace = solveTrackWindEquivalentSpeedMS({
      speedMS: goalCalmSpeedMS,
      repType: "400m",
      trueWindMS,
      windAngleDeg,
      weightKg: WEIGHT_KG,
      paceOrEffort: "calm-day-effort",
      speedOrEffort: "constant-effort",
    });
    const backToCalm = solveTrackWindEquivalentSpeedMS({
      speedMS: actualPace,
      repType: "400m",
      trueWindMS,
      windAngleDeg,
      weightKg: WEIGHT_KG,
      paceOrEffort: "actual-pace",
      speedOrEffort: "constant-effort",
    });
    expect(backToCalm).toBeCloseTo(goalCalmSpeedMS, 1);
  });
});
