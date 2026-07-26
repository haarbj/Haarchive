import { describe, expect, it } from "vitest";

import {
  customDistanceToMeters,
  speedMSFromDistanceAndTime,
  timeSecondsFromDistanceAndSpeed,
} from "@/lib/race-pace-math";

describe("speedMSFromDistanceAndTime / timeSecondsFromDistanceAndSpeed", () => {
  it("matches the source tool's own worked default: 21:45 for 5K is (almost exactly) 7:00/mi", () => {
    const speedMS = speedMSFromDistanceAndTime(5000, 21 * 60 + 45);
    const milePaceSeconds = timeSecondsFromDistanceAndSpeed(1609.344, speedMS);
    expect(milePaceSeconds).toBeCloseTo(7 * 60, 0);
  });

  it("round-trips: computing pace then computing race time from that pace returns the original time", () => {
    const distanceMeters = 10000;
    const raceTimeSeconds = 42 * 60 + 17;
    const speedMS = speedMSFromDistanceAndTime(distanceMeters, raceTimeSeconds);
    const recoveredTime = timeSecondsFromDistanceAndSpeed(distanceMeters, speedMS);
    expect(recoveredTime).toBeCloseTo(raceTimeSeconds, 8);
  });

  it("a faster (lower) time produces a higher speed", () => {
    const fastSpeed = speedMSFromDistanceAndTime(5000, 15 * 60);
    const slowSpeed = speedMSFromDistanceAndTime(5000, 25 * 60);
    expect(fastSpeed).toBeGreaterThan(slowSpeed);
  });

  it("converts a marathon pace of 8:00/mi into a marathon finish time of roughly 3:29:45", () => {
    const speedMS = speedMSFromDistanceAndTime(1609.344, 8 * 60);
    const marathonSeconds = timeSecondsFromDistanceAndSpeed(42195, speedMS);
    expect(marathonSeconds).toBeCloseTo(3 * 3600 + 29 * 60 + 45, 0);
  });
});

describe("customDistanceToMeters", () => {
  it("passes meters through unchanged", () => {
    expect(customDistanceToMeters(500, "m")).toBe(500);
  });

  it("converts yards using the exact 0.9144 m/yard constant", () => {
    // A 440-yard split (a historically common indoor-track distance).
    expect(customDistanceToMeters(440, "yd")).toBeCloseTo(402.336, 5);
  });

  it("converts km and mi", () => {
    expect(customDistanceToMeters(1.5, "km")).toBe(1500);
    expect(customDistanceToMeters(0.8, "mi")).toBeCloseTo(1287.475, 3);
  });
});
