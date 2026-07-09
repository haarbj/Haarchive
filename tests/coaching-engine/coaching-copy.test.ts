import { describe, expect, it } from "vitest";
import { PHASE_SUMMARY, WORKOUT_KIND_COACHING } from "@/lib/coaching-engine/coaching-copy";
import type { MesocyclePhase, WorkoutPrescription } from "@/lib/coaching-engine/types";

const PHASES: MesocyclePhase[] = ["base", "build", "peak", "taper", "recovery"];
const KINDS: WorkoutPrescription["kind"][] = ["easy", "recovery", "long", "tempo", "vo2", "race"];

describe("PHASE_SUMMARY", () => {
  it("has a non-empty summary for every mesocycle phase", () => {
    for (const phase of PHASES) {
      expect(PHASE_SUMMARY[phase].length).toBeGreaterThan(0);
    }
  });
});

describe("WORKOUT_KIND_COACHING", () => {
  it("has an objective and at least one adaptation for every prescription kind", () => {
    for (const kind of KINDS) {
      const entry = WORKOUT_KIND_COACHING[kind];
      expect(entry.objective.length).toBeGreaterThan(0);
      expect(entry.adaptations.length).toBeGreaterThan(0);
    }
  });

  it("gives easy and recovery runs distinct objectives", () => {
    expect(WORKOUT_KIND_COACHING.easy.objective).not.toBe(WORKOUT_KIND_COACHING.recovery.objective);
  });
});
