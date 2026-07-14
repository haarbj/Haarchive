// Track variant of WindEngine -- same "Wind" factor slot, but wrapping
// track-wind-physics.ts's curve-by-curve integration instead of the road
// model's single-heading projection, since a runner's heading rotates
// continuously through a track's bends. environmental-calculator.tsx
// picks exactly one of windEngine or trackWindEngine per calculation
// based on the selected course type -- never both.
//
// Reuses the same resolved-conditions shape as WindEngineInput
// (windFromBearingDeg + runnerHeadingBearingDeg, converted to a relative
// angle internally) so the calculator's weather-panel state feeds this
// engine with no changes: "runnerHeadingBearingDeg" just means "which way
// the home straight faces" here instead of "which way the runner heads."

import {
  REP_SEGMENTS,
  solveTrackWindEquivalentSpeedMS,
  type RepType,
  type SpeedOrEffort,
} from "@/lib/track-wind-physics";
import type { AdjustmentEngine, EngineResult, PerformanceContext } from "@/lib/environmental/types";
import { relativeAngleFromTrueBearing, windAtChestHeightMS, type WindProfile } from "@/lib/wind-physics";

export type TrackWindEngineInput = {
  /** Reference-height (e.g. 10m weather station) wind speed, m/s. */
  windSpeedMS: number;
  /** Meteorological convention: the compass bearing the wind is blowing FROM. */
  windFromBearingDeg: number;
  /** The compass bearing the track's home straight faces. */
  runnerHeadingBearingDeg: number;
  windProfile: WindProfile;
  weightKg: number;
  repType: RepType;
  speedOrEffort: SpeedOrEffort;
};

const CONFIDENCE_BAND_FRACTION = 0.2; // tighter than the road engine's -- curve-by-curve integration has fewer simplifying assumptions

export const trackWindEngine: AdjustmentEngine<TrackWindEngineInput> = {
  factor: "Wind",

  isApplicable(input: TrackWindEngineInput) {
    return Number.isFinite(input.windSpeedMS) && input.windSpeedMS > 0;
  },

  compute(input: TrackWindEngineInput, context: PerformanceContext): EngineResult {
    const chestWindMS = windAtChestHeightMS(input.windSpeedMS, input.windProfile);
    const windAngleDeg = relativeAngleFromTrueBearing(input.windFromBearingDeg, input.runnerHeadingBearingDeg);

    const equivalentCalmSpeedMS = solveTrackWindEquivalentSpeedMS({
      speedMS: context.paceMS,
      repType: input.repType,
      trueWindMS: chestWindMS,
      windAngleDeg,
      weightKg: input.weightKg,
      paceOrEffort: "actual-pace",
      speedOrEffort: input.speedOrEffort,
    });

    if (!Number.isFinite(equivalentCalmSpeedMS) || equivalentCalmSpeedMS <= 0) {
      return {
        factor: "Wind",
        adjustmentSeconds: 0,
        confidenceLowSeconds: 0,
        confidenceHighSeconds: 0,
        summary: "Wind conditions were outside the range this model can estimate a time effect for -- treated as negligible.",
      };
    }

    const rep = REP_SEGMENTS[input.repType];
    const idealTimeSeconds = rep.distanceM / equivalentCalmSpeedMS;
    const adjustmentSeconds = context.actualTimeSeconds - idealTimeSeconds;

    const direction = adjustmentSeconds > 0 ? "slowed you down" : adjustmentSeconds < 0 ? "helped you along" : "had little effect";
    const summary = `Wind integrated curve-by-curve around the track, factoring in how the effect alternates through the bends, ${direction} over the rep.`;

    return {
      factor: "Wind",
      adjustmentSeconds,
      confidenceLowSeconds: adjustmentSeconds - Math.abs(adjustmentSeconds) * CONFIDENCE_BAND_FRACTION,
      confidenceHighSeconds: adjustmentSeconds + Math.abs(adjustmentSeconds) * CONFIDENCE_BAND_FRACTION,
      summary,
    };
  },
};
