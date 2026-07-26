import { describe, expect, it } from "vitest";

import {
  computeReferencePaceSeconds,
  computeWorkoutPaceSeconds,
  convertPaceSeconds,
  paceSecondsToSpeed,
} from "@/lib/pace-percent-math";

describe("computeWorkoutPaceSeconds (percent of pace)", () => {
  it("matches the README's worked examples", () => {
    // 90% of 5:00 mile pace is 5:30; 80% of 5:00 is 6:00.
    expect(computeWorkoutPaceSeconds(5 * 60, 90, "pace")).toBeCloseTo(5.5 * 60, 5);
    expect(computeWorkoutPaceSeconds(5 * 60, 80, "pace")).toBeCloseTo(6 * 60, 5);
  });

  it("is linear and symmetric in pace units -- every 10% step is a fixed offset", () => {
    const ref = 5 * 60;
    const step90 = computeWorkoutPaceSeconds(ref, 90, "pace");
    const step80 = computeWorkoutPaceSeconds(ref, 80, "pace");
    const step70 = computeWorkoutPaceSeconds(ref, 70, "pace");
    expect(step80 - step90).toBeCloseTo(step90 - ref, 5);
    expect(step70 - step80).toBeCloseTo(step80 - step90, 5);
  });

  it("100% of pace returns the reference pace unchanged", () => {
    expect(computeWorkoutPaceSeconds(312, 100, "pace")).toBeCloseTo(312, 5);
  });
});

describe("computeReferencePaceSeconds (percent of pace, reverse mode)", () => {
  it("is the exact algebraic inverse of the forward formula", () => {
    // The README's own worked reverse-mode example (5:24 at 90% -> "4:52")
    // doesn't actually satisfy the tool's own forward formula (324 / 1.1 =
    // 294.55s = 4:54.5, not 4:52) -- a documentation slip in the source
    // repo, not a different formula. Trust the formula, verified against
    // every *other* stated example (90% of 5:00 = 5:30, 80% of 5:00 = 6:00).
    const refSeconds = computeReferencePaceSeconds(5 * 60 + 24, 90, "pace");
    expect(refSeconds).toBeCloseTo(294.545, 2);
  });

  it("round-trips with computeWorkoutPaceSeconds", () => {
    const ref = 312;
    const pct = 87;
    const workout = computeWorkoutPaceSeconds(ref, pct, "pace");
    expect(computeReferencePaceSeconds(workout, pct, "pace")).toBeCloseTo(ref, 5);
  });
});

describe("percent of speed", () => {
  it("is the simple inverse-proportion formula, distinct from percent of pace", () => {
    // 90% of speed at a 5:00 reference pace is NOT 5:30 (that's percent of pace) --
    // it's ref / 0.9.
    const ref = 5 * 60;
    expect(computeWorkoutPaceSeconds(ref, 90, "speed")).toBeCloseTo(ref / 0.9, 5);
    expect(computeWorkoutPaceSeconds(ref, 90, "speed")).not.toBeCloseTo(
      computeWorkoutPaceSeconds(ref, 90, "pace"),
      1,
    );
  });

  it("round-trips with computeReferencePaceSeconds", () => {
    const ref = 275;
    const pct = 105;
    const workout = computeWorkoutPaceSeconds(ref, pct, "speed");
    expect(computeReferencePaceSeconds(workout, pct, "speed")).toBeCloseTo(ref, 5);
  });
});

describe("convertPaceSeconds", () => {
  it("converts mile pace to km pace", () => {
    // 8:00/mi is about 4:58.4/km.
    expect(convertPaceSeconds(8 * 60, "mi", "km")).toBeCloseTo(298.4, 0);
  });

  it("converts km pace to 400m split", () => {
    // A 5:00/km pace is a 2:00/400m split.
    expect(convertPaceSeconds(5 * 60, "km", "400m")).toBeCloseTo(2 * 60, 5);
  });

  it("is its own inverse", () => {
    const seconds = 337;
    const roundTrip = convertPaceSeconds(convertPaceSeconds(seconds, "mi", "400m"), "400m", "mi");
    expect(roundTrip).toBeCloseTo(seconds, 5);
  });

  it("same-unit conversion is a no-op", () => {
    expect(convertPaceSeconds(400, "km", "km")).toBeCloseTo(400, 10);
  });
});

describe("paceSecondsToSpeed", () => {
  it("converts an 8:00/mi pace to roughly 7.5 mph", () => {
    expect(paceSecondsToSpeed(8 * 60, "mi", "mph")).toBeCloseTo(7.5, 1);
  });

  it("converts a 4:00/km pace to 15 km/h", () => {
    expect(paceSecondsToSpeed(4 * 60, "km", "kph")).toBeCloseTo(15, 5);
  });

  it("converts a 4:00/km pace to roughly 4.17 m/s", () => {
    expect(paceSecondsToSpeed(4 * 60, "km", "mps")).toBeCloseTo(4.17, 2);
  });
});
