import { describe, it, expect } from "vitest";
import {
  FEMALE_IRON_DEFICIENCY_RELATIVE_RISK,
  GUT_TRAINING_WINDOW_WEEKS,
  LONG_RUN_DISTANCE_MILES,
  LOW_FERRITIN_STUDY,
  UNDER_FUELING_CLUSTER_THRESHOLD,
  assessUnderFueling,
  ferritinCheckGuidance,
  isFuelRelevantSession,
  mentionsFuelingPractice,
  runGutTrainingCheck,
  type FuelRelevantWorkout,
  type UnderFuelingSignals,
} from "@/lib/private-coaching/fueling-oversight";
import { MEDICAL_NOTE } from "@/lib/private-coaching/setbacks";
import { MILE_METERS } from "@/lib/race-distances";

function signals(overrides: Partial<UnderFuelingSignals> = {}): UnderFuelingSignals {
  return {
    frequentIllness: false,
    recurrentOveruseInjuries: false,
    troubleSleeping: false,
    hormoneDisruptions: false,
    plateauingOrDecliningDespiteSolidTraining: false,
    ...overrides,
  };
}

function workout(overrides: Partial<FuelRelevantWorkout> & { scheduledDate: string }): FuelRelevantWorkout {
  return {
    id: overrides.scheduledDate,
    prescription: null,
    phaseKey: null,
    plannedDistanceM: null,
    completed: true,
    loggedNotes: null,
    ...overrides,
  };
}

describe("the never-diagnose boundary", () => {
  it("attaches the shared medical note to every guidance path that fires", () => {
    const cluster = assessUnderFueling(signals({ frequentIllness: true, troubleSleeping: true })).guidance!;
    const ferritin = ferritinCheckGuidance({ underFuelingClusterPresent: true, aerobicFitnessStalling: false })!;
    for (const g of [cluster, ferritin]) {
      expect(g.medicalNote).toBe(MEDICAL_NOTE);
    }
  });

  it("never names a condition in its own copy", () => {
    const cluster = assessUnderFueling(signals({ frequentIllness: true, troubleSleeping: true })).guidance!;
    const ferritin = ferritinCheckGuidance({ underFuelingClusterPresent: true, aerobicFitnessStalling: true })!;
    const everything = [cluster, ferritin].map((g) => `${g.title} ${g.detail} ${g.actions.join(" ")}`).join(" ").toLowerCase();
    for (const condition of ["red-s", "anemia", "anaemia", "amenorrhea", "hemochromatosis", "haemochromatosis", "hypothyroid"]) {
      expect(everything).not.toContain(condition);
    }
  });

  it("routes every finding to a professional rather than resolving it itself", () => {
    const cluster = assessUnderFueling(signals({ frequentIllness: true, troubleSleeping: true })).guidance!;
    const ferritin = ferritinCheckGuidance({ underFuelingClusterPresent: false, aerobicFitnessStalling: true })!;
    expect(cluster.actions.join(" ")).toMatch(/sports dietitian or physician/);
    expect(ferritin.actions.join(" ")).toMatch(/physician/);
  });
});

