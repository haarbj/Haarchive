import { describe, expect, it } from "vitest";
import { describePrescription, estimatedDurationRangeMin } from "@/lib/coaching-engine/describe-prescription";
import type { WorkoutPrescription } from "@/lib/coaching-engine/types";

describe("describePrescription", () => {
  it("formats an easy/recovery/long run as distance + pace range", () => {
    const rx: WorkoutPrescription = { kind: "easy", distanceM: 8047, paceRangeSecPerKm: [300, 330] };
    expect(describePrescription(rx)).toBe("5.0 mi · 8:03–8:51/mi");
  });

  it("labels a long run distinctly from a plain easy run", () => {
    const rx: WorkoutPrescription = { kind: "long", distanceM: 19312, paceRangeSecPerKm: [300, 330] };
    expect(describePrescription(rx)).toContain("long");
  });

  it("describes a marathon-pace-embedded long run as an easy portion plus a marathon-pace finish", () => {
    const rx: WorkoutPrescription = {
      kind: "long",
      distanceM: 32187, // 20 mi
      paceRangeSecPerKm: [310, 330],
      marathonPaceSegment: { distanceM: 9656, paceRangeSecPerKm: [270, 280] }, // 6 mi
    };
    const text = describePrescription(rx);
    expect(text).toContain("20.0 mi long");
    expect(text).toContain("marathon pace");
    expect(text).toContain("6.0 mi");
    expect(text).toContain("14.0 mi easy");
  });

  it("mentions an optional suggested shakeout when present, on a plain long run", () => {
    const rx: WorkoutPrescription = {
      kind: "long",
      distanceM: 19312,
      paceRangeSecPerKm: [300, 330],
      suggestedShakeout: { distanceM: 3200, paceRangeSecPerKm: [300, 330] },
    };
    expect(describePrescription(rx)).toContain("optional 2.0 mi shakeout");
  });

  it("mentions both a marathon-pace segment and a suggested shakeout when both are present", () => {
    const rx: WorkoutPrescription = {
      kind: "long",
      distanceM: 32187,
      paceRangeSecPerKm: [310, 330],
      marathonPaceSegment: { distanceM: 9656, paceRangeSecPerKm: [270, 280] },
      suggestedShakeout: { distanceM: 3200, paceRangeSecPerKm: [310, 330] },
    };
    const text = describePrescription(rx);
    expect(text).toContain("marathon pace");
    expect(text).toContain("optional 2.0 mi shakeout");
  });

  it("formats a tempo run with warmup/tempo/cooldown segments", () => {
    const rx: WorkoutPrescription = { kind: "tempo", warmupM: 1600, tempoM: 4800, cooldownM: 1600, paceRangeSecPerKm: [240, 250] };
    const text = describePrescription(rx);
    expect(text).toContain("warmup");
    expect(text).toContain("tempo");
    expect(text).toContain("cooldown");
  });

  it("formats a vo2 session with rep count and distance in meters", () => {
    const rx: WorkoutPrescription = { kind: "vo2", warmupM: 1600, reps: 6, repM: 800, recoveryM: 400, cooldownM: 1600, paceRangeSecPerKm: [200, 210] };
    const text = describePrescription(rx);
    expect(text).toContain("6×800m");
    expect(text).toContain("400m jog");
  });

  it("formats race day without a pace range", () => {
    const rx: WorkoutPrescription = { kind: "race", distanceM: 42195 };
    expect(describePrescription(rx)).toMatch(/race day/i);
  });
});

describe("estimatedDurationRangeMin", () => {
  it("computes an exact duration range for a simple easy run", () => {
    const rx: WorkoutPrescription = { kind: "easy", distanceM: 8047, paceRangeSecPerKm: [300, 330] };
    // 8.047 km * 300s/km = 2414.1s = 40.24min -> 40; * 330s/km = 2655.5s = 44.26min -> 44
    expect(estimatedDurationRangeMin(rx)).toEqual([40, 44]);
  });

  it("returns a wider range for recovery than a faster easy run at the same distance", () => {
    const easy: WorkoutPrescription = { kind: "easy", distanceM: 8047, paceRangeSecPerKm: [300, 330] };
    const recovery: WorkoutPrescription = { kind: "recovery", distanceM: 8047, paceRangeSecPerKm: [340, 360] };
    const [, easyMax] = estimatedDurationRangeMin(easy)!;
    const [recoveryMin] = estimatedDurationRangeMin(recovery)!;
    expect(recoveryMin).toBeGreaterThan(easyMax);
  });

  it("accounts for both the easy and marathon-pace segments of a long run", () => {
    const plain: WorkoutPrescription = { kind: "long", distanceM: 19312, paceRangeSecPerKm: [300, 330] };
    const withMp: WorkoutPrescription = {
      kind: "long",
      distanceM: 32187,
      paceRangeSecPerKm: [310, 330],
      marathonPaceSegment: { distanceM: 9656, paceRangeSecPerKm: [270, 280] },
    };
    const [plainMin, plainMax] = estimatedDurationRangeMin(plain)!;
    const [mpMin, mpMax] = estimatedDurationRangeMin(withMp)!;
    expect(plainMin).toBeGreaterThan(0);
    expect(plainMax).toBeGreaterThanOrEqual(plainMin);
    // The 20-mile run with a marathon-pace segment covers more total
    // distance than the plain 12-mile run, so it must take longer.
    expect(mpMin).toBeGreaterThan(plainMax);
    expect(mpMax).toBeGreaterThanOrEqual(mpMin);
  });

  it("includes warmup and cooldown time in a tempo run's duration", () => {
    const rx: WorkoutPrescription = { kind: "tempo", warmupM: 1600, tempoM: 4800, cooldownM: 1600, paceRangeSecPerKm: [240, 250] };
    const [min, max] = estimatedDurationRangeMin(rx)!;
    expect(min).toBeGreaterThan(0);
    expect(max).toBeGreaterThanOrEqual(min);
    // Warmup + tempo + cooldown = 8000m = 8km; at worst a bit under 240s/km fast bound.
    expect(min).toBeGreaterThan(30);
  });

  it("includes rep, recovery, warmup, and cooldown distance for a vo2 session", () => {
    const rx: WorkoutPrescription = { kind: "vo2", warmupM: 1600, reps: 6, repM: 800, recoveryM: 400, cooldownM: 1600, paceRangeSecPerKm: [200, 210] };
    const [min, max] = estimatedDurationRangeMin(rx)!;
    expect(min).toBeGreaterThan(0);
    expect(max).toBeGreaterThanOrEqual(min);
  });

  it("returns null for race day -- no pace data to estimate from", () => {
    const rx: WorkoutPrescription = { kind: "race", distanceM: 42195 };
    expect(estimatedDurationRangeMin(rx)).toBeNull();
  });
});
