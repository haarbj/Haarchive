import { describe, expect, it } from "vitest";

import { calculatePaceCalculatorTrainingPaces, marathonRangeSeconds, predictSeconds } from "@/lib/pace-calculator-math";

describe("predictSeconds (Riegel's power-law formula)", () => {
  it("predicts a longer time for a longer target distance", () => {
    const seconds = predictSeconds(5000, 18 * 60, 10000);
    expect(seconds).toBeGreaterThan(18 * 60);
  });

  it("returns the known time unchanged when target equals known distance", () => {
    expect(predictSeconds(5000, 18 * 60, 5000)).toBeCloseTo(18 * 60, 5);
  });
});

describe("marathonRangeSeconds", () => {
  it("widens more for a performance further from marathon distance", () => {
    const fromMile = marathonRangeSeconds(3 * 3600, 1609.344);
    const fromHalf = marathonRangeSeconds(3 * 3600, 21097.5);
    const mileSpread = fromMile[1] - fromMile[0];
    const halfSpread = fromHalf[1] - fromHalf[0];
    expect(mileSpread).toBeGreaterThan(halfSpread);
  });
});

describe("calculatePaceCalculatorTrainingPaces", () => {
  const FIVE_K_METERS = 5000;
  const FIVE_K_SECONDS = 18 * 60;

  it("derives Easy as XC 5K pace + 1:30-2:30/mi, matching the standalone calculator's own derivation", () => {
    const paces = calculatePaceCalculatorTrainingPaces(FIVE_K_METERS, FIVE_K_SECONDS, "track", 0.95);
    const xcFiveKPace = paces.vo2OrientedPaceSecPerMile;
    expect(paces.easyPaceRange).toEqual([xcFiveKPace + 90, xcFiveKPace + 150]);
  });

  it("derives Tempo/Threshold as XC 5K pace / 0.93", () => {
    const paces = calculatePaceCalculatorTrainingPaces(FIVE_K_METERS, FIVE_K_SECONDS, "track", 0.95);
    expect(paces.tempoThresholdPaceSecPerMile).toBeCloseTo(paces.vo2OrientedPaceSecPerMile / 0.93, 6);
  });

  it("for an XC input, does not reverse-adjust the XC-anchor (xcAnchorSeconds === raceSeconds)", () => {
    const xcPaces = calculatePaceCalculatorTrainingPaces(FIVE_K_METERS, FIVE_K_SECONDS, "xc", 0.95);
    const trackPaces = calculatePaceCalculatorTrainingPaces(FIVE_K_METERS, FIVE_K_SECONDS, "track", 0.95);
    // A track input is reverse-adjusted (divided by 0.95) before being
    // treated as an XC-equivalent effort, so it predicts a SLOWER XC-5K
    // pace (bigger seconds) than treating the same raw time as already XC.
    expect(trackPaces.vo2OrientedPaceSecPerMile).toBeGreaterThan(xcPaces.vo2OrientedPaceSecPerMile);
  });

  it("marathon pace range midpoint matches marathonPaceMidSecPerMile", () => {
    const paces = calculatePaceCalculatorTrainingPaces(FIVE_K_METERS, FIVE_K_SECONDS, "track", 0.95);
    expect(paces.marathonPaceMidSecPerMile).toBeCloseTo(
      (paces.marathonPaceRange[0] + paces.marathonPaceRange[1]) / 2,
      6,
    );
  });
});
