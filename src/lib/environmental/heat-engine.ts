// Heat's quantitative effect on race pace -- distinct from heat-tracker.tsx's
// estimateWBGT/heatZoneFor, which classify today's *training* risk (a
// green/yellow/red/black flag), not predict a race-time cost in seconds.
// This engine answers a different question: "given this temperature during
// a race of this length, how much slower was I than I'd have been in ideal
// conditions?"
//
// Uses a fixed dry-air reference humidity (see heat-model.ts) so this
// engine isolates temperature's own contribution -- humidity's marginal
// effect on top of dry heat is HumidityEngine's job. Summing Heat +
// Humidity reproduces the full temperature+humidity effect once, with no
// double-counting.

import { REFERENCE_RH_PCT, secondsFromLogspeedAdjustment } from "@/lib/environmental/heat-model";
import { logspeedAdjustment } from "@/lib/environmental/heat-humidity-model";
import type { AdjustmentEngine, EngineResult, PerformanceContext } from "@/lib/environmental/types";

export type HeatEngineInput = {
  tempC: number;
};

const CONFIDENCE_BAND_FRACTION = 0.3; // core temp/humidity effect is now data-backed; band mostly hedges distance-extrapolation and individual variation

export const heatEngine: AdjustmentEngine<HeatEngineInput> = {
  factor: "Heat",

  isApplicable(input: HeatEngineInput) {
    return Number.isFinite(input.tempC);
  },

  compute(input: HeatEngineInput, context: PerformanceContext): EngineResult {
    const rawAdjustment = logspeedAdjustment(input.tempC, REFERENCE_RH_PCT);
    const adjustmentSeconds = secondsFromLogspeedAdjustment(rawAdjustment, context);

    const summary =
      adjustmentSeconds <= 0
        ? "Temperature was at or below the point where heat starts costing you time -- no heat penalty estimated."
        : `A temperature of ${input.tempC.toFixed(0)}°C is warm enough to slow you down on its own, and longer efforts feel it more since the cost builds up over time spent generating heat.`;

    return {
      factor: "Heat",
      adjustmentSeconds,
      confidenceLowSeconds: adjustmentSeconds - Math.abs(adjustmentSeconds) * CONFIDENCE_BAND_FRACTION,
      confidenceHighSeconds: adjustmentSeconds + Math.abs(adjustmentSeconds) * CONFIDENCE_BAND_FRACTION,
      summary,
    };
  },
};
