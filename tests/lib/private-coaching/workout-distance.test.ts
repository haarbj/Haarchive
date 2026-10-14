import { describe, expect, it } from "vitest";

import {
  getWorkoutPlannedDistanceM,
  validateDistanceRange,
  validateDurationRange,
  validatePaceRange,
  validateHrRange,
  validateRpeRange,
  formatDurationRange,
  formatPaceRange,
  metersToMilesInput,
  secondsToMinutesInput,
  secondsToPaceInput,
  paceSPerMiFromDistanceDuration,
  durationSFromDistancePace,
  distanceMFromDurationPace,
  autoCompleteWorkoutTargets,
  type WorkoutTargetRanges,
} from "@/lib/private-coaching/workout-distance";
import { MILE_METERS } from "@/lib/race-distances";

describe("getWorkoutPlannedDistanceM", () => {
  it("returns the explicit planned distance when set", () => {
    expect(getWorkoutPlannedDistanceM(9656.06)).toBe(9656.06);
  });

  it("returns null (not a steps-derived guess) when unset", () => {
    expect(getWorkoutPlannedDistanceM(null)).toBeNull();
  });
});

describe("validateDistanceRange", () => {
  it("allows a min-only point value", () => {
    expect(validateDistanceRange(9656, null)).toEqual({ valid: true });
  });

  it("allows a min+max range where max >= min", () => {
    expect(validateDistanceRange(9656, 11265)).toEqual({ valid: true });
    expect(validateDistanceRange(9656, 9656)).toEqual({ valid: true });
  });

  it("allows both null (no mileage entered at all)", () => {
    expect(validateDistanceRange(null, null)).toEqual({ valid: true });
  });

  it("rejects a max without a min", () => {
    const result = validateDistanceRange(null, 9656);
    expect(result.valid).toBe(false);
  });

  it("rejects a max below the min", () => {
    const result = validateDistanceRange(9656, 8000);
    expect(result.valid).toBe(false);
  });
});

describe("validateDurationRange", () => {
  it("allows a min-only point value", () => {
    expect(validateDurationRange(2700, null)).toEqual({ valid: true });
  });

  it("allows a min+max range where max >= min", () => {
    expect(validateDurationRange(2700, 3600)).toEqual({ valid: true });
  });

  it("allows both null", () => {
    expect(validateDurationRange(null, null)).toEqual({ valid: true });
  });

  it("rejects a max without a min", () => {
    expect(validateDurationRange(null, 3600).valid).toBe(false);
  });

  it("rejects a max below the min", () => {
    expect(validateDurationRange(3600, 2700).valid).toBe(false);
  });
});

describe("formatDurationRange", () => {
  it("formats a min-only value as a point value in whole minutes", () => {
    expect(formatDurationRange(2700, null)).toBe("45 min");
  });

  it("formats a min+max as a range in whole minutes", () => {
    expect(formatDurationRange(2700, 3600)).toBe("45–60 min");
  });

  it("returns null when both are unset", () => {
    expect(formatDurationRange(null, null)).toBeNull();
  });
});

describe("metersToMilesInput", () => {
  it("survives a save/reload round trip without float drift", () => {
    // 4 miles saved (rounded to the nearest meter), then re-read for
    // editing -- this exact case showed "3.9997663644317187" before the
    // fix, since 4 * 1609.344 rounds to 6437m and 6437/1609.344 isn't
    // exactly 4.
    const savedMeters = Math.round(4 * 1609.344);
    expect(metersToMilesInput(savedMeters)).toBe("4.00");
  });

  it("returns an empty string for null", () => {
    expect(metersToMilesInput(null)).toBe("");
  });
});

describe("secondsToMinutesInput", () => {
  it("converts whole minutes cleanly", () => {
    expect(secondsToMinutesInput(2700)).toBe("45");
  });

  it("returns an empty string for null", () => {
    expect(secondsToMinutesInput(null)).toBe("");
  });
});

describe("secondsToPaceInput", () => {
  it("formats seconds-per-mile as a clock", () => {
    expect(secondsToPaceInput(450)).toBe("7:30");
  });

  it("returns an empty string for null", () => {
    expect(secondsToPaceInput(null)).toBe("");
  });
});

describe("formatPaceRange", () => {
  it("formats a min-only value as a point pace", () => {
    expect(formatPaceRange(450, null)).toBe("7:30/mi");
  });

  it("formats a min+max as a range", () => {
    expect(formatPaceRange(450, 480)).toBe("7:30–8:00/mi");
  });

  it("returns null when both are unset", () => {
    expect(formatPaceRange(null, null)).toBeNull();
  });
});

describe("validatePaceRange / validateHrRange", () => {
  it("apply the same min/max invariants as distance and duration", () => {
    expect(validatePaceRange(450, 480)).toEqual({ valid: true });
    expect(validatePaceRange(480, 450).valid).toBe(false);
    expect(validateHrRange(140, 160)).toEqual({ valid: true });
    expect(validateHrRange(null, 160).valid).toBe(false);
  });
});

