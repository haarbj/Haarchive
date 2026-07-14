import { describe, expect, it } from "vitest";

import { inferWorkoutType } from "@/lib/environmental/infer-workout-type";

describe("inferWorkoutType", () => {
  it("matches a race title with high confidence", () => {
    const guess = inferWorkoutType({ title: "Saturday 5K Race", distanceMeters: 5000 });
    expect(guess.type).toBe("race");
    expect(guess.confidence).toBe("high");
  });

  it("matches marathon before easy when both could apply", () => {
    const guess = inferWorkoutType({ title: "Easy Marathon Shakeout", distanceMeters: 3000 });
    expect(guess.type).toBe("marathon-pace");
  });

  it("matches interval-style keywords", () => {
    expect(inferWorkoutType({ title: "6x800m Interval Session", distanceMeters: 8000 }).type).toBe("intervals");
  });

  it("falls back to distance when there is no title match", () => {
    const guess = inferWorkoutType({ title: null, distanceMeters: 41000 });
    expect(guess.type).toBe("marathon-pace");
    expect(guess.confidence).toBe("medium");
  });

  it("infers a long run from distance alone", () => {
    const guess = inferWorkoutType({ title: null, distanceMeters: 26000 });
    expect(guess.type).toBe("long-run");
    expect(guess.confidence).toBe("medium");
  });

  it("infers hill repeats from high elevation gain relative to distance", () => {
    const guess = inferWorkoutType({ title: null, distanceMeters: 5000, elevationGainM: 200 });
    expect(guess.type).toBe("hill-repeats");
    expect(guess.confidence).toBe("medium");
  });

  it("falls back to easy with low confidence when there's no signal at all", () => {
    const guess = inferWorkoutType({ title: null, distanceMeters: 5000, elevationGainM: 20 });
    expect(guess.type).toBe("easy");
    expect(guess.confidence).toBe("low");
  });

  it("is case-insensitive when matching title keywords", () => {
    expect(inferWorkoutType({ title: "RECOVERY JOG", distanceMeters: 4000 }).type).toBe("recovery");
  });
});
