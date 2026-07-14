// The shape persisted by "Save this result" -- deliberately richer than
// just "an equivalent time," so a future feature (comparing saved
// analyses to each other: weather-adjusted races over a season,
// environmental trends, etc.) has real structured fields to work with
// instead of having to re-parse an ad-hoc blob. schemaVersion exists so a
// future migration can tell old saved rows apart from newer ones if this
// shape ever needs to change.
//
// This only assembles data the calculator already computed -- no new
// calculations happen here.

import type { WorkoutType } from "@/lib/environmental/workout-types";
import type { ConfidenceLevel } from "@/lib/environmental/confidence-explanation";

// Mirrors CourseType/GoalMode as defined locally in environmental-calculator.tsx --
// not promoted to a shared type since nothing outside that component and
// this saved-analysis shape needs them yet.
export type CourseType = "road" | "track" | "route";
export type GoalMode = "analyze" | "predict" | "convert" | "adjust";

export type SavedAnalysisFactor = {
  factor: string;
  adjustmentSeconds: number;
};

export type SavedEnvironmentalAnalysis = {
  schemaVersion: 1;
  courseType: CourseType;
  goalMode: GoalMode;
  workoutType: WorkoutType;
  distanceMeters: number;
  /** The time actually run, when this analysis has one (Predict mode has no "actual" -- it's a forecast). */
  actualTimeSeconds: number | null;
  equivalentTimeSeconds: number;
  equivalentLowSeconds: number;
  equivalentHighSeconds: number;
  /** Null when conditions couldn't be resolved (e.g. no weather fetched/entered yet). */
  conditions: {
    tempC: number;
    relativeHumidityPct: number;
    windSpeedMS: number;
    windFromBearingDeg: number;
    windExposureScore: number;
    elevationGainM: number;
    elevationLossM: number;
  } | null;
  /** Every factor's contribution, largest-impact-first -- see coaching-summary.ts's rankByImpact. */
  breakdown: SavedAnalysisFactor[];
  /** The single largest-magnitude factor's name, or null if there were none. */
  dominantFactor: string | null;
  confidenceLevel: ConfidenceLevel;
  /** The activity's own real-world date/time when known (an imported route/Strava activity), else the moment this analysis was saved. */
  recordedAtIso: string;
};

export function buildSavedAnalysis(params: {
  courseType: CourseType;
  goalMode: GoalMode;
  workoutType: WorkoutType;
  distanceMeters: number;
  actualTimeSeconds: number | null;
  equivalentTimeSeconds: number;
  equivalentLowSeconds: number;
  equivalentHighSeconds: number;
  conditions: SavedEnvironmentalAnalysis["conditions"];
  breakdown: SavedAnalysisFactor[];
  confidenceLevel: ConfidenceLevel;
  recordedAtIso: string | null;
}): SavedEnvironmentalAnalysis {
  const ranked = [...params.breakdown].sort((a, b) => Math.abs(b.adjustmentSeconds) - Math.abs(a.adjustmentSeconds));

  return {
    schemaVersion: 1,
    courseType: params.courseType,
    goalMode: params.goalMode,
    workoutType: params.workoutType,
    distanceMeters: params.distanceMeters,
    actualTimeSeconds: params.actualTimeSeconds,
    equivalentTimeSeconds: params.equivalentTimeSeconds,
    equivalentLowSeconds: params.equivalentLowSeconds,
    equivalentHighSeconds: params.equivalentHighSeconds,
    conditions: params.conditions,
    breakdown: ranked,
    dominantFactor: ranked[0]?.factor ?? null,
    confidenceLevel: params.confidenceLevel,
    recordedAtIso: params.recordedAtIso ?? new Date().toISOString(),
  };
}
