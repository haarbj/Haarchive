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

// Convert mode's own breakdown: each factor's results from A and B both
// exist relative to the SAME ideal baseline (see types.ts -- adjustmentSeconds
// is always "cost relative to ideal," never relative to the other condition
// set), so the net effect of moving from A to B is just resultB - resultA
// per factor -- no new model, just a subtraction of numbers both engines
// already produced. A factor missing from one side (e.g. still air in A,
// a real breeze in B) is treated as a real 0 contribution from that side,
// not a missing value, since "no wind" genuinely means wind cost nothing.
function findByFactor(results: EngineResult[], factor: string): EngineResult | undefined {
  return results.find((r) => r.factor === factor);
}

function formatNetSummary(factor: string, netAdjustmentSeconds: number): string {
  const rounded = Math.round(Math.abs(netAdjustmentSeconds));
  if (rounded === 0) return `No meaningful net difference between Conditions A and B.`;
  const verb = netAdjustmentSeconds > 0 ? "costs" : "helps by";
  return `Moving from Conditions A to Conditions B, ${factor.toLowerCase()} ${verb} about ${rounded}s.`;
}

/**
 * The net, per-factor difference between two already-computed breakdowns --
 * what Convert mode's own "What Changed" visualization shows, instead of
 * two separate vs.-ideal breakdowns a reader would have to subtract
 * mentally themselves. Confidence bounds compose the same conservative way
 * combineAdjustments does elsewhere in this file: the net's own low bound
 * is "B landed at its most favorable estimate while A landed at its least
 * favorable," and vice versa for the high bound.
 */
export function netEngineResults(resultsA: EngineResult[], resultsB: EngineResult[]): EngineResult[] {
  const factors = [...new Set([...resultsA.map((r) => r.factor), ...resultsB.map((r) => r.factor)])];
  return factors.map((factor) => {
    const a = findByFactor(resultsA, factor);
    const b = findByFactor(resultsB, factor);
    const aAdjustment = a?.adjustmentSeconds ?? 0;
    const bAdjustment = b?.adjustmentSeconds ?? 0;
    const aLow = a?.confidenceLowSeconds ?? 0;
    const aHigh = a?.confidenceHighSeconds ?? 0;
    const bLow = b?.confidenceLowSeconds ?? 0;
    const bHigh = b?.confidenceHighSeconds ?? 0;
    const netAdjustmentSeconds = bAdjustment - aAdjustment;
    return {
      factor,
      adjustmentSeconds: netAdjustmentSeconds,
      confidenceLowSeconds: bLow - aHigh,
      confidenceHighSeconds: bHigh - aLow,
      summary: formatNetSummary(factor, netAdjustmentSeconds),
    };
  });
}
