// Combines individual engine results into the calculator's headline
// numbers. Confidence bounds are summed directly (the "if every factor
// landed at its low estimate" / "at its high estimate" scenario) rather
// than combined in quadrature -- a wider, more conservative range that's
// easier to explain honestly to a beginner than a statistical assumption
// of factor independence the underlying models don't actually establish.

import type { EngineResult } from "@/lib/environmental/types";

export type CombinedAdjustment = {
  results: EngineResult[];
  totalAdjustmentSeconds: number;
  lowSeconds: number;
  highSeconds: number;
};

export type TimeEstimate = {
  estimateSeconds: number;
  lowSeconds: number;
  highSeconds: number;
};

export function combineAdjustments(results: EngineResult[]): CombinedAdjustment {
  const totalAdjustmentSeconds = results.reduce((sum, r) => sum + r.adjustmentSeconds, 0);
  const lowSeconds = results.reduce((sum, r) => sum + r.confidenceLowSeconds, 0);
  const highSeconds = results.reduce((sum, r) => sum + r.confidenceHighSeconds, 0);
  return { results, totalAdjustmentSeconds, lowSeconds, highSeconds };
}

/** Analyze mode: "I ran this time under these conditions -- what would it have been ideally?" */
export function equivalentIdealTime(actualTimeSeconds: number, combined: CombinedAdjustment): TimeEstimate {
  return {
    estimateSeconds: actualTimeSeconds - combined.totalAdjustmentSeconds,
    lowSeconds: actualTimeSeconds - combined.highSeconds,
    highSeconds: actualTimeSeconds - combined.lowSeconds,
  };
}

/** Predict mode: "I can run this time ideally -- what should I expect under these conditions?" */
export function predictedActualTime(idealTimeSeconds: number, combined: CombinedAdjustment): TimeEstimate {
  return {
    estimateSeconds: idealTimeSeconds + combined.totalAdjustmentSeconds,
    lowSeconds: idealTimeSeconds + combined.lowSeconds,
    highSeconds: idealTimeSeconds + combined.highSeconds,
  };
}

/** Convert mode: "I ran this time under conditions A -- what's the equivalent under conditions B?" */
export function convertBetweenConditions(
  actualTimeSeconds: number,
  combinedA: CombinedAdjustment,
  combinedB: CombinedAdjustment,
): TimeEstimate {
  const ideal = equivalentIdealTime(actualTimeSeconds, combinedA);
  return {
    estimateSeconds: ideal.estimateSeconds + combinedB.totalAdjustmentSeconds,
    lowSeconds: ideal.lowSeconds + combinedB.lowSeconds,
    highSeconds: ideal.highSeconds + combinedB.highSeconds,
  };
}
