// The route-aware sibling of altitude-engine.ts, for when a real imported
// route's own GPS elevation samples are available -- same relationship as
// elevation-engine.ts / precise-elevation-engine.ts. The coarse engine has
// only one altitude figure to work with (wherever weather was looked up,
// or a manual entry) and has to assume it held for the whole effort; this
// one costs each mile at its own real average altitude from
// course-analysis.ts's perMileAltitudeM, so a route that climbs from
// 2,100m to 2,600m isn't treated the same as one that stays flat at
// 2,350m the whole way, even though both might average to the same
// number.
//
// Reuses altitude-engine.ts's own calibrated curve (marathonImpairmentFraction,
// altitudeDurationScale) exactly, rather than a second copy of the Daniels
// fit -- only the altitude input's resolution differs between the two
// engines.

import { altitudeDurationScale, marathonImpairmentFraction } from "@/lib/environmental/altitude-engine";
import type { AdjustmentEngine, EngineResult, PerformanceContext } from "@/lib/environmental/types";

export type PreciseAltitudeEngineInput = {
  /** Average absolute altitude (m above sea level) for each full mile, from course-analysis.ts's analyzeCourse(). */
  perMileAltitudeM: number[];
};

// Tighter than the coarse engine's 0.4 -- real per-mile altitude removes
// the "was this actually the altitude the whole time" uncertainty, though
// individual altitude tolerance (acclimatization, training history) still
// doesn't shrink just because the input data got better.
const CONFIDENCE_BAND_FRACTION = 0.3;

export const preciseAltitudeEngine: AdjustmentEngine<PreciseAltitudeEngineInput> = {
  factor: "Altitude",

  isApplicable(input: PreciseAltitudeEngineInput) {
    return input.perMileAltitudeM.length > 0 && input.perMileAltitudeM.some((altitudeM) => altitudeM > 0);
  },

  compute(input: PreciseAltitudeEngineInput, context: PerformanceContext): EngineResult {
    const mileCount = input.perMileAltitudeM.length;
    // Equal-pace approximation across miles -- the same convention
    // mile-cost-model.ts's own per-mile apportionment already uses for
    // heat/humidity (see that file's comment on mileTimeShare).
    const mileTimeShare = 1 / mileCount;
    const weightedFraction = input.perMileAltitudeM.reduce(
      (sum, altitudeM) => sum + marathonImpairmentFraction(altitudeM) * mileTimeShare,
      0,
    );
    const adjustmentSeconds = weightedFraction * altitudeDurationScale(context.actualTimeSeconds) * context.actualTimeSeconds;

    const minAltitudeM = Math.min(...input.perMileAltitudeM);
    const maxAltitudeM = Math.max(...input.perMileAltitudeM);
    const rangeM = maxAltitudeM - minAltitudeM;
    const summary =
      rangeM > 50
        ? `Your route's own altitude ranged from about ${Math.round(minAltitudeM)}m to ${Math.round(maxAltitudeM)}m -- costed mile by mile at its own real altitude, not one constant value for the whole effort.`
        : `At a fairly steady ${Math.round((minAltitudeM + maxAltitudeM) / 2)}m above sea level throughout, thinner air costs aerobic performance the whole way.`;

    return {
      factor: "Altitude",
      adjustmentSeconds,
      confidenceLowSeconds: adjustmentSeconds - Math.abs(adjustmentSeconds) * CONFIDENCE_BAND_FRACTION,
      confidenceHighSeconds: adjustmentSeconds + Math.abs(adjustmentSeconds) * CONFIDENCE_BAND_FRACTION,
      summary,
    };
  },
};
