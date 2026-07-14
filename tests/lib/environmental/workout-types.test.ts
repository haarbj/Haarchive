import { describe, expect, it } from "vitest";

import { WORKOUT_TYPE_CONFIG, WORKOUT_TYPE_ORDER, type WorkoutType } from "@/lib/environmental/workout-types";

describe("WORKOUT_TYPE_CONFIG", () => {
  it("has a config entry for every type in WORKOUT_TYPE_ORDER", () => {
    for (const type of WORKOUT_TYPE_ORDER) {
      expect(WORKOUT_TYPE_CONFIG[type]).toBeDefined();
    }
  });

  it("has no config entries missing from WORKOUT_TYPE_ORDER", () => {
    const configKeys = Object.keys(WORKOUT_TYPE_CONFIG) as WorkoutType[];
    expect(configKeys.sort()).toEqual([...WORKOUT_TYPE_ORDER].sort());
  });

  it("gives every workout type a non-empty label, target system, and drift description", () => {
    for (const type of WORKOUT_TYPE_ORDER) {
      const config = WORKOUT_TYPE_CONFIG[type];
      expect(config.label.length).toBeGreaterThan(0);
      expect(config.targetSystem.length).toBeGreaterThan(0);
      expect(config.driftDescription.length).toBeGreaterThan(0);
      expect(["continuous", "interval"]).toContain(config.structure);
    }
  });

  it("has unique labels", () => {
    const labels = WORKOUT_TYPE_ORDER.map((type) => WORKOUT_TYPE_CONFIG[type].label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("gives every workout type a valid defaultSpeedOrEffort assumption", () => {
    for (const type of WORKOUT_TYPE_ORDER) {
      expect(["constant-effort", "constant-speed"]).toContain(WORKOUT_TYPE_CONFIG[type].defaultSpeedOrEffort);
    }
  });
});
