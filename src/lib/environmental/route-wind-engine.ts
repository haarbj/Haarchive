// Route variant of WindEngine/TrackWindEngine -- same "Wind" factor slot,
// but integrating over the actual heading of every segment of an
// uploaded/imported route (route-wind-physics.ts) instead of one fixed
// heading (the road model) or a fixed 400m oval (the track model).
// environmental-calculator.tsx picks exactly one of the three per
// calculation, based on the selected course source.

import { solveRouteCalmEquivalentSpeedMS, type RouteHeadingSegment, type SpeedOrEffort } from "@/lib/route-wind-physics";
import type { AdjustmentEngine, EngineResult, PerformanceContext } from "@/lib/environmental/types";
import { windAtChestHeightMSFromAlpha } from "@/lib/wind-physics";
import { windProfileAlphaFromExposure } from "@/lib/wind-exposure";

export type RouteWindEngineInput = {
  /** Reference-height (e.g. 10m weather station) wind speed, m/s. */
  windSpeedMS: number;
  /** Meteorological convention: the compass bearing the wind is blowing FROM. */
  windFromBearingDeg: number;
  /** Continuous 0-100 wind-exposure score (see wind-exposure.ts) -- how sheltered the course is, not a fixed enum bucket. */
  windExposureScore: number;
  weightKg: number;
  speedOrEffort: SpeedOrEffort;
  /** True-bearing heading segments derived from the route's GPS points (see route-summary.ts). */
  headingSegments: RouteHeadingSegment[];
};

const CONFIDENCE_BAND_FRACTION = 0.2; // matches trackWindEngine -- real segment-by-segment integration, few simplifying assumptions

export const routeWindEngine: AdjustmentEngine<RouteWindEngineInput> = {
  factor: "Wind",

  isApplicable(input: RouteWindEngineInput) {
    return Number.isFinite(input.windSpeedMS) && input.windSpeedMS > 0 && input.headingSegments.length > 0;
  },

  compute(input: RouteWindEngineInput, context: PerformanceContext): EngineResult {
    const chestWindMS = windAtChestHeightMSFromAlpha(input.windSpeedMS, windProfileAlphaFromExposure(input.windExposureScore));

    const equivalentCalmSpeedMS = solveRouteCalmEquivalentSpeedMS({
      speedMS: context.paceMS,
      segments: input.headingSegments,
      totalDistanceM: context.distanceMeters,
      trueWindMS: chestWindMS,
      windFromBearingDeg: input.windFromBearingDeg,
      weightKg: input.weightKg,
      speedOrEffort: input.speedOrEffort,
    });

    if (equivalentCalmSpeedMS === null || equivalentCalmSpeedMS <= 0) {
      return {
        factor: "Wind",
        adjustmentSeconds: 0,
        confidenceLowSeconds: 0,
        confidenceHighSeconds: 0,
        summary: "Wind conditions were outside the range this model can estimate a time effect for -- treated as negligible.",
      };
    }

    const idealTimeSeconds = context.distanceMeters / equivalentCalmSpeedMS;
    const adjustmentSeconds = context.actualTimeSeconds - idealTimeSeconds;

    const direction = adjustmentSeconds > 0 ? "slowed you down" : adjustmentSeconds < 0 ? "helped you along" : "had little effect";
    const summary = `Wind integrated point-by-point along your route's actual heading changes, ${direction} over the course of the effort.`;

    return {
      factor: "Wind",
      adjustmentSeconds,
      confidenceLowSeconds: adjustmentSeconds - Math.abs(adjustmentSeconds) * CONFIDENCE_BAND_FRACTION,
      confidenceHighSeconds: adjustmentSeconds + Math.abs(adjustmentSeconds) * CONFIDENCE_BAND_FRACTION,
      summary,
    };
  },
};
