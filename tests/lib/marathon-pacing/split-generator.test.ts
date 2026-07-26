import { describe, expect, it } from "vitest";

import { generatePacingPlan } from "@/lib/marathon-pacing/split-generator";
import type { CourseAnalysis } from "@/lib/marathon-pacing/course-analysis";
import type { WeatherConditions } from "@/lib/environmental/fetch-weather-conditions";

function hotWeather(): WeatherConditions {
  return {
    tempC: 32,
    relativeHumidityPct: 80,
    dewPointC: 27,
    cloudCoverPct: 10,
    pressureHPa: 1013,
    windSpeedMS: 0,
    windFromBearingDeg: 0,
    windGustsMS: 0,
  };
}

const METERS_PER_MILE = 1609.344;

function buildCourse(perMileGrade: number[], perMileHeadingDeg: (number | null)[] = []): CourseAnalysis {
  return {
    totalDistanceM: perMileGrade.length * METERS_PER_MILE,
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
    perMileHeadingDeg: perMileHeadingDeg.length > 0 ? perMileHeadingDeg : perMileGrade.map(() => null),
  };
}

const CRITICAL_SPEED_MS = 4.2; // ~6:23/mi
const VO2MAX_SPEED_MS = 5.3;
const GOAL_TIME_SECONDS = 3 * 3600 + 30 * 60; // 3:30:00