describe("assessUnderFueling", () => {
  it("says nothing for a single isolated signal", () => {
    expect(UNDER_FUELING_CLUSTER_THRESHOLD).toBe(2);
    const result = assessUnderFueling(signals({ troubleSleeping: true }));
    expect(result.clusterPresent).toBe(false);
    expect(result.guidance).toBeNull();
  });

  it("surfaces guidance once two or more signals co-occur", () => {
    const result = assessUnderFueling(signals({ frequentIllness: true, recurrentOveruseInjuries: true }));
    expect(result.signalCount).toBe(2);
    expect(result.clusterPresent).toBe(true);
    expect(result.guidance).not.toBeNull();
  });

  it("puts under-fuelling ahead of cutting training, in that order", () => {
    const result = assessUnderFueling(signals({ frequentIllness: true, troubleSleeping: true }));
    expect(result.guidance!.title).toMatch(/before cutting training/);
    expect(result.guidance!.actions.join(" ")).toMatch(/Do not respond by cutting volume alone/);
  });

  it("names the classic pattern: skipping breakfast or under-eating around workouts", () => {
    const result = assessUnderFueling(signals({ frequentIllness: true, hormoneDisruptions: true }));
    expect(result.guidance!.detail).toMatch(/skipping breakfast/);
    expect(result.guidance!.detail).toMatch(/under-eating around the workout/);
  });

  it("frames it as under-recovery, explicitly distinct from overtraining", () => {
    const result = assessUnderFueling(signals({ frequentIllness: true, plateauingOrDecliningDespiteSolidTraining: true }));
    expect(result.guidance!.detail).toMatch(/not overtraining/);
  });

  it("counts all five signals when all are present", () => {
    const result = assessUnderFueling(
      signals({
        frequentIllness: true,
        recurrentOveruseInjuries: true,
        troubleSleeping: true,
        hormoneDisruptions: true,
        plateauingOrDecliningDespiteSolidTraining: true,
      }),
    );
    expect(result.signalCount).toBe(5);
    expect(result.clusterPresent).toBe(true);
  });
});

describe("mentionsFuelingPractice", () => {
  it("catches common fuelling mentions", () => {
    expect(mentionsFuelingPractice("Took 2 gels, felt great")).toBe(true);
    expect(mentionsFuelingPractice("Practiced 60g carbs/hr with Maurten")).toBe(true);
    expect(mentionsFuelingPractice("Used sports drink the whole way")).toBe(true);
  });

  it("does not fire on unrelated notes", () => {
    expect(mentionsFuelingPractice("Legs felt heavy, hills were tough")).toBe(false);
    expect(mentionsFuelingPractice(null)).toBe(false);
    expect(mentionsFuelingPractice("")).toBe(false);
  });
});

describe("isFuelRelevantSession", () => {
  it("counts a long run by distance", () => {
    expect(LONG_RUN_DISTANCE_MILES).toBe(13);
    expect(
      isFuelRelevantSession(workout({ scheduledDate: "2027-01-01", plannedDistanceM: 14 * MILE_METERS })),
    ).toBe(true);
    expect(
      isFuelRelevantSession(workout({ scheduledDate: "2027-01-01", plannedDistanceM: 8 * MILE_METERS })),
    ).toBe(false);
  });

  it("counts a marathon-specific session by its prescribed pace, regardless of distance", () => {
    expect(
      isFuelRelevantSession(workout({ scheduledDate: "2027-01-01", plannedDistanceM: 6 * MILE_METERS, prescription: "6 mi at 100% MP" })),
    ).toBe(true);
    expect(
      isFuelRelevantSession(workout({ scheduledDate: "2027-01-01", plannedDistanceM: 6 * MILE_METERS, prescription: "6 mi at 85% 5k" })),
    ).toBe(false);
  });

  it("is false for an easy run with no distance or marathon-pace signal", () => {
    expect(isFuelRelevantSession(workout({ scheduledDate: "2027-01-01", prescription: "6 mi easy" }))).toBe(false);
  });
});

