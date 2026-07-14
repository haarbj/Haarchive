// Thin wrapper around the already-validated physics in wind-physics.ts (the
// same model backing the standalone Wind Calculator), reframed as an
// AdjustmentEngine so it can be summed alongside heat/humidity/elevation.
//
// Without course/GPX data (deferred to a future session), this assumes the
// runner held one primary heading for the whole effort -- a real course
// with turns will have a wind effect that varies along the route, which is
// why the confidence band here is wider than the standalone calculator's
// point estimate would suggest on its own.

import type { AdjustmentEngine, EngineResult, PerformanceContext } from "@/lib/environmental/types";
import { paceModeEquivalentSpeedMS, relativeAngleFromTrueBearing, windAtChestHeightMSFromAlpha, windForwardLateral } from "@/lib/wind-physics";
import { windProfileAlphaFromExposure } from "@/lib/wind-exposure";

export type WindEngineInput = {
  /** Reference-height (e.g. 10m weather station) wind speed, m/s. */
  windSpeedMS: number;
  /** Meteorological convention: the compass bearing the wind is blowing FROM. */
  windFromBearingDeg: number;
  /** The compass bearing the runner primarily headed toward. */
  runnerHeadingBearingDeg: number;
  /** Continuous 0-100 wind-exposure score (see wind-exposure.ts) -- how sheltered the course is, not a fixed enum bucket. */
  windExposureScore: number;
  weightKg: number;
};

const CONFIDENCE_BAND_FRACTION = 0.25; // uncertainty here is mostly "one direction assumed for the whole course," not biology

export const windEngine: AdjustmentEngine<WindEngineInput> = {
  factor: "Wind",

  isApplicable(input: WindEngineInput) {
    return Number.isFinite(input.windSpeedMS) && input.windSpeedMS > 0;
  },

  compute(input: WindEngineInput, context: PerformanceContext): EngineResult {
    const chestWindMS = windAtChestHeightMSFromAlpha(input.windSpeedMS, windProfileAlphaFromExposure(input.windExposureScore));
    const relativeAngle = relativeAngleFromTrueBearing(input.windFromBearingDeg, input.runnerHeadingBearingDeg);
    const { forward, lateral } = windForwardLateral(chestWindMS, relativeAngle);
    const equivalentSpeedMS = paceModeEquivalentSpeedMS(context.paceMS, forward, lateral, input.weightKg);

    if (equivalentSpeedMS === null || equivalentSpeedMS <= 0) {
      return {
        factor: "Wind",
        adjustmentSeconds: 0,
        confidenceLowSeconds: 0,
        confidenceHighSeconds: 0,
        summary: "Wind conditions were outside the range this model can estimate a time effect for -- treated as negligible.",
      };
    }

    const idealTimeSeconds = context.distanceMeters / equivalentSpeedMS;
    const adjustmentSeconds = context.actualTimeSeconds - idealTimeSeconds;

    const direction = adjustmentSeconds > 0 ? "slowed you down" : adjustmentSeconds < 0 ? "helped you along" : "had little effect";
    const summary = `Wind at your chest height, factoring in its direction relative to your heading, ${direction} over the course of the effort.`;

    return {
      factor: "Wind",
      adjustmentSeconds,
      confidenceLowSeconds: adjustmentSeconds - Math.abs(adjustmentSeconds) * CONFIDENCE_BAND_FRACTION,
      confidenceHighSeconds: adjustmentSeconds + Math.abs(adjustmentSeconds) * CONFIDENCE_BAND_FRACTION,
      summary,
    };
  },
};
