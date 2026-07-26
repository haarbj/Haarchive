// The orchestrator: turns a strategy's effort curve into actual mile-by-
// mile paces, tracking fatigue state along the way. This is the module
// that answers "what pace should I actually run," as opposed to its three
// inputs, which each answer a narrower question (course-analysis.ts: what
// does the course look like; strategy-engine.ts: how hard should I be
// aiming to run, when; physiology-engine.ts: what does that effort cost me
// physiologically).
//
// Terrain and wind are converted from "target effort" to "target pace" via
// the same effort-preserving equivalence solves grade-pace-physics.ts and
// wind-physics.ts already use elsewhere on the site (equivalentGradeSpeedMS,
// effortModeEquivalentSpeedMS) -- not mile-cost-model.ts's added-seconds
// numbers, which would double-count if layered on top of an already
// effort-adjusted speed. mile-cost-model.ts is reused here purely for its
// intended diagnostic purpose: generating each mile's human-readable "why"
// explanation, computed separately against the flat goal pace as a
// reference, never fed back into the pace math itself.
//
// Heat and humidity don't have an effort-equivalence solve available (see
// mile-cost-model.ts's own reasoning), so they're added as extra time on
// top of the terrain/wind-adjusted pace instead.
//
// The goal effort fraction itself is SOLVED, not computed directly. The
// naive guess -- goalSpeedMS (course.totalDistanceM / goalTimeSeconds)
// divided by critical speed -- is the effort that would hit the goal time
// on a FLAT course. Applying that same effort to a course with meaningful
// net elevation change produces a systematically wrong total: a net-
// downhill course (Boston) runs faster than the stated goal, a net-uphill
// one runs slower, because the grade-cost curve isn't symmetric or linear.
// A real report: a 2:38:00 Boston goal was projecting a 2:34:27 finish --
// entirely explained by this, since Boston is meaningfully net downhill.
// solveGoalEffortFraction below bisects on effort fraction (monotonic:
// more effort always means a faster total, for any course) until the
// *actual*, terrain-adjusted total time matches the goal, so the finish
// time is right regardless of how hilly the course is.
//
// Crucially, that solve deliberately ONLY sees terrain (and never weather):
// terrain is a fixed property of the course, so it's fair to fold into what
// "hitting the goal on this course" even means. Weather is not -- it's a
// condition on the day, not the route, and a first version of this solve
// included wind/heat/humidity inside the bisection too, which meant setting
// hot conditions just made the solver demand more effort until the clock
// still read the original goal time. That's bad advice (heat stress isn't
// something you can out-effort to hit an unchanged time) and a real report
// ("setting conditions now does nothing"): the whole point of a conditions
// input is to show a REALISTIC outcome that can differ from the ideal-
// conditions goal, not to silently absorb it. So the effort curve is solved
// against terrain alone, and wind/heat/humidity are layered on top of that
// already-solved effort in the final pass -- generatePacingPlan's returned
// totalTimeSeconds can and should diverge from goalTimeSeconds once
// conditions are set; that divergence is the actual point.

import { equivalentGradeSpeedMS } from "@/lib/grade-pace-physics";
import {
  effortModeEquivalentSpeedMS,
  relativeAngleFromTrueBearing,
  windAtChestHeightMS,
  windForwardLateral,
  type WindProfile,
} from "@/lib/wind-physics";
import type { WeatherConditions } from "@/lib/environmental/fetch-weather-conditions";
import type { CourseAnalysis } from "@/lib/marathon-pacing/course-analysis";
import { computeMileCosts, type MileCost } from "@/lib/marathon-pacing/mile-cost-model";
import { effortAtRaceFraction, PACING_STRATEGIES, type RiskLevel, type StrategyId } from "@/lib/marathon-pacing/strategy-engine";
import { initialFatigueState, stepFatigueState, type Durability, type FatigueState, type PhysiologyProfile } from "@/lib/physiology-engine";

const METERS_PER_MILE = 1609.344;
const DEFAULT_WEIGHT_KG = 70;
const DEFAULT_WIND_PROFILE: WindProfile = "suburban";
const SIGNIFICANT_SECONDS = 1; // below this, a factor isn't worth mentioning in the explanation text

export type SplitGeneratorInput = {
  course: CourseAnalysis;
  goalTimeSeconds: number;
  criticalSpeedMS: number;
  vo2maxSpeedMS: number;
  strategyId: StrategyId;
  risk: RiskLevel;
  weightKg?: number;
  durability?: Durability;
  weatherConditions?: WeatherConditions;
  windProfile?: WindProfile;
};

export type MileSplit = {
  mile: number;
  paceSecPerMile: number;
  elapsedSeconds: number;
  grade: number;
  targetEffortFraction: number;
  fatigueState: FatigueState;
  costBreakdown: MileCost;
  explanation: string;
};

