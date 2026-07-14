// Elevation's effect on race pace, grounded in the real Minetti et al.
// quintic polynomial (Journal of Applied Physiology, 2002) for the added
// energy cost of running at a grade -- see grade-pace-physics.ts, shared
// with the standalone GAP Calculator, rather than the hand-picked
// "flat-equivalent distance" ratio this engine used before having the
// actual coefficients on hand.
//
// The input here is only total vertical gain/loss, not a real grade
// profile (a 100m climb could be a short steep pitch or a long gentle
// rise, and Minetti's polynomial says those cost meaningfully different
// amounts) -- so this assumes a representative moderate grade to convert
// vertical meters into a horizontal climbing/descending distance. A real
// per-point elevation profile (once GPX/Strava import lands) would let a
// future version replace the assumed grade with the actual one.
//
// Converts the resulting extra/saved energy directly into time via the
// runner's own sustained metabolic power (extra energy / power = extra
// time) -- deliberately NOT via an equivalent-flat-speed bisection (as
// GAP Calculator itself uses for a single grade+pace query): holding one
// overall average pace as the "actual speed" on both the climbing AND
// descending portions, that speed-equivalence approach runs the gain and
// loss contributions through the flat-cost curve's own curvature
// independently, which distorts their relative size well beyond Minetti's
// actual gain/loss asymmetry (verified numerically while building this --
// it can even flip the sign of a course with equal gain and loss). The
// direct energy/power conversion preserves Minetti's real ratio exactly.

import { flatPowerWPerKg, gradeAddedCostJPerKgM } from "@/lib/grade-pace-physics";
import type { AdjustmentEngine, EngineResult, PerformanceContext } from "@/lib/environmental/types";

export type ElevationEngineInput = {
  elevationGainM: number;
  elevationLossM: number;
};

// A moderate, representative grade for courses where only total gain/loss
// is known -- steep enough to be a real rolling-hills course, shallow
// enough to be the common case. Applied symmetrically (+/-) to gain/loss.
const ASSUMED_GRADE_MAGNITUDE = 0.06;
const CONFIDENCE_BAND_FRACTION = 0.3;

// Seconds cost (positive) or benefit (negative) of covering `verticalM` of
// gain/loss at `grade`, assuming the runner sustains their overall race
// power output throughout -- the same simplifying assumption implicit in
// any aggregate (non-profiled) grade-adjusted-pace estimate.
function secondsForVerticalMeters(verticalM: number, grade: number, averagePowerWPerKg: number): number {
  if (verticalM <= 0) return 0;
  const horizontalDistanceM = verticalM / Math.abs(grade);
  const addedEnergyJPerKg = gradeAddedCostJPerKgM(grade) * horizontalDistanceM;
  return addedEnergyJPerKg / averagePowerWPerKg;
}

export const elevationEngine: AdjustmentEngine<ElevationEngineInput> = {
  factor: "Elevation",

  isApplicable(input: ElevationEngineInput) {
    return (Number.isFinite(input.elevationGainM) && input.elevationGainM > 0) ||
      (Number.isFinite(input.elevationLossM) && input.elevationLossM > 0);
  },

  compute(input: ElevationEngineInput, context: PerformanceContext): EngineResult {
    const averagePowerWPerKg = flatPowerWPerKg(context.paceMS);
    const gainSeconds = secondsForVerticalMeters(input.elevationGainM, ASSUMED_GRADE_MAGNITUDE, averagePowerWPerKg);
    const lossSeconds = secondsForVerticalMeters(input.elevationLossM, -ASSUMED_GRADE_MAGNITUDE, averagePowerWPerKg);
    const adjustmentSeconds = gainSeconds + lossSeconds;

    const summary = `${Math.round(input.elevationGainM)}m of climbing and ${Math.round(input.elevationLossM)}m of descent net out to ${
      adjustmentSeconds >= 0 ? "an added cost" : "a net benefit"
    } versus a flat course, since climbing costs far more energy per meter than descending gives back.`;

    return {
      factor: "Elevation",
      adjustmentSeconds,
      confidenceLowSeconds: adjustmentSeconds - Math.abs(adjustmentSeconds) * CONFIDENCE_BAND_FRACTION,
      confidenceHighSeconds: adjustmentSeconds + Math.abs(adjustmentSeconds) * CONFIDENCE_BAND_FRACTION,
      summary,
    };
  },
};