describe("generatePacingPlan", () => {
  it("hits the goal time almost exactly on a flat, calm course with Even Effort", () => {
    const mileCount = 10;
    const course = buildCourse(new Array(mileCount).fill(0));
    // With zero grade, zero wind, and no weather input, Even Effort holds
    // speed exactly at goalSpeedMS for every mile, so total time should
    // reproduce the goal almost exactly (any residual gap is float error).
    const goalTimeSeconds = GOAL_TIME_SECONDS * (mileCount / 26.2);
    const plan = generatePacingPlan({
      course,
      goalTimeSeconds,
      criticalSpeedMS: CRITICAL_SPEED_MS,
      vo2maxSpeedMS: VO2MAX_SPEED_MS,
      strategyId: "even-effort",
      risk: "moderate",
    });

    // Within a second over ~80 minutes -- the residual is the grade/wind
    // equivalence solvers' own bisection tolerance compounding across miles,
    // not a modeling error.
    expect(plan.totalTimeSeconds).toBeCloseTo(goalTimeSeconds, 0);
  });

  it("hits the goal time on a meaningfully net-downhill course too, not just a flat one", () => {
    // Reproduces a real user report: a 2:38:00 Boston goal (net downhill,
    // ~650ft of descent) was projecting a 2:34:35 finish -- entirely
    // explained by computing target effort as if the course were flat, then
    // applying that same effort to the real, net-downhill terrain, which
    // runs faster than the flat-equivalent pace for the same effort. Every
    // mile here descends 3%, so naively this would run substantially faster
    // than goal; the solved effort should compensate so the total still
    // lands on the goal almost exactly.
    const course = buildCourse(new Array(20).fill(-0.03));
    const goalTimeSeconds = GOAL_TIME_SECONDS * (20 / 26.2);
    const plan = generatePacingPlan({
      course,
      goalTimeSeconds,
      criticalSpeedMS: CRITICAL_SPEED_MS,
      vo2maxSpeedMS: VO2MAX_SPEED_MS,
      strategyId: "even-effort",
      risk: "moderate",
    });

    expect(plan.totalTimeSeconds).toBeCloseTo(goalTimeSeconds, 0);
  });

  it("hits the goal time on a meaningfully net-uphill course too", () => {
    const course = buildCourse(new Array(20).fill(0.03));
    const goalTimeSeconds = GOAL_TIME_SECONDS * (20 / 26.2);
    const plan = generatePacingPlan({
      course,
      goalTimeSeconds,
      criticalSpeedMS: CRITICAL_SPEED_MS,
      vo2maxSpeedMS: VO2MAX_SPEED_MS,
      strategyId: "even-effort",
      risk: "moderate",
    });

    expect(plan.totalTimeSeconds).toBeCloseTo(goalTimeSeconds, 0);
  });

  it("projects a slower finish than goal in hot/humid conditions, rather than silently absorbing the penalty into more effort", () => {
    // Reproduces a real user report: setting conditions appeared to do
    // nothing, because the goal-time solve was including weather inside
    // the bisection -- it just demanded more effort until the clock still
    // read the original goal, which is bad advice (you can't out-effort
    // heat stress to hit an unchanged time) as well as an invisible UI.
    const course = buildCourse(new Array(20).fill(0));
    const goalTimeSeconds = GOAL_TIME_SECONDS * (20 / 26.2);

    const calm = generatePacingPlan({
      course,
      goalTimeSeconds,
      criticalSpeedMS: CRITICAL_SPEED_MS,
      vo2maxSpeedMS: VO2MAX_SPEED_MS,
      strategyId: "even-effort",
      risk: "moderate",
    });
    const hot = generatePacingPlan({
      course,
      goalTimeSeconds,
      criticalSpeedMS: CRITICAL_SPEED_MS,
      vo2maxSpeedMS: VO2MAX_SPEED_MS,
      strategyId: "even-effort",
      risk: "moderate",
      weatherConditions: hotWeather(),
    });

    expect(calm.totalTimeSeconds).toBeCloseTo(goalTimeSeconds, 0);
    expect(hot.totalTimeSeconds).toBeGreaterThan(goalTimeSeconds + 30); // a real, visible penalty, not absorbed away
  });

  it("still solves the correct terrain-adjusted effort even when conditions are set, so heat doesn't distort the terrain fix", () => {
    const course = buildCourse(new Array(20).fill(-0.03)); // meaningfully net downhill
    const goalTimeSeconds = GOAL_TIME_SECONDS * (20 / 26.2);

    const plan = generatePacingPlan({
      course,
      goalTimeSeconds,
      criticalSpeedMS: CRITICAL_SPEED_MS,
      vo2maxSpeedMS: VO2MAX_SPEED_MS,
      strategyId: "even-effort",
      risk: "moderate",
      weatherConditions: hotWeather(),
    });

    // Should be slower than goal (heat penalty), not faster (which the old
    // downhill-course bug, combined with weather never applying, would have produced).
    expect(plan.totalTimeSeconds).toBeGreaterThan(goalTimeSeconds);
  });

  it("paces uphill miles slower and downhill miles faster than a flat mile at the same effort", () => {
    const course = buildCourse([0, 0.06, 0, -0.06, 0]);
    const plan = generatePacingPlan({
      course,
      goalTimeSeconds: GOAL_TIME_SECONDS,
      criticalSpeedMS: CRITICAL_SPEED_MS,
      vo2maxSpeedMS: VO2MAX_SPEED_MS,
      strategyId: "even-effort",
      risk: "moderate",
    });

    const flatPace = plan.splits[0].paceSecPerMile;
    const uphillPace = plan.splits[1].paceSecPerMile;
    const downhillPace = plan.splits[3].paceSecPerMile;

    expect(uphillPace).toBeGreaterThan(flatPace);
    expect(downhillPace).toBeLessThan(flatPace);
  });

  it("never jumps pace by an unrealistic amount between two adjacent miles under a Negative Split strategy", () => {
    // Reproduces a real user report: a 26-mile marathon-length Negative
    // Split plan was producing a ~37s/mi jump concentrated entirely on the
    // single mile straddling halfway (mile 13 to 14) -- a literal step
    // function in the effort curve. No consecutive pair of miles should
    // differ by anywhere near the full first-half/second-half swing now
    // that the transition is spread across the surrounding few miles.
    const course = buildCourse(new Array(26).fill(0));
    const plan = generatePacingPlan({
      course,
      goalTimeSeconds: GOAL_TIME_SECONDS,
      criticalSpeedMS: CRITICAL_SPEED_MS,
      vo2maxSpeedMS: VO2MAX_SPEED_MS,
      strategyId: "negative-split",
      risk: "moderate",
    });

    const paces = plan.splits.map((s) => s.paceSecPerMile);
    const totalSwing = Math.abs(paces[0] - paces[paces.length - 1]);
    for (let i = 1; i < paces.length; i++) {
      const jump = Math.abs(paces[i] - paces[i - 1]);
      expect(jump).toBeLessThan(totalSwing * 0.4); // spread across several miles, not concentrated in one
    }
  });

  it("runs later miles faster than earlier miles under a Negative Split strategy on a flat course", () => {
    const course = buildCourse(new Array(10).fill(0));
    const plan = generatePacingPlan({
      course,
      goalTimeSeconds: GOAL_TIME_SECONDS,
      criticalSpeedMS: CRITICAL_SPEED_MS,
      vo2maxSpeedMS: VO2MAX_SPEED_MS,
      strategyId: "negative-split",
      risk: "moderate",
    });

    expect(plan.splits[0].paceSecPerMile).toBeGreaterThan(plan.splits[9].paceSecPerMile);
  });

  it("accumulates elapsed time monotonically and consistently with each mile's own pace", () => {
    const course = buildCourse([0, 0.02, -0.01, 0.03, 0]);
    const plan = generatePacingPlan({
      course,
      goalTimeSeconds: GOAL_TIME_SECONDS,
      criticalSpeedMS: CRITICAL_SPEED_MS,
      vo2maxSpeedMS: VO2MAX_SPEED_MS,
      strategyId: "even-effort",
      risk: "moderate",
    });

    let runningTotal = 0;
    for (const split of plan.splits) {
      runningTotal += split.paceSecPerMile;
      expect(split.elapsedSeconds).toBeCloseTo(runningTotal, 6);
    }
    expect(plan.totalTimeSeconds).toBeCloseTo(runningTotal, 6);
  });

  it("depletes glycogen with every mile run, with no fueling input", () => {
    const course = buildCourse(new Array(6).fill(0));
    const plan = generatePacingPlan({
      course,
      goalTimeSeconds: GOAL_TIME_SECONDS,
      criticalSpeedMS: CRITICAL_SPEED_MS,
      vo2maxSpeedMS: VO2MAX_SPEED_MS,
      strategyId: "even-effort",
      risk: "moderate",
    });

    for (let i = 1; i < plan.splits.length; i++) {
      expect(plan.splits[i].fatigueState.glycogenRemainingFraction).toBeLessThan(plan.splits[i - 1].fatigueState.glycogenRemainingFraction);
    }
  });

  it("explains a significant climb mile and gives a neutral explanation for a mile with no adjustment", () => {
    const course = buildCourse([0, 0.08]);
    const plan = generatePacingPlan({
      course,
      goalTimeSeconds: GOAL_TIME_SECONDS,
      criticalSpeedMS: CRITICAL_SPEED_MS,
      vo2maxSpeedMS: VO2MAX_SPEED_MS,
      strategyId: "even-effort",
      risk: "moderate",
    });

    expect(plan.splits[0].explanation).toMatch(/no significant/);
    expect(plan.splits[1].explanation).toMatch(/climb/);
  });
});