export type PacingPlan = {
  splits: MileSplit[];
  /** Sum of the full miles actually generated -- see course-analysis.ts's perMileGrade docs on why a final partial mile isn't included yet. */
  totalTimeSeconds: number;
  /** The terrain-solved effort fraction actually used for every mile (see the module doc) -- exposed so a caller (e.g. race-simulation.ts) can re-run computeMileResultsForEffort with a different fitness input without re-solving. */
  goalEffortFraction: number;
  /** Per-mile terrain/wind/heat/humidity breakdown, same one computeMileResultsForEffort itself was built against -- exposed for the same reason as goalEffortFraction. */
  costBreakdown: MileCost[];
};

const SOLVE_TOLERANCE_SECONDS = 0.5;
const SOLVE_MAX_ITERATIONS = 40;

export type MileDurationInputs = {
  course: CourseAnalysis;
  criticalSpeedMS: number;
  strategyId: StrategyId;
  risk: RiskLevel;
  weightKg: number;
  windProfile: WindProfile;
  weatherConditions: WeatherConditions | undefined;
  costBreakdown: MileCost[];
};

export type MileEffortResult = { durationSeconds: number; targetEffortFraction: number };

/**
 * Builds the effort curve for a candidate goal effort fraction and converts
 * it into each mile's actual duration, with no physiology tracking -- the
 * fast, stateless path both the bisection solver below and the final
 * generatePacingPlan pass share, so there's one place that knows how to
 * turn "target effort" into "actual seconds."
 *
 * `includeWeather` controls whether wind/heat/humidity are applied on top
 * of the terrain-adjusted pace. The solver always calls this with it off
 * (see the module doc for why); the final pass always calls it with it on,
 * so the displayed splits reflect real conditions.
 */
export function computeMileResultsForEffort(
  goalEffortFraction: number,
  inputs: MileDurationInputs,
  includeWeather: boolean,
): MileEffortResult[] {
  const strategy = PACING_STRATEGIES[inputs.strategyId];
  const curve = strategy.buildEffortCurve({ course: inputs.course, goalEffortFraction, risk: inputs.risk });

  let cumulativeDistanceM = 0;
  const results: MileEffortResult[] = [];

  inputs.course.perMileGrade.forEach((grade, i) => {
    const mileDistanceM = METERS_PER_MILE;
    const raceFraction = (cumulativeDistanceM + mileDistanceM / 2) / inputs.course.totalDistanceM;
    const targetEffortFraction = effortAtRaceFraction(curve, raceFraction);
    const flatTargetSpeedMS = targetEffortFraction * inputs.criticalSpeedMS;

    const gradeAdjustedSpeedMS = equivalentGradeSpeedMS(flatTargetSpeedMS, grade) ?? flatTargetSpeedMS;

    let speedMS = gradeAdjustedSpeedMS;
    let extraSeconds = 0;
    if (includeWeather) {
      const headingDeg = inputs.course.perMileHeadingDeg[i];
      if (inputs.weatherConditions && headingDeg !== null && inputs.weatherConditions.windSpeedMS > 0) {
        const chestWindMS = windAtChestHeightMS(inputs.weatherConditions.windSpeedMS, inputs.windProfile);
        const relativeAngleDeg = relativeAngleFromTrueBearing(inputs.weatherConditions.windFromBearingDeg, headingDeg);
        const { forward, lateral } = windForwardLateral(chestWindMS, relativeAngleDeg);
        const windAdjustedSpeedMS = effortModeEquivalentSpeedMS(gradeAdjustedSpeedMS, forward, lateral, inputs.weightKg);
        if (windAdjustedSpeedMS !== null && windAdjustedSpeedMS > 0) speedMS = windAdjustedSpeedMS;
      }
      const cost = inputs.costBreakdown[i];
      extraSeconds = cost.heatSeconds + cost.humiditySeconds;
    }

    const durationSeconds = mileDistanceM / speedMS + extraSeconds;
    results.push({ durationSeconds, targetEffortFraction });
    cumulativeDistanceM += mileDistanceM;
  });

  return results;
}

/**
 * Finds the goal effort fraction whose actual, terrain-adjusted (but NOT
 * weather-adjusted -- see module doc) total time matches targetTotalSeconds,
 * via bisection -- more effort always produces a faster total on any
 * course, so this is a well-behaved monotonic root-find. If a strategy's
 * risk ceiling caps how fast the curve can go (see strategy-engine.ts's
 * positive-split clamp), bisection simply converges to the fastest
 * honestly-achievable effort instead of overshooting -- the same "don't
 * paper over an unreachable goal" principle used there.
 */
