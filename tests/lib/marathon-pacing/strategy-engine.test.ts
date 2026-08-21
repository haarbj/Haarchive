import { describe, expect, it } from "vitest";

import {
  PACING_STRATEGIES,
  effortAtRaceFraction,
  type EffortCurvePoint,
  type RiskLevel,
} from "@/lib/marathon-pacing/strategy-engine";
import type { ClimbSegment, CourseAnalysis } from "@/lib/marathon-pacing/course-analysis";

const METERS_PER_MILE = 1609.344;
const MARATHON_M = 26.2 * METERS_PER_MILE;

function integrate(points: EffortCurvePoint[]): number {
  let area = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    area += ((b.raceFraction - a.raceFraction) * (a.targetEffortFraction + b.targetEffortFraction)) / 2;
  }
  return area;
}

function buildCourse(overrides: Partial<CourseAnalysis> = {}): CourseAnalysis {
  const mileCount = Math.floor(MARATHON_M / METERS_PER_MILE);
  return {
    totalDistanceM: MARATHON_M,
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
    perMileGrade: new Array(mileCount).fill(0),
    perMileTerrainCostJPerKg: new Array(mileCount).fill(0),
    perMileAltitudeM: new Array(mileCount).fill(0),
    perMileHeadingDeg: new Array(mileCount).fill(null),
    ...overrides,
  };
}

const GOAL_EFFORT = 0.85;
const RISK_LEVELS: RiskLevel[] = ["low", "moderate", "high"];

describe("Even Effort", () => {
  it("holds a flat curve at exactly the goal effort", () => {
    const course = buildCourse();
    const curve = PACING_STRATEGIES["even-effort"].buildEffortCurve({ course, goalEffortFraction: GOAL_EFFORT, risk: "moderate" });
    expect(integrate(curve)).toBeCloseTo(GOAL_EFFORT, 10);
    expect(effortAtRaceFraction(curve, 0.3)).toBeCloseTo(GOAL_EFFORT, 10);
    expect(effortAtRaceFraction(curve, 0.9)).toBeCloseTo(GOAL_EFFORT, 10);
  });
});

describe("Negative Split", () => {
  it("settles in below goal effort early, holds goal effort through the flat middle, then rises above it late", () => {
    const course = buildCourse();
    const curve = PACING_STRATEGIES["negative-split"].buildEffortCurve({ course, goalEffortFraction: GOAL_EFFORT, risk: "moderate" });

    expect(effortAtRaceFraction(curve, 0.01)).toBeLessThan(GOAL_EFFORT); // conservative right from the gun
    expect(effortAtRaceFraction(curve, 0.4)).toBeCloseTo(GOAL_EFFORT, 2); // flat cruise through the bulk of the race
    expect(effortAtRaceFraction(curve, 0.99)).toBeGreaterThan(GOAL_EFFORT); // progressive finish
    expect(integrate(curve)).toBeCloseTo(GOAL_EFFORT, 6);
  });

  it("never jumps abruptly anywhere across the whole curve -- every transition is a continuous ramp, not a step", () => {
    const course = buildCourse();
    const curve = PACING_STRATEGIES["negative-split"].buildEffortCurve({ course, goalEffortFraction: GOAL_EFFORT, risk: "high" }); // largest swing, the toughest case

    const samples: number[] = [];
    for (let f = 0; f <= 1; f += 0.004) samples.push(effortAtRaceFraction(curve, f)); // roughly every 0.1 mile on a marathon

    const totalSwing = effortAtRaceFraction(curve, 1) - effortAtRaceFraction(curve, 0);
    expect(totalSwing).toBeGreaterThan(0); // the transition still genuinely happens

    for (let i = 1; i < samples.length; i++) {
      const step = Math.abs(samples[i] - samples[i - 1]);
      expect(step).toBeLessThan(totalSwing * 0.1); // no single ~0.1mi step carries more than ~10% of the whole start-to-finish swing
    }
  });

  it("swings more at higher risk tolerance", () => {
    const course = buildCourse();
    const swings = RISK_LEVELS.map((risk) => {
      const curve = PACING_STRATEGIES["negative-split"].buildEffortCurve({ course, goalEffortFraction: GOAL_EFFORT, risk });
      return GOAL_EFFORT - effortAtRaceFraction(curve, 0);
    });
    expect(swings[0]).toBeLessThan(swings[1]);
    expect(swings[1]).toBeLessThan(swings[2]);
  });
});

