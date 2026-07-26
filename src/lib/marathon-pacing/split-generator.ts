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
import { initialFatigueState, stepFatigueState, type Durability, type FatigueState, type PhysiologyProfile } from "@/lib/marathon-pacing/physiology-engine";

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
};

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
  const goalSpeedMS = input.course.totalDistanceM / input.goalTimeSeconds;
  const goalEffortFraction = goalSpeedMS / input.criticalSpeedMS;

  const strategy = PACING_STRATEGIES[input.strategyId];
  const curve = strategy.buildEffortCurve({ course: input.course, goalEffortFraction, risk: input.risk });

  const costBreakdown = computeMileCosts(input.course, {
    goalSpeedMS,
    weatherConditions: input.weatherConditions,
    weightKg,
    windProfile,
  });

  const physiologyProfile: PhysiologyProfile = {
    criticalSpeedMS: input.criticalSpeedMS,
    vo2maxSpeedMS: input.vo2maxSpeedMS,
    weightKg,
    durability: input.durability,
  };

  let fatigueState = initialFatigueState(physiologyProfile);
  let cumulativeDistanceM = 0;
  const splits: MileSplit[] = [];

  input.course.perMileGrade.forEach((grade, i) => {
    const mileDistanceM = METERS_PER_MILE;
    const raceFraction = (cumulativeDistanceM + mileDistanceM / 2) / input.course.totalDistanceM;
    const targetEffortFraction = effortAtRaceFraction(curve, raceFraction);
    const flatTargetSpeedMS = targetEffortFraction * input.criticalSpeedMS;

    const gradeAdjustedSpeedMS = equivalentGradeSpeedMS(flatTargetSpeedMS, grade) ?? flatTargetSpeedMS;

    let speedMS = gradeAdjustedSpeedMS;
    const headingDeg = input.course.perMileHeadingDeg[i];
    if (input.weatherConditions && headingDeg !== null && input.weatherConditions.windSpeedMS > 0) {
      const chestWindMS = windAtChestHeightMS(input.weatherConditions.windSpeedMS, windProfile);
      const relativeAngleDeg = relativeAngleFromTrueBearing(input.weatherConditions.windFromBearingDeg, headingDeg);
      const { forward, lateral } = windForwardLateral(chestWindMS, relativeAngleDeg);
      const windAdjustedSpeedMS = effortModeEquivalentSpeedMS(gradeAdjustedSpeedMS, forward, lateral, weightKg);
      if (windAdjustedSpeedMS !== null && windAdjustedSpeedMS > 0) speedMS = windAdjustedSpeedMS;
    }

    const cost = costBreakdown[i];
    const mileDurationSeconds = mileDistanceM / speedMS + cost.heatSeconds + cost.humiditySeconds;
    const actualMileSpeedMS = mileDistanceM / mileDurationSeconds;

    fatigueState = stepFatigueState(fatigueState, physiologyProfile, {
      grade,
      speedMS: actualMileSpeedMS,
      distanceM: mileDistanceM,
      tempC: input.weatherConditions?.tempC,
    });

    cumulativeDistanceM += mileDistanceM;

    splits.push({
      mile: i + 1,
      paceSecPerMile: mileDurationSeconds,
      elapsedSeconds: fatigueState.elapsedSeconds,
      grade,
      targetEffortFraction,
      fatigueState,
      costBreakdown: cost,
      explanation: buildExplanation(cost, i + 1),
    });
  });

  const totalTimeSeconds = splits.length > 0 ? splits[splits.length - 1].elapsedSeconds : 0;

  return { splits, totalTimeSeconds };
}
