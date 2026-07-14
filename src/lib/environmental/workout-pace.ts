// Pure helpers for the "Adjust Workout Paces" mode -- deliberately the
// only new logic this mode needs. The actual environmental math is
// entirely the existing engines (see combine.ts's predictedActualTime,
// which this mode reuses unchanged): given a planned pace held over a
// planned distance/duration, predictedActualTime already answers "what
// should I expect to run today" -- the same computation Predict a Race
// already does. What's different here is framing that result as a pace
// (not a finish time) and explaining it in workout-specific, coaching terms.

import type { EngineResult } from "@/lib/environmental/types";

export type WorkoutInputMode = "distance" | "duration";

/**
 * Resolves a planned pace (seconds per `unitMeters`, e.g. per mile or per
 * km) plus either a distance (in that same unit) or a duration (seconds)
 * into the distance/time pair the rest of the calculator already works
 * with. Returns null if the inputs given don't fully determine a bout.
 */
export function resolveWorkoutBout(
  paceSecondsPerUnit: number | null,
  unitMeters: number,
  mode: WorkoutInputMode,
  distanceInUnits: number | null,
  durationSeconds: number | null,
): { distanceMeters: number; timeSeconds: number } | null {
  if (paceSecondsPerUnit === null || paceSecondsPerUnit <= 0) return null;
  const paceSecondsPerMeter = paceSecondsPerUnit / unitMeters;

  if (mode === "distance") {
    if (distanceInUnits === null || distanceInUnits <= 0) return null;
    const distanceMeters = distanceInUnits * unitMeters;
    return { distanceMeters, timeSeconds: distanceMeters * paceSecondsPerMeter };
  }

  if (durationSeconds === null || durationSeconds <= 0) return null;
  const distanceMeters = durationSeconds / paceSecondsPerMeter;
  return { distanceMeters, timeSeconds: durationSeconds };
}

/** Converts a total-bout adjustment (seconds) into a per-distance-unit pace adjustment. */
export function perUnitAdjustmentSeconds(totalAdjustmentSeconds: number, distanceMeters: number, unitMeters: number): number {
  const units = distanceMeters / unitMeters;
  return units > 0 ? totalAdjustmentSeconds / units : 0;
}

/**
 * Rescales a whole Environmental Breakdown from total-bout seconds into
 * per-distance-unit seconds, for display -- the same EngineResult shape
 * (so EquivalentPerformanceBar renders it unchanged), just divided down
 * to a per-mile/per-km figure instead of a whole-workout total.
 */
export function scaleResultsPerUnit(results: EngineResult[], distanceMeters: number, unitMeters: number): EngineResult[] {
  const units = distanceMeters / unitMeters;
  if (units <= 0) return results;
  return results.map((result) => ({
    ...result,
    adjustmentSeconds: result.adjustmentSeconds / units,
    confidenceLowSeconds: result.confidenceLowSeconds / units,
    confidenceHighSeconds: result.confidenceHighSeconds / units,
  }));
}

/**
 * Composes the workout-specific coaching paragraph: what this workout is
 * for, what holding the original pace risks, and the concrete adjustment.
 */
export function trainingGuidance(
  targetSystem: string,
  driftDescription: string,
  perUnitDeltaSeconds: number,
  unitLabel: string,
): string {
  const magnitude = Math.round(Math.abs(perUnitDeltaSeconds));
  if (magnitude < 1) {
    return `${driftDescription} Today's conditions have little effect on this workout -- your planned pace should still deliver the intended ${targetSystem}.`;
  }
  const direction = perUnitDeltaSeconds > 0 ? "Slowing down" : "Speeding up";
  return `${driftDescription} ${direction} by approximately ${magnitude}s per ${unitLabel} today better preserves the intended ${targetSystem}.`;
}