describe("validateRpeRange", () => {
  it("allows a value on Foster's 1-10 scale", () => {
    expect(validateRpeRange(5, 8)).toEqual({ valid: true });
    expect(validateRpeRange(1, null)).toEqual({ valid: true });
  });

  it("rejects a value outside 1-10", () => {
    expect(validateRpeRange(0, null).valid).toBe(false);
    expect(validateRpeRange(1, 11).valid).toBe(false);
  });

  it("still enforces the shared range invariants", () => {
    expect(validateRpeRange(8, 5).valid).toBe(false);
    expect(validateRpeRange(null, 8).valid).toBe(false);
  });
});

describe("pace/duration/distance conversions", () => {
  it("derives pace from distance and duration", () => {
    // 6 miles in 45 minutes -- 7:30/mile.
    expect(paceSPerMiFromDistanceDuration(6 * MILE_METERS, 2700)).toBeCloseTo(450, 5);
  });

  it("derives duration from distance and pace", () => {
    expect(durationSFromDistancePace(6 * MILE_METERS, 450)).toBeCloseTo(2700, 5);
  });

  it("derives distance from duration and pace", () => {
    expect(distanceMFromDurationPace(2700, 450)).toBeCloseTo(6 * MILE_METERS, 5);
  });
});

describe("autoCompleteWorkoutTargets", () => {
  const empty: WorkoutTargetRanges = {
    distanceMinM: null,
    distanceMaxM: null,
    durationMinS: null,
    durationMaxS: null,
    paceMinSPerMi: null,
    paceMaxSPerMi: null,
  };

  it("fills in pace once distance and duration are both known", () => {
    const ranges: WorkoutTargetRanges = { ...empty, distanceMinM: 6 * MILE_METERS, durationMinS: 2700 };
    const result = autoCompleteWorkoutTargets("duration", ranges);
    expect(result.paceMinSPerMi).toBe(450);
    expect(result.paceMaxSPerMi).toBeNull();
  });

  it("fills in duration once distance and pace are both known", () => {
    const ranges: WorkoutTargetRanges = { ...empty, distanceMinM: 6 * MILE_METERS, paceMinSPerMi: 450 };
    const result = autoCompleteWorkoutTargets("pace", ranges);
    expect(result.durationMinS).toBe(2700);
  });

  it("fills in distance once duration and pace are both known", () => {
    const ranges: WorkoutTargetRanges = { ...empty, durationMinS: 2700, paceMinSPerMi: 450 };
    const result = autoCompleteWorkoutTargets("duration", ranges);
    expect(result.distanceMinM).toBe(Math.round(6 * MILE_METERS));
  });

  it("leaves everything alone when only one of the three is entered", () => {
    const ranges: WorkoutTargetRanges = { ...empty, distanceMinM: 6 * MILE_METERS };
    expect(autoCompleteWorkoutTargets("distance", ranges)).toEqual(ranges);
  });

  it("when all three are set, editing distance recomputes pace and leaves duration fixed", () => {
    const ranges: WorkoutTargetRanges = { ...empty, distanceMinM: 6 * MILE_METERS, durationMinS: 2700, paceMinSPerMi: 999 };
    const result = autoCompleteWorkoutTargets("distance", ranges);
    expect(result.durationMinS).toBe(2700);
    expect(result.paceMinSPerMi).toBe(450);
  });

  it("when all three are set, editing pace recomputes duration and leaves distance fixed -- distance outranks duration", () => {
    const ranges: WorkoutTargetRanges = { ...empty, distanceMinM: 6 * MILE_METERS, durationMinS: 999, paceMinSPerMi: 450 };
    const result = autoCompleteWorkoutTargets("pace", ranges);
    expect(result.distanceMinM).toBe(6 * MILE_METERS);
    expect(result.durationMinS).toBe(2700);
  });

  it("when all three are set, editing duration recomputes pace and leaves distance fixed", () => {
    const ranges: WorkoutTargetRanges = { ...empty, distanceMinM: 6 * MILE_METERS, durationMinS: 2700, paceMinSPerMi: 999 };
    const result = autoCompleteWorkoutTargets("duration", ranges);
    expect(result.distanceMinM).toBe(6 * MILE_METERS);
    expect(result.paceMinSPerMi).toBe(450);
  });

  it("pairs each range's min with the other's min and max with max, then re-sorts if that pairing inverts the order", () => {
    // 4-6 miles in 32-45 minutes: the shorter/faster pairing (4mi/32min)
    // works out to an 8:00 pace, the longer pairing (6mi/45min) to a
    // faster 7:30 -- pairing straight across would put the "min" pace
    // slower than the "max" pace, so the result has to be re-sorted.
    const ranges: WorkoutTargetRanges = {
      ...empty,
      distanceMinM: 4 * MILE_METERS,
      distanceMaxM: 6 * MILE_METERS,
      durationMinS: 1920,
      durationMaxS: 2700,
    };
    const result = autoCompleteWorkoutTargets("duration", ranges);
    expect(result.paceMinSPerMi).toBe(450);
    expect(result.paceMaxSPerMi).toBe(480);
  });
});
