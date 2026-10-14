import { describe, it, expect } from "vitest";
import {
  DOUBLE_THRESHOLD_FLOOR,
  EXTENDED_PEAK_STEP_MAX,
  EXTENDED_STEP_MILEAGE_FLOOR,
  HIGH_MILEAGE_CEILING,
  MARATHON_SPECIFIC_DEPLETION_MAX_PER_BUILDUP,
  SPECIAL_BLOCK_LOWER_MILEAGE_CAP,
  SPECIAL_BLOCK_MAX_PER_BUILDUP,
  STRENGTH_OPTIONS,
  depletionWorkoutEligibility,
  depletionWorkoutGuidance,
  doubleThresholdEligibility,
  doubleThresholdGuidance,
  highMileageGuidance,
  specialBlockEligibility,
  specialBlockGuidance,
  strengthTrainingGuidance,
} from "@/lib/private-coaching/advanced-techniques";

describe("highMileageGuidance", () => {
  it("flags the stagnation trap first, overriding everything else", () => {
    const g = highMileageGuidance({
      currentPeakMileage: 130,
      respondedWellToEarlyIncreases: true,
      lifestyleSupportsDoubles: true,
      stagnatingOrBreakingDown: true,
    });
    expect(g.key).toBe("high-mileage:trap");
    expect(g.detail).toMatch(/LESS mileage with MORE workout volume/);
  });

  it("says who benefits before suggesting more mileage", () => {
    const g = highMileageGuidance({
      currentPeakMileage: 60,
      respondedWellToEarlyIncreases: false,
      lifestyleSupportsDoubles: true,
      stagnatingOrBreakingDown: false,
    });
    expect(g.key).toBe("high-mileage:not-yet");
    expect(g.detail).toMatch(/four thousand or more calories/);
  });

  it("gives the normal step and the extended step only above the floor", () => {
    const low = highMileageGuidance({
      currentPeakMileage: 75,
      respondedWellToEarlyIncreases: true,
      lifestyleSupportsDoubles: true,
      stagnatingOrBreakingDown: false,
    });
    expect(low.detail).not.toMatch(new RegExp(`up to ${EXTENDED_PEAK_STEP_MAX}`));

    const high = highMileageGuidance({
      currentPeakMileage: EXTENDED_STEP_MILEAGE_FLOOR,
      respondedWellToEarlyIncreases: true,
      lifestyleSupportsDoubles: true,
      stagnatingOrBreakingDown: false,
    });
    expect(high.detail).toMatch(new RegExp(`up to ${EXTENDED_PEAK_STEP_MAX}`));
    expect(high.detail).toMatch(/explicit buy-in|choice to make explicitly/);
  });

  it("states the useful ceiling", () => {
    const g = highMileageGuidance({
      currentPeakMileage: 100,
      respondedWellToEarlyIncreases: true,
      lifestyleSupportsDoubles: true,
      stagnatingOrBreakingDown: false,
    });
    expect(HIGH_MILEAGE_CEILING).toEqual({ min: 120, max: 150 });
    expect(g.detail).toMatch(/120 to 150 miles a week/);
  });

  it("insists the weekly total follows the workouts, not the other way round", () => {
    const g = highMileageGuidance({
      currentPeakMileage: 100,
      respondedWellToEarlyIncreases: true,
      lifestyleSupportsDoubles: true,
      stagnatingOrBreakingDown: false,
    });
    expect(g.detail).toMatch(/RESULT of the workouts rather than a target/);
  });
});

