import { describe, expect, it } from "vitest";

import {
  FUELING_DURATION_THRESHOLD_MINUTES,
  isWorkoutFuelingEligible,
  resolveWorkoutDurationMinutes,
  heartRateZoneForWorkout,
  buildWorkoutFuelingCard,
  formatHoursMinutes,
  formatMilesLabel,
  type WorkoutFuelingInput,
} from "@/lib/private-coaching/workout-fueling";
import { resolveCarbTargetGPerHour } from "@/lib/fueling-calculator-math";
import { fluidTargetMlPerHour, sodiumTargetMgPerHour } from "@/lib/endurance-fueling-math";
import { FUEL_PRODUCTS, generateFuelingSchedule, totalsForSchedule } from "@/lib/fueling-products";
import { MILE_METERS } from "@/lib/race-distances";

function input(overrides: Partial<WorkoutFuelingInput> = {}): WorkoutFuelingInput {
  return {
    workoutType: "long",
    dayLabel: "Long Run",
    title: null,
    plannedRpe: 5,
    plannedRpeMax: null,
    distanceM: 20 * MILE_METERS,
    durationS: 140 * 60, // 2:20
    paceSPerMi: null,
    weightKg: null,
    ...overrides,
  };
}

describe("isWorkoutFuelingEligible", () => {
  it("the threshold is the documented 75-minute fallback -- no engine-defined value was found", () => {
    expect(FUELING_DURATION_THRESHOLD_MINUTES).toBe(75);
  });

  it("boundary: exactly 75 minutes is eligible", () => {
    expect(isWorkoutFuelingEligible(75)).toBe(true);
  });

  it("boundary: 74.9 minutes is not eligible", () => {
    expect(isWorkoutFuelingEligible(74.9)).toBe(false);
  });

  it("null duration is not eligible", () => {
    expect(isWorkoutFuelingEligible(null)).toBe(false);
  });
});

describe("resolveWorkoutDurationMinutes", () => {
  it("a stored duration wins outright", () => {
    expect(resolveWorkoutDurationMinutes({ distanceM: null, durationS: 5400, paceSPerMi: null })).toBe(90);
  });

  it("derives duration from distance and the workout's own resolved pace when no duration is stored", () => {
    // 10 miles at 9:00/mi (540 s/mi) = 90 minutes.
    const minutes = resolveWorkoutDurationMinutes({ distanceM: 10 * MILE_METERS, durationS: null, paceSPerMi: 540 });
    expect(minutes).toBeCloseTo(90, 3);
  });

  it("null when neither a stored duration nor a resolvable pace exists", () => {
    expect(resolveWorkoutDurationMinutes({ distanceM: 10 * MILE_METERS, durationS: null, paceSPerMi: null })).toBeNull();
  });

  it("null when there's no distance either -- nothing to derive from", () => {
    expect(resolveWorkoutDurationMinutes({ distanceM: null, durationS: null, paceSPerMi: 540 })).toBeNull();
  });
});

describe("heartRateZoneForWorkout -- RPE is the primary signal, workout type only a fallback", () => {
  it.each([
    [1, "50-60%"],
    [3, "50-60%"],
    [4, "60-70%"],
    [5, "60-70%"],
    [6, "70-80%"],
    [7, "70-80%"],
    [8, "80-90%"],
    [9, "80-90%"],
    [10, "90-100%"],
  ] as const)("RPE %s maps to %s", (rpe, zone) => {
    expect(heartRateZoneForWorkout("long", rpe, null)).toBe(zone);
  });

  it("plannedRpeMax wins over plannedRpe when both are set, same convention as isBigSession", () => {
    expect(heartRateZoneForWorkout("long", 4, 8)).toBe("80-90%");
  });

  it("falls back to workout type when no RPE is set at all", () => {
    expect(heartRateZoneForWorkout("recovery", null, null)).toBe("50-60%");
    expect(heartRateZoneForWorkout("vo2", null, null)).toBe("90-100%");
    expect(heartRateZoneForWorkout("tempo", null, null)).toBe("70-80%");
    expect(heartRateZoneForWorkout("race", null, null)).toBe("70-80%");
    expect(heartRateZoneForWorkout("long", null, null)).toBe("60-70%");
    expect(heartRateZoneForWorkout(null, null, null)).toBe("60-70%");
  });
});

