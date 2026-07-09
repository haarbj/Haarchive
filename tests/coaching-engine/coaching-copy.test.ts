import { describe, expect, it } from "vitest";
import { phaseSummary, trainingVoiceFor, workoutKindCoaching } from "@/lib/coaching-engine/coaching-copy";
import type { DistanceBucket } from "@/lib/coaching-engine/distance-buckets";
import type { MesocyclePhase, WorkoutPrescription } from "@/lib/coaching-engine/types";

const PHASES: MesocyclePhase[] = ["base", "build", "peak", "taper", "recovery"];
const KINDS: WorkoutPrescription["kind"][] = ["easy", "recovery", "long", "tempo", "vo2", "race"];
const BUCKETS: DistanceBucket[] = ["short", "middle", "long"];

describe("trainingVoiceFor", () => {
  it("uses the marathon voice only for the long bucket", () => {
    expect(trainingVoiceFor("short")).toBe("xc");
    expect(trainingVoiceFor("middle")).toBe("xc");
    expect(trainingVoiceFor("long")).toBe("marathon");
  });
});

describe("phaseSummary", () => {
  it("has a non-empty summary for every phase in every bucket", () => {
    for (const bucket of BUCKETS) {
      for (const phase of PHASES) {
        expect(phaseSummary(phase, bucket).length).toBeGreaterThan(0);
      }
    }
  });

  it("gives the marathon bucket different language than the XC buckets", () => {
    expect(phaseSummary("base", "long")).not.toBe(phaseSummary("base", "short"));
    expect(phaseSummary("base", "long")).toMatch(/durability/i);
  });

  it("gives the same XC-voice copy to short and middle buckets", () => {
    for (const phase of PHASES) {
      expect(phaseSummary(phase, "short")).toBe(phaseSummary(phase, "middle"));
    }
  });
});

describe("workoutKindCoaching", () => {
  it("has an objective and at least one adaptation for every kind in every bucket", () => {
    for (const bucket of BUCKETS) {
      for (const kind of KINDS) {
        const entry = workoutKindCoaching(kind, bucket);
        expect(entry.objective.length).toBeGreaterThan(0);
        expect(entry.adaptations.length).toBeGreaterThan(0);
      }
    }
  });

  it("gives easy and recovery runs distinct objectives", () => {
    expect(workoutKindCoaching("easy", "short").objective).not.toBe(workoutKindCoaching("recovery", "short").objective);
  });

  it("gives the marathon bucket different long-run language than the XC buckets", () => {
    const xcLong = workoutKindCoaching("long", "short");
    const marathonLong = workoutKindCoaching("long", "long");
    expect(xcLong.objective).not.toBe(marathonLong.objective);
    expect(marathonLong.adaptations).toContain("Glycogen storage");
  });
});
