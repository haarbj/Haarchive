import { describe, expect, it } from "vitest";
import { compressWorkout, insertRecoveryDay, substituteForSurface } from "@/lib/coaching-engine/adaptations";
import { derivePaceZones } from "@/lib/coaching-engine/pace-zones";
import type { WorkoutPrescription } from "@/lib/coaching-engine/types";

const MARATHON_M = 42195;
const GOAL_TIME_S = 3 * 3600 + 30 * 60;
const paceZones = derivePaceZones(MARATHON_M, GOAL_TIME_S);

const LONG_RUN: WorkoutPrescription = { kind: "long", distanceM: 19312, paceRangeSecPerKm: paceZones.steady };
const TEMPO: WorkoutPrescription = {
  kind: "tempo",
  warmupM: 1600,
  tempoM: 4800,
  cooldownM: 1600,
  paceRangeSecPerKm: paceZones.tempo,
};
const VO2: WorkoutPrescription = {
  kind: "vo2",
  warmupM: 1600,
  reps: 6,
  repM: 800,
  recoveryM: 400,
  cooldownM: 1600,
  paceRangeSecPerKm: paceZones.interval,
};
const RACE: WorkoutPrescription = { kind: "race", distanceM: MARATHON_M };

describe("compressWorkout", () => {
  it("refuses to compress race day", () => {
    const result = compressWorkout(RACE, 20);
    expect(result.ok).toBe(false);
  });

  it("refuses a non-positive time budget", () => {
    const result = compressWorkout(LONG_RUN, 0);
    expect(result.ok).toBe(false);
  });

  it("refuses when there's already enough time", () => {
    const result = compressWorkout(LONG_RUN, 600); // 10 hours, absurdly generous
    expect(result.ok).toBe(false);
  });

  it("shortens an easy/long run's distance but never past the 1-mile floor", () => {
    const generous = compressWorkout(LONG_RUN, 60);
    if (!generous.ok || generous.prescription.kind !== "long") throw new Error("expected a long prescription");
    expect(generous.prescription.distanceM).toBeLessThan(LONG_RUN.distanceM);

    const tiny = compressWorkout(LONG_RUN, 1);
    if (!tiny.ok || tiny.prescription.kind !== "long") throw new Error("expected a long prescription");
    expect(tiny.prescription.distanceM).toBeGreaterThanOrEqual(1600);
  });

  it("shortens a tempo run's tempo segment but keeps it at least 1600m", () => {
    const result = compressWorkout(TEMPO, 10);
    if (!result.ok || result.prescription.kind !== "tempo") throw new Error("expected a tempo prescription");
    expect(result.prescription.tempoM).toBeLessThan(TEMPO.tempoM);
    expect(result.prescription.tempoM).toBeGreaterThanOrEqual(1600);
  });

  it("reduces vo2 reps but never below 3", () => {
    const result = compressWorkout(VO2, 15);
    if (!result.ok || result.prescription.kind !== "vo2") throw new Error("expected a vo2 prescription");
    expect(result.prescription.reps).toBeLessThan(VO2.reps);
    expect(result.prescription.reps).toBeGreaterThanOrEqual(3);
  });

  it("never proposes a longer workout than the original", () => {
    for (const rx of [LONG_RUN, TEMPO, VO2]) {
      const result = compressWorkout(rx, 5);
      expect(result.ok).toBe(true);
    }
  });
});

describe("insertRecoveryDay", () => {
  it("refuses on race day", () => {
    expect(insertRecoveryDay(RACE, paceZones).ok).toBe(false);
  });

  it("refuses when today is already a short recovery day", () => {
    const alreadyRecovery: WorkoutPrescription = { kind: "recovery", distanceM: 2000, paceRangeSecPerKm: paceZones.easy };
    expect(insertRecoveryDay(alreadyRecovery, paceZones).ok).toBe(false);
  });

  it("converts a long run into a short recovery effort at easy pace", () => {
    const result = insertRecoveryDay(LONG_RUN, paceZones);
    if (!result.ok) throw new Error(result.reason);
    expect(result.prescription.kind).toBe("recovery");
    if (result.prescription.kind !== "recovery") return;
    expect(result.prescription.distanceM).toBeLessThan(LONG_RUN.distanceM);
    expect(result.prescription.paceRangeSecPerKm).toEqual(paceZones.easy);
  });

  it("converts a tempo or vo2 session the same way", () => {
    for (const rx of [TEMPO, VO2]) {
      const result = insertRecoveryDay(rx, paceZones);
      if (!result.ok) throw new Error(result.reason);
      expect(result.prescription.kind).toBe("recovery");
    }
  });
});

describe("substituteForSurface", () => {
  it("only applies to vo2 workouts", () => {
    for (const rx of [LONG_RUN, TEMPO, RACE]) {
      expect(substituteForSurface(rx).ok).toBe(false);
    }
  });

  it("gives time-based guidance for a vo2 workout, mentioning the rep count", () => {
    const result = substituteForSurface(VO2);
    if (!result.ok) throw new Error("expected guidance");
    expect(result.guidance).toContain(`${VO2.reps}`);
    expect(result.guidance).toMatch(/seconds|minutes/i);
  });

  it("never proposes an exact rep distance in meters -- the whole point is not needing one", () => {
    const result = substituteForSurface(VO2);
    if (!result.ok) throw new Error("expected guidance");
    expect(result.guidance).not.toMatch(/\d+\s*m\b/i);
  });
});