describe("buildWorkoutFuelingCard", () => {
  it("is null for an ineligible (short) workout -- no card, not an empty one", () => {
    expect(buildWorkoutFuelingCard(input({ durationS: 30 * 60, distanceM: 4 * MILE_METERS }))).toBeNull();
  });

  it("boundary: a workout at exactly the 75-minute threshold gets a card", () => {
    expect(buildWorkoutFuelingCard(input({ durationS: 75 * 60 }))).not.toBeNull();
  });

  it("a long run and a race both qualify", () => {
    expect(buildWorkoutFuelingCard(input({ workoutType: "long" }))).not.toBeNull();
    expect(buildWorkoutFuelingCard(input({ workoutType: "race" }))).not.toBeNull();
  });

  it("a short easy run and a strides/vo2 session do not qualify", () => {
    expect(buildWorkoutFuelingCard(input({ workoutType: "easy", durationS: 40 * 60, distanceM: 5 * MILE_METERS }))).toBeNull();
    expect(buildWorkoutFuelingCard(input({ workoutType: "vo2", durationS: 50 * 60, distanceM: 6 * MILE_METERS }))).toBeNull();
  });

  it("composition correctness: the card's numbers equal a direct engine call with the same resolved inputs, not re-derived expectations", () => {
    const card = buildWorkoutFuelingCard(input({ plannedRpe: 5, durationS: 140 * 60, weightKg: 70 }))!;

    const zone = heartRateZoneForWorkout("long", 5, null);
    const expectedCarbsPerHour = resolveCarbTargetGPerHour(zone, "Moderate", null);
    const expectedFluid = fluidTargetMlPerHour(15);
    const expectedSodium = sodiumTargetMgPerHour(15);
    const product = FUEL_PRODUCTS.find((p) => p.id === "gel-gu")!;
    const expectedSchedule = generateFuelingSchedule(140, expectedCarbsPerHour, expectedFluid, expectedSodium, product, {
      useCaffeine: true,
      bodyWeightKg: 70,
      catalog: FUEL_PRODUCTS,
    });
    const expectedTotals = totalsForSchedule(expectedSchedule);

    expect(card.carbsPerHourGPerHour).toBe(expectedCarbsPerHour);
    expect(card.fluidPerHourMl).toBe(expectedFluid);
    expect(card.sodiumPerHourMg).toBe(expectedSodium);
    expect(card.totalCarbsG).toBe(expectedTotals.carbsG);
    expect(card.schedule).toEqual(expectedSchedule);
    expect(card.product.id).toBe("gel-gu");
  });

  it("missing athlete weight degrades to the engine's own default (150lb), never a fabricated value -- and is reported as such", () => {
    const withWeight = buildWorkoutFuelingCard(input({ weightKg: 95 }))!;
    const withoutWeight = buildWorkoutFuelingCard(input({ weightKg: null }))!;

    expect(withWeight.weightSource).toBe("athlete");
    expect(withoutWeight.weightSource).toBe("default");
    // A real, meaningfully heavier athlete weight (95kg) vs. the ~68kg
    // default (150lb) produces a materially different caffeine pre-load
    // dose in the schedule's own first-entry note -- proving the default
    // path actually ran through the engine rather than silently reusing
    // the real-weight result or crashing.
    expect(withoutWeight.schedule[0]?.note).toContain("Caffeine pre-load");
    expect(withWeight.schedule[0]?.note).not.toEqual(withoutWeight.schedule[0]?.note);
  });

  it("never crashes and never fabricates a value when weight is absent -- a real, complete card still comes back", () => {
    const card = buildWorkoutFuelingCard(input({ weightKg: null }));
    expect(card).not.toBeNull();
    expect(card!.totalCarbsG).toBeGreaterThan(0);
  });

  it("changing the workout's planned distance/duration changes the computed plan -- the adapter is a pure function of current workout state, not cached", () => {
    const shortRun = buildWorkoutFuelingCard(input({ durationS: 80 * 60, distanceM: 10 * MILE_METERS }))!;
    const longRun = buildWorkoutFuelingCard(input({ durationS: 180 * 60, distanceM: 24 * MILE_METERS }))!;
    expect(longRun.totalCarbsG).toBeGreaterThan(shortRun.totalCarbsG);
    expect(longRun.durationMinutes).toBe(180);
    expect(shortRun.durationMinutes).toBe(80);
  });

  it("the tie-in line has real figures: label, distance, and duration all trace to the workout", () => {
    const card = buildWorkoutFuelingCard(input({ dayLabel: "Long Run", distanceM: 20 * MILE_METERS, durationS: 140 * 60 }))!;
    expect(card.label).toBe("Long Run");
    expect(formatMilesLabel(card.distanceM)).toBe("20 mi");
    expect(formatHoursMinutes(card.durationMinutes)).toBe("2 hr 20 min");
  });

  it("names a real product with real carb/sodium values, never a generic placeholder", () => {
    const card = buildWorkoutFuelingCard(input())!;
    expect(card.product.name).toBe("GU Energy Gel");
    expect(card.product.carbsPerServingG).toBeGreaterThan(0);
  });
});

describe("formatHoursMinutes", () => {
  it.each([
    [45, "45 min"],
    [60, "1 hr"],
    [140, "2 hr 20 min"],
    [90, "1 hr 30 min"],
  ])("%s minutes -> %s", (minutes, expected) => {
    expect(formatHoursMinutes(minutes)).toBe(expected);
  });
});

describe("formatMilesLabel", () => {
  it("null distance is null", () => {
    expect(formatMilesLabel(null)).toBeNull();
  });

  it("a whole-number mile count has no decimal", () => {
    expect(formatMilesLabel(20 * MILE_METERS)).toBe("20 mi");
  });

  it("a fractional mile count keeps one decimal", () => {
    expect(formatMilesLabel(18.5 * MILE_METERS)).toBe("18.5 mi");
  });
});