describe("depletionWorkoutEligibility", () => {
  const base = {
    redsHistory: false,
    disorderedEatingHistory: false,
    menstrualDisturbanceHistory: false,
    overtrainingHistory: false,
    aerobicallyStrong: true,
    experiencedMultipleCycles: true,
    peakMileage: 80,
    fadesLateInMarathon: true,
  };

  it("is eligible when every requirement is met and nothing is contraindicated", () => {
    expect(depletionWorkoutEligibility(base)).toEqual({ eligible: true, contraindicated: false, reasons: [] });
  });

  it.each([
    ["redsHistory", "RED-S"],
    ["disorderedEatingHistory", "disordered eating"],
    ["menstrualDisturbanceHistory", "menstrual disturbance"],
    ["overtrainingHistory", "overtraining"],
  ] as const)("treats %s as an absolute contraindication", (field, phrase) => {
    const result = depletionWorkoutEligibility({ ...base, [field]: true });
    expect(result.contraindicated).toBe(true);
    expect(result.eligible).toBe(false);
    expect(result.reasons[0]).toMatch(new RegExp(phrase, "i"));
  });

  it("never lets eligibility criteria override a contraindication", () => {
    // Every positive box ticked, but with a history present.
    const result = depletionWorkoutEligibility({ ...base, redsHistory: true });
    expect(result.contraindicated).toBe(true);
    expect(result.eligible).toBe(false);
  });

  it("is ineligible, not contraindicated, when the fitness criteria are unmet", () => {
    const result = depletionWorkoutEligibility({ ...base, peakMileage: 50, aerobicallyStrong: false });
    expect(result.eligible).toBe(false);
    expect(result.contraindicated).toBe(false);
    expect(result.reasons.length).toBe(2);
  });
});

describe("depletionWorkoutGuidance", () => {
  it("refuses outright for a contraindicated athlete, regardless of form requested", () => {
    const eligibility = depletionWorkoutEligibility({
      redsHistory: true,
      disorderedEatingHistory: false,
      menstrualDisturbanceHistory: false,
      overtrainingHistory: false,
      aerobicallyStrong: true,
      experiencedMultipleCycles: true,
      peakMileage: 90,
      fadesLateInMarathon: true,
    });
    for (const form of ["general", "marathon-specific"] as const) {
      const g = depletionWorkoutGuidance(eligibility, form);
      expect(g.key).toBe("depletion:contraindicated");
      expect(g.detail).toMatch(/RED-S/i);
      expect(g.actions.join(" ")).toMatch(/not a judgment call/i);
    }
  });

  it("reports ineligibility with the specific unmet criteria", () => {
    const eligibility = depletionWorkoutEligibility({
      redsHistory: false,
      disorderedEatingHistory: false,
      menstrualDisturbanceHistory: false,
      overtrainingHistory: false,
      aerobicallyStrong: true,
      experiencedMultipleCycles: false,
      peakMileage: 90,
      fadesLateInMarathon: true,
    });
    const g = depletionWorkoutGuidance(eligibility, "general");
    expect(g.key).toBe("depletion:ineligible");
    expect(g.actions.join(" ")).toMatch(/multiple marathon cycles/);
  });

  it("caps marathon-specific depletion at three per buildup and warns the pace will look slow", () => {
    const eligibility = { eligible: true, contraindicated: false, reasons: [] };
    const g = depletionWorkoutGuidance(eligibility, "marathon-specific");
    expect(MARATHON_SPECIFIC_DEPLETION_MAX_PER_BUILDUP).toBe(3);
    expect(g.detail).toMatch(/Maximum 3 per buildup/);
    expect(g.actions.join(" ")).toMatch(/pace will look slow/);
  });

  it("tapers general depletion to none by the specific phase", () => {
    const eligibility = { eligible: true, contraindicated: false, reasons: [] };
    const g = depletionWorkoutGuidance(eligibility, "general");
    expect(g.actions.join(" ")).toMatch(/stop by the specific phase/);
  });
});

describe("doubleThresholdEligibility and guidance", () => {
  it("gates on weekly mileage and existing single-threshold volume", () => {
    expect(DOUBLE_THRESHOLD_FLOOR).toEqual({ weeklyMileage: 65, singleThresholdMiles: 5 });
    const low = doubleThresholdEligibility({ currentWeeklyMileage: 50, currentSingleThresholdVolumeMiles: 3 });
    expect(low.eligible).toBe(false);
    expect(low.reasons).toHaveLength(2);

    const ready = doubleThresholdEligibility({ currentWeeklyMileage: 70, currentSingleThresholdVolumeMiles: 6 });
    expect(ready.eligible).toBe(true);
  });

  it("frames double-threshold as supportive, never specific", () => {
    const g = doubleThresholdGuidance({ eligible: true, reasons: [] });
    expect(g.detail).toMatch(/marathon-SUPPORTIVE work, never marathon-specific/);
  });

  it("warns that splitting volume does not reduce biomechanical stress", () => {
    const g = doubleThresholdGuidance({ eligible: true, reasons: [] });
    expect(g.actions.join(" ")).toMatch(/does not reduce biomechanical stress/);
  });

  it("reports why when not eligible", () => {
    const g = doubleThresholdGuidance({ eligible: false, reasons: ["too low"] });
    expect(g.key).toBe("double-threshold:ineligible");
    expect(g.actions).toEqual(["too low"]);
  });
});

