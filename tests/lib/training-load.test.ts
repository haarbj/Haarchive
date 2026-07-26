import { describe, expect, it } from "vitest";

import { buildTrainingLoadSeries, computeWorkoutLoad } from "@/lib/training-load";
import type { PhysiologyProfile } from "@/lib/physiology-engine";

const PROFILE: PhysiologyProfile = {
  criticalSpeedMS: 4.0,
  vo2maxSpeedMS: 5.2,
  weightKg: 70,
  durability: "average",
};

describe("computeWorkoutLoad", () => {
  it("returns percentages in a sane 0-100 range for a long easy run", () => {
    const load = computeWorkoutLoad(PROFILE, { id: "a", completedAt: "2026-01-01T08:00:00Z", distanceM: 16000, timeSeconds: 6000 });
    expect(load.glycogenDepletedPct).toBeGreaterThan(0);
    expect(load.glycogenDepletedPct).toBeLessThanOrEqual(100);
    expect(load.cardiacDriftPct).toBeGreaterThanOrEqual(0);
    expect(load.wPrimeUsedPct).toBeGreaterThanOrEqual(0);
    expect(load.wPrimeUsedPct).toBeLessThanOrEqual(100);
  });

  it("shows near-zero W'-balance usage for an easy run well below critical speed", () => {
    // ~2.8 m/s (~9:30/mi) against a 4.0 m/s critical speed -- comfortably
    // sub-threshold, which is the whole reason W'-balance is a poor signal
    // for typical training days (it only depletes above critical speed).
    const load = computeWorkoutLoad(PROFILE, { id: "a", completedAt: "2026-01-01T08:00:00Z", distanceM: 10000, timeSeconds: 3600 });
    expect(load.wPrimeUsedPct).toBeLessThan(1);
  });

  it("shows meaningfully more glycogen depletion for a longer run than a shorter one at the same pace", () => {
    const speedMS = 3.0;
    const short = computeWorkoutLoad(PROFILE, { id: "a", completedAt: "2026-01-01T08:00:00Z", distanceM: 5000, timeSeconds: 5000 / speedMS });
    const long = computeWorkoutLoad(PROFILE, { id: "b", completedAt: "2026-01-02T08:00:00Z", distanceM: 20000, timeSeconds: 20000 / speedMS });
    expect(long.glycogenDepletedPct).toBeGreaterThan(short.glycogenDepletedPct);
    expect(long.cardiacDriftPct).toBeGreaterThan(short.cardiacDriftPct);
  });
});

describe("buildTrainingLoadSeries", () => {
  it("sorts workouts chronologically regardless of input order", () => {
    const series = buildTrainingLoadSeries(PROFILE, [
      { id: "b", completedAt: "2026-03-01T08:00:00Z", distanceM: 8000, timeSeconds: 2400 },
      { id: "a", completedAt: "2026-01-01T08:00:00Z", distanceM: 8000, timeSeconds: 2400 },
    ]);
    expect(series.map((p) => p.id)).toEqual(["a", "b"]);
  });
});
