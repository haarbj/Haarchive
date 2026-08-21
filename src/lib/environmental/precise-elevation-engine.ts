// The route-aware sibling of elevation-engine.ts, for when a real GPS file
// (not just a manually-entered total gain/loss) is available. Marathon
// Pacing Calculator already proves this out: course-analysis.ts turns a
// parsed route into a real per-mile grade profile, which Minetti's
// polynomial (grade-pace-physics.ts) can cost exactly, mile by mile,
// instead of elevation-engine.ts's fallback of assuming one representative
// +/-6% grade for the whole course. Same Minetti coefficients either way --
// only the grade input's precision differs.

import { flatPowerWPerKg } from "@/lib/grade-pace-physics";
import type { AdjustmentEngine, EngineResult, PerformanceContext } from "@/lib/environmental/types";

export type PreciseElevationEngineInput = {
  /**
   * One net grade per full mile, from course-analysis.ts's analyzeCourse()
   * -- used only for the "N climbing / N descending miles" summary text
   * below, never for the actual adjustmentSeconds math (a mile's net grade
   * can read as near-flat even when it climbs and descends substantially,
   * see perMileTerrainCostJPerKg).
   */
  perMileGrade: number[];
  /**
   * True per-mile terrain energy cost (J/kg), from the same analyzeCourse()
   * call -- computed from the route's real local grade at every ~20m step,
   * not a mile's net start-to-finish grade, so rolling terrain that
   * cancels out net-wise (a mile that climbs 25m then drops 20m) still
   * costs real energy on both legs instead of reading as nearly flat.
   */
  perMileTerrainCostJPerKg: number[];
};

// Real per-mile grades remove the biggest source of error in the coarse
// engine (guessing the climb/descent shape) -- a real GPS elevation trace
// still has some measurement noise, but categorically less than an assumed
// grade, so this band is narrower than elevationEngine's 30%.
const CONFIDENCE_BAND_FRACTION = 0.1;

export const preciseElevationEngine: AdjustmentEngine<PreciseElevationEngineInput> = {
  factor: "Elevation",

  isApplicable(input: PreciseElevationEngineInput) {
    return input.perMileTerrainCostJPerKg.length > 0 && input.perMileTerrainCostJPerKg.some((cost) => cost !== 0);
  },

  compute(input: PreciseElevationEngineInput, context: PerformanceContext): EngineResult {
    const averagePowerWPerKg = flatPowerWPerKg(context.paceMS);
    const addedEnergyJPerKg = input.perMileTerrainCostJPerKg.reduce((total, cost) => total + cost, 0);
    const adjustmentSeconds = addedEnergyJPerKg / averagePowerWPerKg;

    const climbingMiles = input.perMileGrade.filter((grade) => grade > 0).length;
    const descendingMiles = input.perMileGrade.filter((grade) => grade < 0).length;
    const summary = `Based on this route's actual mile-by-mile grade (${climbingMiles} net-uphill and ${descendingMiles} net-downhill of ${input.perMileGrade.length} miles), not an assumed average, the climbs and descents net out to ${
      adjustmentSeconds >= 0 ? "an added cost" : "a net benefit"
    } versus a flat course.`;

    return {
      factor: "Elevation",
      adjustmentSeconds,
      confidenceLowSeconds: adjustmentSeconds - Math.abs(adjustmentSeconds) * CONFIDENCE_BAND_FRACTION,
      confidenceHighSeconds: adjustmentSeconds + Math.abs(adjustmentSeconds) * CONFIDENCE_BAND_FRACTION,
      summary,
    };
  },
};
