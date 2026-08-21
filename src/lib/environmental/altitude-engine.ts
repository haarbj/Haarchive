// Altitude's effect on aerobic performance -- distinct from elevation-engine.ts
// / precise-elevation-engine.ts, which cost a course's vertical GAIN and LOSS
// (mechanical work against gravity). This engine costs the course's absolute
// altitude above sea level: thinner air at elevation reduces the partial
// pressure of oxygen available for aerobic metabolism, lowering sustainable
// aerobic pace regardless of whether the course itself is flat.
//
// Model: a quadratic fit directly to Jack Daniels' Altitude Adjustment
// Tables' marathon multipliers (the VDOT system's own altitude-conversion
// data), replacing this engine's original "no effect below 1,500m, then
// linear" approximation -- that shape couldn't reproduce the tables' real,
// accelerating relationship (roughly: 7,000ft costs about twice what
// 5,000ft does, not the ~25x a hard threshold right next to 5,000ft would
// imply). Least-squares fit, through the origin (zero altitude -> zero
// effect), to the six published marathon-multiplier rows (3,000-8,000ft):
//
//   impairment fraction = 0.00131*k + 0.000737*k^2,  k = altitude in
//   thousands of feet
//
// matches all six rows within +/-0.0004 (0.04 percentage points) -- tighter
// than a naively-eyeballed quadratic checked against only three of the six
// rows during review, which drifted by up to 0.6 points at the high end.
//
// Distance scaling: Daniels' tables give separate Mile/5K/Marathon
// multipliers rather than one continuous formula, and they do NOT scale the
// way heat-model.ts's duration curve (calibrated to Mantzios et al.'s
// thermoregulatory data, and originally borrowed here) would predict --
// averaged across all six altitude rows, the tables' own Mile:Marathon and
// 5K:Marathon impairment ratios are ~0.29 and ~0.71, versus heat's duration
// curve, which would floor both a mile AND a 5K to the same ~0.15. That
// makes physiological sense: heat's thermoregulatory strain genuinely
// builds up over time in a way altitude's oxygen-availability limit doesn't
// -- thin air matters from the first stride, not just on a long effort.
// altitudeDurationScale below interpolates (log-time) between those three
// table-derived anchor points instead.

import type { AdjustmentEngine, EngineResult, PerformanceContext } from "@/lib/environmental/types";

export type AltitudeEngineInput = {
  /** Absolute altitude above sea level, in meters -- not vertical gain/loss (see elevation-engine.ts for that). */
  altitudeM: number;
};

const FT_PER_M = 3.28084;

// Fit to Daniels' marathon-multiplier table (impairment fraction, k in
// thousands of feet) -- see the file header for the fit quality.
const LINEAR_COEFF = 0.00131;
const QUADRATIC_COEFF = 0.000737;

// Beyond this, we're extrapolating well past Daniels' own calibrated range
// (his tables stop at 8,000ft) -- clamp rather than let the quadratic run
// away. ~14,000ft sits close to Pikes Peak Marathon's summit, comfortably
// covering any realistic road/trail race course.
const MAX_MODELED_ALTITUDE_FT = 14000;

function marathonImpairmentFraction(altitudeM: number): number {
  const altitudeKFt = Math.min(Math.max(altitudeM, 0) * FT_PER_M, MAX_MODELED_ALTITUDE_FT) / 1000;
  return LINEAR_COEFF * altitudeKFt + QUADRATIC_COEFF * altitudeKFt ** 2;
}

// Table-derived anchor points (seconds, impairment-fraction-relative-to-
// marathon) -- see the file header. Representative "serious recreational"
// times for Mile/5K; the marathon anchor matches heat-model.ts's own
// MARATHON_REFERENCE_SECONDS for consistency across engines even though the
// scaling curve itself is no longer shared.
const MARATHON_REFERENCE_SECONDS = 4 * 3600;
const DURATION_ANCHORS = [
  { seconds: 6 * 60, scale: 0.293 }, // Mile
  { seconds: 22 * 60, scale: 0.708 }, // 5K
  { seconds: MARATHON_REFERENCE_SECONDS, scale: 1.0 }, // Marathon
] as const;

function altitudeDurationScale(actualTimeSeconds: number): number {
  if (actualTimeSeconds <= DURATION_ANCHORS[0].seconds) return DURATION_ANCHORS[0].scale;
  if (actualTimeSeconds >= DURATION_ANCHORS[2].seconds) return DURATION_ANCHORS[2].scale;

  const [lo, hi] =
    actualTimeSeconds <= DURATION_ANCHORS[1].seconds
      ? [DURATION_ANCHORS[0], DURATION_ANCHORS[1]]
      : [DURATION_ANCHORS[1], DURATION_ANCHORS[2]];
  const t = (Math.log(actualTimeSeconds) - Math.log(lo.seconds)) / (Math.log(hi.seconds) - Math.log(lo.seconds));
  return lo.scale + t * (hi.scale - lo.scale);
}

// Wider than heat/humidity's 0.3 -- individual altitude tolerance
// (acclimatization, altitude training history) is genuinely more variable
// than temperature tolerance, and this is a table fit, not a controlled
// study of any one runner.
const CONFIDENCE_BAND_FRACTION = 0.4;

export const altitudeEngine: AdjustmentEngine<AltitudeEngineInput> = {
  factor: "Altitude",

  isApplicable(input: AltitudeEngineInput) {
    return Number.isFinite(input.altitudeM) && input.altitudeM > 0;
  },

  compute(input: AltitudeEngineInput, context: PerformanceContext): EngineResult {
    const fraction = marathonImpairmentFraction(input.altitudeM);
    const adjustmentSeconds = fraction * altitudeDurationScale(context.actualTimeSeconds) * context.actualTimeSeconds;

    const summary = `At ${Math.round(input.altitudeM)}m above sea level, thinner air reduces how much oxygen you can take in, which costs aerobic performance -- longer, more aerobic efforts feel it more than a short, anaerobic-dominated one.`;

    return {
      factor: "Altitude",
      adjustmentSeconds,
      confidenceLowSeconds: adjustmentSeconds - Math.abs(adjustmentSeconds) * CONFIDENCE_BAND_FRACTION,
      confidenceHighSeconds: adjustmentSeconds + Math.abs(adjustmentSeconds) * CONFIDENCE_BAND_FRACTION,
      summary,
    };
  },
};