function solveGoalEffortFraction(targetTotalSeconds: number, naiveGoalEffortFraction: number, inputs: MileDurationInputs): number {
  let lo = naiveGoalEffortFraction * 0.5;
  let hi = naiveGoalEffortFraction * 1.5;

  for (let i = 0; i < SOLVE_MAX_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    const totalSeconds = computeMileResultsForEffort(mid, inputs, false).reduce((sum, r) => sum + r.durationSeconds, 0);
    if (Math.abs(totalSeconds - targetTotalSeconds) < SOLVE_TOLERANCE_SECONDS) return mid;
    if (totalSeconds > targetTotalSeconds) {
      lo = mid; // too slow -- need more effort
    } else {
      hi = mid; // too fast -- need less effort
    }
  }
  return (lo + hi) / 2;
}

function buildExplanation(cost: MileCost, mile: number): string {
  const parts: string[] = [];
  if (cost.terrainSeconds >= SIGNIFICANT_SECONDS) parts.push(`the climb here adds about ${Math.round(cost.terrainSeconds)}s`);
  else if (-cost.terrainSeconds >= SIGNIFICANT_SECONDS) parts.push(`the descent here saves about ${Math.round(-cost.terrainSeconds)}s`);

  if (cost.windSeconds >= SIGNIFICANT_SECONDS) parts.push(`a headwind costs about ${Math.round(cost.windSeconds)}s`);
  else if (-cost.windSeconds >= SIGNIFICANT_SECONDS) parts.push(`a tailwind saves about ${Math.round(-cost.windSeconds)}s`);

  const heatHumiditySeconds = cost.heatSeconds + cost.humiditySeconds;
  if (heatHumiditySeconds >= SIGNIFICANT_SECONDS) parts.push(`heat and humidity add about ${Math.round(heatHumiditySeconds)}s`);

  if (parts.length === 0) return `Mile ${mile} runs at your target effort, with no significant terrain, wind, or heat adjustment.`;
  return `Mile ${mile}: ${parts.join(", ")}, relative to a flat, calm, temperate mile at the same effort.`;
}

export function generatePacingPlan(input: SplitGeneratorInput): PacingPlan {
  const weightKg = input.weightKg ?? DEFAULT_WEIGHT_KG;
  const windProfile = input.windProfile ?? DEFAULT_WIND_PROFILE;

  // The flat-course guess -- also what mile-cost-model.ts's diagnostic
  // breakdown is computed against, which stays a reasonable reference
  // regardless of the solve below since it only drives the heat/humidity
  // apportionment (duration-based, not pace-based) and the explanation text.
  const naiveGoalSpeedMS = input.course.totalDistanceM / input.goalTimeSeconds;
  const naiveGoalEffortFraction = naiveGoalSpeedMS / input.criticalSpeedMS;

  const costBreakdown = computeMileCosts(input.course, {
    goalSpeedMS: naiveGoalSpeedMS,
    weatherConditions: input.weatherConditions,
    weightKg,
    windProfile,
  });

  const mileDurationInputs: MileDurationInputs = {
    course: input.course,
    criticalSpeedMS: input.criticalSpeedMS,
    strategyId: input.strategyId,
    risk: input.risk,
    weightKg,
    windProfile,
    weatherConditions: input.weatherConditions,
    costBreakdown,
  };

  const goalEffortFraction = solveGoalEffortFraction(input.goalTimeSeconds, naiveGoalEffortFraction, mileDurationInputs);
  const mileResults = computeMileResultsForEffort(goalEffortFraction, mileDurationInputs, true);

  const physiologyProfile: PhysiologyProfile = {
    criticalSpeedMS: input.criticalSpeedMS,
    vo2maxSpeedMS: input.vo2maxSpeedMS,
    weightKg,
    durability: input.durability,
  };

  let fatigueState = initialFatigueState(physiologyProfile);
  const splits: MileSplit[] = [];

  input.course.perMileGrade.forEach((grade, i) => {
    const mileDistanceM = METERS_PER_MILE;
    const { durationSeconds, targetEffortFraction } = mileResults[i];
    const actualMileSpeedMS = mileDistanceM / durationSeconds;

    fatigueState = stepFatigueState(fatigueState, physiologyProfile, {
      grade,
      speedMS: actualMileSpeedMS,
      distanceM: mileDistanceM,
      tempC: input.weatherConditions?.tempC,
    });

    const cost = costBreakdown[i];
    splits.push({
      mile: i + 1,
      paceSecPerMile: durationSeconds,
      elapsedSeconds: fatigueState.elapsedSeconds,
      grade,
      targetEffortFraction,
      fatigueState,
      costBreakdown: cost,
      explanation: buildExplanation(cost, i + 1),
    });
  });

  const totalTimeSeconds = splits.length > 0 ? splits[splits.length - 1].elapsedSeconds : 0;

  return { splits, totalTimeSeconds, goalEffortFraction, costBreakdown };
}
