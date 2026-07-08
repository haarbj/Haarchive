import { describe, expect, it } from "vitest";
import { describePrescription } from "@/lib/coaching-engine/describe-prescription";
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
