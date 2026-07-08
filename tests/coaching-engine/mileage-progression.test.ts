import { describe, expect, it } from "vitest";
import { buildWeeklyMileagePlan } from "@/lib/coaching-engine/mileage-progression";
import { allocateMesocycles, buildWeeklyPhaseSequence } from "@/lib/coaching-engine/periodization";
import type { WeekPlan } from "@/lib/coaching-engine/types";

const MARATHON_M = 42195;
const STARTING_METERS = 30 * 1609.34; // 30 mi/week

function planWeeks(totalWeeks: number, distanceM: number): WeekPlan[] {
  return buildWeeklyPhaseSequence(allocateMesocycles(totalWeeks, distanceM));
}

describe("buildWeeklyMileagePlan", () => {
  it("returns one figure per week", () => {
    const weeks = planWeeks(16, MARATHON_M);
    const volumes = buildWeeklyMileagePlan(weeks, STARTING_METERS, MARATHON_M);
    expect(volumes).toHaveLength(weeks.length);
  });

  it("never increases more than 10% over the last ramp week", () => {
    const weeks = planWeeks(20, MARATHON_M);
    const volumes = buildWeeklyMileagePlan(weeks, STARTING_METERS, MARATHON_M);
    // The 10% rule is measured against the last real ramp week, not the
    // immediately preceding calendar week -- the week right after a
    // cutback is *supposed* to jump back up past the cutback's reduced
    // number, continuing the ramp it interrupted, not gently stepping up
    // from the dip.
    let lastRampVolume = volumes[0];
    for (let i = 1; i < weeks.length; i++) {
      if (weeks[i].phase === "taper" || weeks[i].isCutback) continue;
      const ratio = volumes[i] / lastRampVolume;
      // Both sides are already rounded to the nearest meter, so a ratio of
      // two ~30,000m figures can drift a few parts-per-million off the
      // exact 1.10 -- a generous but still real tolerance, wide enough to
      // absorb that rounding without masking an actual algorithmic bug.
      expect(ratio).toBeLessThanOrEqual(1.1 + 1e-4);
      lastRampVolume = volumes[i];
    }
  });

  it("drops a cutback week below the ramp week immediately before it", () => {
    const weeks = planWeeks(16, MARATHON_M);
    const volumes = buildWeeklyMileagePlan(weeks, STARTING_METERS, MARATHON_M);
    const cutbackIndex = weeks.findIndex((w) => w.isCutback);
    expect(cutbackIndex).toBeGreaterThan(0);
    expect(volumes[cutbackIndex]).toBeLessThan(volumes[cutbackIndex - 1]);
  });

  it("steps mileage down monotonically through taper, lowest in the final week", () => {
    const weeks = planWeeks(16, MARATHON_M);
    const volumes = buildWeeklyMileagePlan(weeks, STARTING_METERS, MARATHON_M);
    const taperStart = weeks.findIndex((w) => w.phase === "taper");
    expect(taperStart).toBeGreaterThan(0);

    const taperVolumes = volumes.slice(taperStart);
    for (let i = 1; i < taperVolumes.length; i++) {
      expect(taperVolumes[i]).toBeLessThanOrEqual(taperVolumes[i - 1]);
    }
    // The very last week (race week) must be the lowest-volume week of the
    // entire plan -- this is the regression test for an earlier version of
    // this function that had the taper reduction backwards.
    expect(volumes.at(-1)).toBe(Math.min(...volumes));
  });

  it("never exceeds the distance-appropriate peak ceiling", () => {
    const weeks = planWeeks(30, MARATHON_M);
    const volumes = buildWeeklyMileagePlan(weeks, STARTING_METERS, MARATHON_M);
    const ceiling = STARTING_METERS * 1.5; // long-bucket PEAK_MULTIPLIER
    for (const volume of volumes) {
      expect(volume).toBeLessThanOrEqual(Math.round(ceiling) + 1);
    }
  });

  it("only ever produces positive whole numbers", () => {
    const weeks = planWeeks(12, 5000);
    const volumes = buildWeeklyMileagePlan(weeks, 15 * 1609.34, 5000);
    for (const volume of volumes) {
      expect(Number.isInteger(volume)).toBe(true);
      expect(volume).toBeGreaterThan(0);
    }
  });
});