describe("runGutTrainingCheck", () => {
  const raceDate = "2027-04-11";

  it("fires when every relevant completed session in the window shows no fuelling mention", () => {
    const result = runGutTrainingCheck({
      workouts: [
        workout({ scheduledDate: "2027-03-01", plannedDistanceM: 18 * MILE_METERS, loggedNotes: "Tough but steady" }),
        workout({ scheduledDate: "2027-03-15", prescription: "13 mi at 100% MP", loggedNotes: "Nailed the pace" }),
      ],
      raceDate,
    });
    expect(result.fired).toBe(true);
    expect(result.unpracticedSessions).toHaveLength(2);
    expect(result.detail).toMatch(/Race-day fuelling is a trained skill/);
  });

  it("does not fire when at least one relevant session shows real practice", () => {
    const result = runGutTrainingCheck({
      workouts: [
        workout({ scheduledDate: "2027-03-01", plannedDistanceM: 18 * MILE_METERS, loggedNotes: "Took 2 gels, worked well" }),
        workout({ scheduledDate: "2027-03-15", prescription: "13 mi at 100% MP", loggedNotes: "No fuelling notes here" }),
      ],
      raceDate,
    });
    expect(result.fired).toBe(false);
  });

  it("stays silent when there is nothing relevant to check yet", () => {
    const result = runGutTrainingCheck({
      workouts: [workout({ scheduledDate: "2027-03-01", plannedDistanceM: 6 * MILE_METERS })],
      raceDate,
    });
    expect(result.fired).toBe(false);
  });

  it("ignores a relevant session that was never completed", () => {
    const result = runGutTrainingCheck({
      workouts: [workout({ scheduledDate: "2027-03-01", plannedDistanceM: 18 * MILE_METERS, completed: false })],
      raceDate,
    });
    expect(result.fired).toBe(false);
  });

  it("only looks inside the eight-week window before the race", () => {
    expect(GUT_TRAINING_WINDOW_WEEKS).toBe(8);
    const result = runGutTrainingCheck({
      workouts: [workout({ scheduledDate: "2027-01-01", plannedDistanceM: 18 * MILE_METERS })],
      raceDate,
    });
    expect(result.fired).toBe(false);
  });

  it("says nothing with no race date set", () => {
    expect(
      runGutTrainingCheck({ workouts: [workout({ scheduledDate: "2027-03-01", plannedDistanceM: 18 * MILE_METERS })], raceDate: null })
        .fired,
    ).toBe(false);
  });

  it("hedges on reading free text rather than treating it as certain", () => {
    const result = runGutTrainingCheck({
      workouts: [workout({ scheduledDate: "2027-03-15", prescription: "13 mi at 100% MP" })],
      raceDate,
    });
    expect(result.detail).toMatch(/worth a direct question rather than treated as certain/);
  });
});

describe("ferritinCheckGuidance", () => {
  it("fires when the under-fuelling cluster is present", () => {
    expect(ferritinCheckGuidance({ underFuelingClusterPresent: true, aerobicFitnessStalling: false })).not.toBeNull();
  });

  it("fires when aerobic fitness is stalling, independent of the cluster", () => {
    expect(ferritinCheckGuidance({ underFuelingClusterPresent: false, aerobicFitnessStalling: true })).not.toBeNull();
  });

  it("says nothing when neither trigger is present", () => {
    expect(ferritinCheckGuidance({ underFuelingClusterPresent: false, aerobicFitnessStalling: false })).toBeNull();
  });

  it("states the prevalence figures and insists on testing before supplementing", () => {
    expect(FEMALE_IRON_DEFICIENCY_RELATIVE_RISK).toBe(3);
    expect(LOW_FERRITIN_STUDY).toEqual({ thresholdNgMl: 35, femalePercentBelow: 52, malePercentBelow: 15, sampleSize: 1000 });
    const g = ferritinCheckGuidance({ underFuelingClusterPresent: false, aerobicFitnessStalling: true })!;
    expect(g.detail).toMatch(/3 times more likely/);
    expect(g.detail).toMatch(/52% of women and 15% of men/);
    expect(g.actions.join(" ")).toMatch(/Test before supplementing, never the other way round/);
    expect(g.detail).toMatch(/genetic iron-overload conditions make blind iron supplementation actively harmful/);
  });

  it("connects the two triggers to each other when both are present", () => {
    const g = ferritinCheckGuidance({ underFuelingClusterPresent: true, aerobicFitnessStalling: true })!;
    expect(g.detail).toMatch(/alongside the under-fuelling pattern already flagged/);
  });
});
