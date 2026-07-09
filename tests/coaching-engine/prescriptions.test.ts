import { describe, expect, it } from "vitest";
import { buildWeekPrescriptions } from "@/lib/coaching-engine/prescriptions";
import { derivePaceZones } from "@/lib/coaching-engine/pace-zones";
import type { WorkoutType } from "@/lib/coaching-engine/types";

const MARATHON_M = 42195;
const GOAL_TIME_S = 3 * 3600 + 30 * 60;
const paceZones = derivePaceZones(MARATHON_M, GOAL_TIME_S);
const WEEK_TOTAL_M = 40 * 1609.34; // 40 mi

function distanceOf(prescription: ReturnType<typeof buildWeekPrescriptions>[number]): number {
  if (prescription.kind === "tempo") return prescription.warmupM + prescription.tempoM + prescription.cooldownM;
  if (prescription.kind === "vo2") {
    return prescription.warmupM + prescription.reps * prescription.repM + prescription.cooldownM;
  }
  return prescription.distanceM;
}

describe("buildWeekPrescriptions", () => {
  it("accounts for roughly the full week's mileage across easy/long-only weeks", () => {
    const slots: WorkoutType[] = ["long", "easy", "easy", "easy", "easy"];
    const prescriptions = buildWeekPrescriptions(slots, WEEK_TOTAL_M, paceZones, "base", MARATHON_M);
    const total = prescriptions.reduce((sum, p) => sum + distanceOf(p), 0);
    expect(total).toBeGreaterThan(WEEK_TOTAL_M * 0.9);
    expect(total).toBeLessThan(WEEK_TOTAL_M * 1.1);
  });

  it("gives the long run the largest single share of the week", () => {
    const slots: WorkoutType[] = ["long", "tempo", "easy", "easy", "easy"];
    const prescriptions = buildWeekPrescriptions(slots, WEEK_TOTAL_M, paceZones, "build", MARATHON_M);
    const distances = prescriptions.map(distanceOf);
    expect(Math.max(...distances)).toBe(distances[0]); // "long" is always slots[0] here
  });

  it("gives peak-phase long runs a bigger share than base-phase long runs", () => {
    const slots: WorkoutType[] = ["long", "easy", "easy", "easy", "easy"];
    const basePrescriptions = buildWeekPrescriptions(slots, WEEK_TOTAL_M, paceZones, "base", MARATHON_M);
    const peakPrescriptions = buildWeekPrescriptions(slots, WEEK_TOTAL_M, paceZones, "peak", MARATHON_M);
    expect(distanceOf(peakPrescriptions[0])).toBeGreaterThan(distanceOf(basePrescriptions[0]));
  });

  it("builds a structurally sound tempo prescription", () => {
    const slots: WorkoutType[] = ["long", "tempo", "easy"];
    const [, tempo] = buildWeekPrescriptions(slots, WEEK_TOTAL_M, paceZones, "build", MARATHON_M);
    if (tempo.kind !== "tempo") throw new Error("expected a tempo prescription");
    expect(tempo.tempoM).toBeGreaterThan(0);
    expect(tempo.warmupM).toBeGreaterThan(0);
    expect(tempo.cooldownM).toBeGreaterThan(0);
    expect(tempo.paceRangeSecPerKm).toEqual(paceZones.tempo);
  });

  it("builds a structurally sound vo2 prescription", () => {
    const slots: WorkoutType[] = ["long", "vo2", "easy", "easy", "easy"];
    const [, vo2] = buildWeekPrescriptions(slots, WEEK_TOTAL_M, paceZones, "peak", MARATHON_M);
    if (vo2.kind !== "vo2") throw new Error("expected a vo2 prescription");
    expect(vo2.reps).toBeGreaterThanOrEqual(3);
    expect(Number.isInteger(vo2.reps)).toBe(true);
    expect(vo2.repM).toBeGreaterThan(0);
    expect(vo2.paceRangeSecPerKm).toEqual(paceZones.interval);
  });

  it("handles race week as a fixed goal distance plus fixed-length shakeouts", () => {
    const slots: WorkoutType[] = ["race", "recovery", "recovery"];
    const prescriptions = buildWeekPrescriptions(slots, WEEK_TOTAL_M, paceZones, "taper", MARATHON_M);
    expect(prescriptions[0]).toEqual({ kind: "race", distanceM: MARATHON_M });
    expect(prescriptions[1].kind).toBe("recovery");
    expect(prescriptions[2].kind).toBe("recovery");
    // Shakeout distance is fixed, not drawn from weekTotalMeters.
    expect(distanceOf(prescriptions[1])).toBe(distanceOf(prescriptions[2]));
  });

  it("throws on an unsupported workout type in a non-race week", () => {
    const slots = ["strength"] as WorkoutType[];
    expect(() => buildWeekPrescriptions(slots, WEEK_TOTAL_M, paceZones, "base", MARATHON_M)).toThrow();
  });

  it("rounds every distance to the nearest 100m", () => {
    const slots: WorkoutType[] = ["long", "easy", "easy", "easy", "easy"];
    const prescriptions = buildWeekPrescriptions(slots, WEEK_TOTAL_M, paceZones, "base", MARATHON_M);
    for (const p of prescriptions) {
      if (p.kind === "easy" || p.kind === "long" || p.kind === "recovery") {
        expect(p.distanceM % 100).toBe(0);
      }
    }
  });

  describe("marathon-pace long-run segments (long-bucket goals only)", () => {
    const slots: WorkoutType[] = ["long", "easy", "easy", "easy", "easy"];

    it("never embeds a segment in base phase, even for a long-bucket goal", () => {
      const [long] = buildWeekPrescriptions(slots, WEEK_TOTAL_M, paceZones, "base", MARATHON_M);
      if (long.kind !== "long") throw new Error("expected a long prescription");
      expect(long.marathonPaceSegment).toBeUndefined();
      expect(long.paceRangeSecPerKm).toEqual(paceZones.steady);
    });

    it("embeds a marathon-pace segment in build phase once the long run is long enough", () => {
      const [long] = buildWeekPrescriptions(slots, WEEK_TOTAL_M, paceZones, "build", MARATHON_M);
      if (long.kind !== "long") throw new Error("expected a long prescription");
      expect(long.marathonPaceSegment).toBeDefined();
      expect(long.paceRangeSecPerKm).toEqual(paceZones.easy);
      expect(long.marathonPaceSegment?.paceRangeSecPerKm).toEqual(paceZones.steady);
      expect(long.marathonPaceSegment!.distanceM).toBeLessThan(long.distanceM);
    });

    it("gives peak phase a bigger marathon-pace segment than build phase", () => {
      const [buildLong] = buildWeekPrescriptions(slots, WEEK_TOTAL_M, paceZones, "build", MARATHON_M);
      const [peakLong] = buildWeekPrescriptions(slots, WEEK_TOTAL_M, paceZones, "peak", MARATHON_M);
      if (buildLong.kind !== "long" || peakLong.kind !== "long") throw new Error("expected long prescriptions");
      expect(peakLong.marathonPaceSegment!.distanceM).toBeGreaterThan(buildLong.marathonPaceSegment!.distanceM);
    });

    it("never embeds a segment for a short/middle-bucket goal, even in build/peak phase", () => {
      const fiveKPaceZones = derivePaceZones(5000, 20 * 60);
      for (const phase of ["build", "peak"] as const) {
        const [long] = buildWeekPrescriptions(slots, WEEK_TOTAL_M, fiveKPaceZones, phase, 5000);
        if (long.kind !== "long") throw new Error("expected a long prescription");
        expect(long.marathonPaceSegment).toBeUndefined();
      }
    });

    it("skips the segment when the long run itself is too short to embed one meaningfully", () => {
      const [long] = buildWeekPrescriptions(slots, 10 * 1609.34, paceZones, "build", MARATHON_M);
      if (long.kind !== "long") throw new Error("expected a long prescription");
      expect(long.marathonPaceSegment).toBeUndefined();
    });
  });

  describe("suggested shakeouts (6 days/week, either training voice)", () => {
    const sixDaySlots: WorkoutType[] = ["long", "tempo", "easy", "easy", "easy", "easy"];
    const fiveDaySlots: WorkoutType[] = ["long", "tempo", "easy", "easy", "easy"];

    it("suggests a shakeout in base/build/peak phase at 6 days/week", () => {
      for (const phase of ["base", "build", "peak"] as const) {
        const [long] = buildWeekPrescriptions(sixDaySlots, WEEK_TOTAL_M, paceZones, phase, MARATHON_M);
        if (long.kind !== "long") throw new Error("expected a long prescription");
        expect(long.suggestedShakeout).toBeDefined();
        expect(long.suggestedShakeout!.paceRangeSecPerKm).toEqual(paceZones.easy);
      }
    });

    it("does not suggest a shakeout below 6 days/week", () => {
      const [long] = buildWeekPrescriptions(fiveDaySlots, WEEK_TOTAL_M, paceZones, "build", MARATHON_M);
      if (long.kind !== "long") throw new Error("expected a long prescription");
      expect(long.suggestedShakeout).toBeUndefined();
    });

    it("does not suggest a shakeout in taper or recovery phase", () => {
      for (const phase of ["taper", "recovery"] as const) {
        const [long] = buildWeekPrescriptions(sixDaySlots, WEEK_TOTAL_M, paceZones, phase, MARATHON_M);
        if (long.kind !== "long") throw new Error("expected a long prescription");
        expect(long.suggestedShakeout).toBeUndefined();
      }
    });

    it("grows the suggested shakeout's duration (via distance) from base to peak", () => {
      const [baseLong] = buildWeekPrescriptions(sixDaySlots, WEEK_TOTAL_M, paceZones, "base", MARATHON_M);
      const [peakLong] = buildWeekPrescriptions(sixDaySlots, WEEK_TOTAL_M, paceZones, "peak", MARATHON_M);
      if (baseLong.kind !== "long" || peakLong.kind !== "long") throw new Error("expected long prescriptions");
      expect(peakLong.suggestedShakeout!.distanceM).toBeGreaterThan(baseLong.suggestedShakeout!.distanceM);
    });

    it("suggests a shakeout for XC-voice (short-bucket) goals too, same trigger", () => {
      const fiveKPaceZones = derivePaceZones(5000, 20 * 60);
      const [long] = buildWeekPrescriptions(sixDaySlots, WEEK_TOTAL_M, fiveKPaceZones, "build", 5000);
      if (long.kind !== "long") throw new Error("expected a long prescription");
      expect(long.suggestedShakeout).toBeDefined();
    });
  });
});
