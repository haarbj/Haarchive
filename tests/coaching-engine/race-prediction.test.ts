import { describe, expect, it } from "vitest";
import { predictRaceTime } from "@/lib/coaching-engine/race-prediction";

describe("predictRaceTime", () => {
  it("returns the same time when target equals known distance", () => {
    expect(predictRaceTime(5000, 1200, 5000)).toBe(1200);
  });

  it("predicts a slower time for a longer target distance", () => {
    const marathonPrediction = predictRaceTime(10000, 2400, 42195);
    expect(marathonPrediction).toBeGreaterThan(2400);
  });

  it("predicts a faster time for a shorter target distance", () => {
    const fiveKPrediction = predictRaceTime(10000, 2400, 5000);
    expect(fiveKPrediction).toBeLessThan(2400);
  });

  it("matches the Riegel formula exactly", () => {
    const knownMeters = 10000;
    const knownSeconds = 2400;
    const targetMeters = 21097;
    const expected = knownSeconds * Math.pow(targetMeters / knownMeters, 1.06);
    expect(predictRaceTime(knownMeters, knownSeconds, targetMeters)).toBeCloseTo(expected, 6);
  });
});
