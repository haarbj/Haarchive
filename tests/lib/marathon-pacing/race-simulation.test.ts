import { describe, expect, it } from "vitest";

import { generatePacingPlan } from "@/lib/marathon-pacing/split-generator";
import type { CourseAnalysis } from "@/lib/marathon-pacing/course-analysis";
import {
  percentileFinishTime,
  probabilityUnder,
  sampleCriticalSpeedMS,
  sampleStandardNormal,
  simulateFinishTimes,
} from "@/lib/marathon-pacing/race-simulation";

const METERS_PER_MILE = 1609.344;

function buildCourse(mileCount: number): CourseAnalysis {
  const perMileGrade = new Array(mileCount).fill(0);
  return {
    totalDistanceM: mileCount * METERS_PER_MILE,
    totalClimbM: 0,
    totalDescentM: 0,
    avgGrade: 0,
    gradeHistogram: [],
    climbs: [],
    descents: [],
    longestClimb: null,
    steepestClimb: null,
    longestDescent: null,
    steepestDescent: null,
    rollingIndex: 0,
    downhillSeverityScore: 0,
    perMileGrade,
    perMileTerrainCostJPerKg: perMileGrade.map(() => 0),
    perMileHeadingDeg: perMileGrade.map(() => null),
  };
}

const CRITICAL_SPEED_MS = 4.2;
const VO2MAX_SPEED_MS = 5.3;

describe("sampleCriticalSpeedMS", () => {
  it("returns exactly p50 at z=0", () => {
    expect(sampleCriticalSpeedMS({ p10: 3.8, p50: 4.2, p90: 4.6 }, 0)).toBeCloseTo(4.2, 10);
  });

  it("uses the upper spread for positive z and the lower spread for negative z, respecting asymmetry", () => {
    const percentiles = { p10: 4.0, p50: 4.2, p90: 4.8 }; // wider spread above p50 than below
    const above = sampleCriticalSpeedMS(percentiles, 1);
    const below = sampleCriticalSpeedMS(percentiles, -1);
    expect(above - 4.2).toBeGreaterThan(4.2 - below);
  });
});

describe("sampleStandardNormal", () => {
  it("is deterministic given a fixed random source", () => {
    const a = sampleStandardNormal(() => 0.3);
    const b = sampleStandardNormal(() => 0.3);
    expect(a).toBe(b);
  });
});

describe("simulateFinishTimes", () => {
  it("reproduces the original plan's finish time when the percentile spread is centered on the same critical speed and z=0", () => {
    const course = buildCourse(10);
    const plan = generatePacingPlan({
      course,
      goalTimeSeconds: 4000,
      criticalSpeedMS: CRITICAL_SPEED_MS,
      vo2maxSpeedMS: VO2MAX_SPEED_MS,
      strategyId: "even-effort",
      risk: "moderate",
    });

    const baseInputs = {
      course,
      criticalSpeedMS: CRITICAL_SPEED_MS,
      strategyId: "even-effort" as const,
      risk: "moderate" as const,
      weightKg: 70,
      windProfile: "suburban" as const,
      weatherConditions: undefined,
      costBreakdown: plan.costBreakdown,
    };

    const result = simulateFinishTimes(
      plan.goalEffortFraction,
      baseInputs,
      { p10: CRITICAL_SPEED_MS - 0.1, p50: CRITICAL_SPEED_MS, p90: CRITICAL_SPEED_MS + 0.1 },
      5,
      () => 0.5, // Box-Muller with u1=u2=0.5 gives a fixed, nonzero z -- see below
    );

    // Not exactly z=0 (this random source doesn't produce that), but every
    // iteration uses the SAME z, so every simulated finish time should be
    // identical to each other regardless of what that z happens to be.
    expect(new Set(result.finishTimesSeconds.map((t) => t.toFixed(6))).size).toBe(1);
  });

  it("produces a spread of finish times, faster for higher sampled critical speed", () => {
    const course = buildCourse(10);
    const plan = generatePacingPlan({
      course,
      goalTimeSeconds: 4000,
      criticalSpeedMS: CRITICAL_SPEED_MS,
      vo2maxSpeedMS: VO2MAX_SPEED_MS,
      strategyId: "even-effort",
      risk: "moderate",
    });

    const baseInputs = {
      course,
      criticalSpeedMS: CRITICAL_SPEED_MS,
      strategyId: "even-effort" as const,
      risk: "moderate" as const,
      weightKg: 70,
      windProfile: "suburban" as const,
      weatherConditions: undefined,
      costBreakdown: plan.costBreakdown,
    };

    // Cycle through a spread of "random" values so z varies across iterations.
    const values = [0.05, 0.2, 0.5, 0.8, 0.95];
    let i = 0;
    const cyclingRandom = () => values[i++ % values.length];

    const result = simulateFinishTimes(
      plan.goalEffortFraction,
      baseInputs,
      { p10: CRITICAL_SPEED_MS - 0.3, p50: CRITICAL_SPEED_MS, p90: CRITICAL_SPEED_MS + 0.3 },
      20,
      cyclingRandom,
    );

    expect(result.finishTimesSeconds.length).toBe(20);
    // Sorted ascending, and not all identical -- real variance.
    expect(result.finishTimesSeconds[0]).toBeLessThanOrEqual(result.finishTimesSeconds[result.finishTimesSeconds.length - 1]);
    expect(new Set(result.finishTimesSeconds).size).toBeGreaterThan(1);
  });
});

describe("percentileFinishTime", () => {
  it("returns the minimum at p0 and the maximum at p100", () => {
    const result = { finishTimesSeconds: [100, 200, 300, 400, 500] };
    expect(percentileFinishTime(result, 0)).toBe(100);
    expect(percentileFinishTime(result, 100)).toBe(500);
  });

  it("returns the middle value at p50 for an odd-length array", () => {
    const result = { finishTimesSeconds: [100, 200, 300, 400, 500] };
    expect(percentileFinishTime(result, 50)).toBe(300);
  });
});

describe("probabilityUnder", () => {
  it("computes the fraction of simulations at or under a given time", () => {
    const result = { finishTimesSeconds: [100, 200, 300, 400, 500] };
    expect(probabilityUnder(result, 300)).toBeCloseTo(0.6, 5);
    expect(probabilityUnder(result, 50)).toBe(0);
    expect(probabilityUnder(result, 500)).toBe(1);
  });
});