describe("Positive Split", () => {
  it("holds an elevated effort through most of the race, then fades below goal effort late, averaging back to goal when the ceiling isn't hit", () => {
    const course = buildCourse();
    const curve = PACING_STRATEGIES["positive-split"].buildEffortCurve({ course, goalEffortFraction: GOAL_EFFORT, risk: "moderate" });

    expect(effortAtRaceFraction(curve, 0.01)).toBeGreaterThan(GOAL_EFFORT);
    expect(effortAtRaceFraction(curve, 0.4)).toBeGreaterThan(GOAL_EFFORT); // still in the elevated cruise phase
    expect(effortAtRaceFraction(curve, 0.99)).toBeLessThan(GOAL_EFFORT);
    expect(integrate(curve)).toBeCloseTo(GOAL_EFFORT, 6);
  });

  it("clamps the opening effort at the risk ceiling instead of renormalizing back past it, when the goal is already close to unsafe", () => {
    const course = buildCourse();
    const aggressiveGoal = 0.95; // well above "low" risk's 0.88 ceiling once swung upward
    const curve = PACING_STRATEGIES["positive-split"].buildEffortCurve({ course, goalEffortFraction: aggressiveGoal, risk: "low" });

    const firstHalfEffort = effortAtRaceFraction(curve, 0);
    expect(firstHalfEffort).toBeCloseTo(0.88, 10); // exactly the "low" risk ceiling, not renormalized above it
    // The curve's own average is honestly below the goal -- signaling the goal
    // isn't safely reachable with this strategy/risk combination, rather than
    // silently pretending it is.
    expect(integrate(curve)).toBeLessThan(aggressiveGoal);
  });
});

describe("Boston Strategy", () => {
  it("holds back through a net-downhill start and stays controlled through a significant late climb, releasing after it", () => {
    const mileCount = 26;
    const perMileGrade = new Array(mileCount).fill(0);
    for (let i = 0; i < 4; i++) perMileGrade[i] = -0.03; // net-downhill start, first ~15%

    const lateClimb: ClimbSegment = {
      startDistanceM: MARATHON_M * 0.6,
      endDistanceM: MARATHON_M * 0.75,
      distanceM: MARATHON_M * 0.15,
      gainM: 120,
      avgGrade: 0.04,
      maxGrade: 0.07,
    };

    const course = buildCourse({ perMileGrade, climbs: [lateClimb] });
    const curve = PACING_STRATEGIES["boston-strategy"].buildEffortCurve({ course, goalEffortFraction: GOAL_EFFORT, risk: "moderate" });

    expect(effortAtRaceFraction(curve, 0.05)).toBeLessThan(GOAL_EFFORT); // downhill-start caution
    expect(effortAtRaceFraction(curve, 0.65)).toBeLessThan(GOAL_EFFORT); // controlled through the climb
    expect(effortAtRaceFraction(curve, 0.95)).toBeGreaterThan(GOAL_EFFORT); // release after clearing it
    expect(integrate(curve)).toBeCloseTo(GOAL_EFFORT, 6);
  });

  it("degrades to essentially Even Effort on a course with no downhill start and no significant late climb", () => {
    const course = buildCourse(); // perfectly flat by default
    const curve = PACING_STRATEGIES["boston-strategy"].buildEffortCurve({ course, goalEffortFraction: GOAL_EFFORT, risk: "moderate" });

    for (const raceFraction of [0, 0.2, 0.5, 0.8, 1]) {
      expect(effortAtRaceFraction(curve, raceFraction)).toBeCloseTo(GOAL_EFFORT, 6);
    }
  });
});

describe("effortAtRaceFraction", () => {
  it("linearly interpolates between two points", () => {
    const curve: EffortCurvePoint[] = [
      { raceFraction: 0, targetEffortFraction: 0.8 },
      { raceFraction: 1, targetEffortFraction: 0.9 },
    ];
    expect(effortAtRaceFraction(curve, 0.5)).toBeCloseTo(0.85, 10);
  });

  it("clamps queries outside the curve's own range to the nearest endpoint", () => {
    const curve: EffortCurvePoint[] = [
      { raceFraction: 0, targetEffortFraction: 0.8 },
      { raceFraction: 1, targetEffortFraction: 0.9 },
    ];
    expect(effortAtRaceFraction(curve, -0.5)).toBeCloseTo(0.8, 10);
    expect(effortAtRaceFraction(curve, 1.5)).toBeCloseTo(0.9, 10);
  });
});