describe("specialBlockEligibility and guidance", () => {
  const eligibleInput = {
    phaseKey: "Specific",
    currentWeeklyMileage: 90,
    marathonCyclesCompleted: 2,
    pacingDisciplineGood: true,
    injuryProne: false,
    reboundingFromSetback: false,
    easyDaysBefore: 3,
  };

  it("is eligible when every condition holds", () => {
    expect(specialBlockEligibility(eligibleInput)).toEqual({ eligible: true, reasons: [] });
  });

  it("refuses outside the supportive/specific phases", () => {
    const result = specialBlockEligibility({ ...eligibleInput, phaseKey: "General" });
    expect(result.eligible).toBe(false);
    expect(result.reasons[0]).toMatch(/marathon-supportive or marathon-specific/);
  });

  it("never allows it for an injury-prone athlete or one rebounding from a setback, no matter what else is true", () => {
    expect(specialBlockEligibility({ ...eligibleInput, injuryProne: true }).eligible).toBe(false);
    expect(specialBlockEligibility({ ...eligibleInput, reboundingFromSetback: true }).eligible).toBe(false);
  });

  it("requires at least two easy days before it", () => {
    expect(specialBlockEligibility({ ...eligibleInput, easyDaysBefore: 1 }).eligible).toBe(false);
  });

  it("caps special blocks at three per buildup and requires real recovery after", () => {
    expect(SPECIAL_BLOCK_MAX_PER_BUILDUP).toBe(3);
    const g = specialBlockGuidance({ eligible: true, reasons: [] });
    expect(g.detail).toMatch(/Maximum 3 per buildup/);
    expect(g.detail).toMatch(/three to six or more easy days after/);
  });

  it("scales the day for a lower-mileage athlete instead of running the full version", () => {
    expect(SPECIAL_BLOCK_LOWER_MILEAGE_CAP).toEqual({ min: 1.4, max: 1.7 });
    const g = specialBlockGuidance({ eligible: true, reasons: [] }, { isLowerMileageAthlete: true });
    expect(g.detail).toMatch(/1.4 to 1.7 times their normal daily volume/);
  });

  it("names the design mode rather than leaving it to accident", () => {
    const strengths = specialBlockGuidance({ eligible: true, reasons: [] }, { designMode: "play-to-strengths" });
    const limiter = specialBlockGuidance({ eligible: true, reasons: [] }, { designMode: "target-limiter" });
    expect(strengths.detail).toMatch(/showcase what this athlete already does well/);
    expect(limiter.detail).toMatch(/aim the block at the specific quality/);
  });
});

describe("strengthTrainingGuidance", () => {
  it("defaults to foundation work alone when there is no confident reason to choose otherwise", () => {
    const g = strengthTrainingGuidance({ confidentInChoice: false });
    expect(g.key).toBe("strength:default");
    expect(g.title).toMatch(/stability work only/);
  });

  it("lists all four options with their real tradeoffs when the coach wants to choose", () => {
    const g = strengthTrainingGuidance({ confidentInChoice: true });
    expect(g.actions).toHaveLength(4);
    expect(g.actions.join(" ")).toMatch(/highest injury risk/);
  });

  it("marks plyometrics as the highest risk and foundation as the lowest", () => {
    const plyo = STRENGTH_OPTIONS.find((o) => o.key === "plyometrics")!;
    const foundation = STRENGTH_OPTIONS.find((o) => o.key === "foundation")!;
    expect(plyo.injuryRisk).toBe("highest");
    expect(foundation.injuryRisk).toBe("lowest");
  });

  it("insists heavy lifting always comes after the day's run", () => {
    const lifting = STRENGTH_OPTIONS.find((o) => o.key === "heavy-lifting")!;
    expect(lifting.description).toMatch(/AFTER the day's run, never before/);
  });

  it("notes plyometrics needs eight-plus weeks and is not a late addition", () => {
    const plyo = STRENGTH_OPTIONS.find((o) => o.key === "plyometrics")!;
    expect(plyo.timing).toMatch(/not a last-minute addition/);
  });
});
