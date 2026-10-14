// Independent, from-scratch reimplementation of the physiology behind John
// J. Davis's ("Running Writings") Altitude-Adjusted Pace calculator
// (apps.runningwritings.com/altitude-adjusted-pace/). Every constant below
// was fit by black-box statistical regression against 825 (input
// performance -> predicted output) pairs collected from the free, public
// calculator -- no source code was read or copied to produce this file.
// See /docs/altitude-adjusted-pace-reverse-engineering-report.md for the
// full methodology, candidate-model comparisons, and validation results.
//
// The model has two independent pieces that combine multiplicatively:
//   1. A distance x altitude "impairment surface": what fraction of a
//      race's time is added by running at a given absolute altitude,
//      which itself splits into a universal altitude-cost curve p(alt)
//      (Step 1 below) times a distance-dependent aerobic-contribution
//      fraction f(d) (Step 2) -- confirmed empirically self-similar: the
//      SAME p(alt) shape applies at every distance >= 5000m (CV < 0.1%
//      across 823 collected points), and f(d) is a smooth 0->1 ramp
//      below that, matching real exercise-physiology "% aerobic
//      contribution by event duration" curves (near-zero at 400m, ~0.7
//      at a mile, ~0.97 by 4000m).
//   2. A continuous home-altitude acclimation discount (Step 3): how much
//      of that impairment a runner who actually lives at altitude gets
//      back, fit as a saturating function of *absolute* home altitude
//      (not home-relative-to-venue) -- runners living at 8,000ft+ all
//      converge on nearly the same acclimation benefit regardless of how
//      much higher the race venue itself is, which is exactly what you'd
//      expect from a real physiological adaptation ceiling.
//
// This is NOT the same model as this codebase's existing
// altitude-vo2max-math.ts, which independently reasons from cited
// Bassett/Peronnet regressions (population-level VO2max-at-altitude
// curves) for the Altitude Calculator's VO2max-conversion question. That
// module answers "what % of sea-level aerobic capacity is available at
// altitude X, acclimatized vs not" from published, citable science. This
// module answers a different, narrower question -- "what does a specific
// distance performance convert to at another altitude" -- via a genuinely
// proprietary, unpublished statistical model that only exists inside
// Davis's calculator, which is why it required the black-box treatment at
// all. The two are deliberately NOT unified: they're sourced from
// different evidence (a citable population regression vs. a third party's
// undisclosed fitted model) answering different questions, and collapsing
// them would blur that distinction. See the report for the full reasoning
// on why this lives alongside the existing module rather than replacing
// it.

const FT_PER_M = 3.28084;

// --- Step 1: the universal altitude-cost curve p(alt) ---------------------
//
// Fraction of race time added by altitude alone, for a fully aerobic
// (d >= 5000m) event, as a quartic polynomial in altitude (meters).
// Compared against quadratic/cubic/quintic candidates fit on the same 13
// altitude points (0-12,000ft in 1,000ft steps, averaged across all
// 5000m+ distances tested): quartic was the clear elbow (RMSE 0.00059 vs.
// quadratic's 0.00175 and cubic's 0.00125), and quintic's extra term
// barely improved on quartic (0.00057) -- not worth a 5th parameter.
const P_ALT_QUARTIC = {
  a: 2.6792722260022464e-5,
  b: -3.826449111007546e-9,
  c: 5.714632274129514e-12,
  d: -9.370221157357895e-16,
};

function altitudeCostFraction(altitudeMeters: number): number {
  const x = Math.max(altitudeMeters, 0);
  return P_ALT_QUARTIC.a * x + P_ALT_QUARTIC.b * x ** 2 + P_ALT_QUARTIC.c * x ** 3 + P_ALT_QUARTIC.d * x ** 4;
}

// --- Step 2: the distance-dependent aerobic-contribution fraction f(d) ----
//
// For d >= 5000m: exactly 1 -- confirmed empirically (mean 1.0000, std
// <0.001 across 11 distances from 5000m to the marathon), i.e. altitude
// impairment stops growing with distance once a race is fully
// aerobic-capacity-limited.
// For d < 5000m: a natural cubic spline through empirically-measured
// anchor points, ramping from ~0 at 400m (a sprint's altitude effect is
// at the noise floor of the source calculator's own rounding) up to 1.0
// at 5000m -- the same "exact interpolating spline through low-noise
// anchors" technique already used and validated in
// tinman-calculator-math.ts's distanceShapeRatio, reused here rather than
// a single global polynomial for the same reason: a global fit is close
// in aggregate but has real bias right at the anchors that would matter
// once compounded through extrapolation.
const F_SPLINE_METERS = [400, 600, 800, 1000, 1200, 1500, 1600, 1609.344, 3000, 3200, 3218.688, 4000, 5000];
const F_SPLINE_VALUES = [0, 0.1396, 0.2891, 0.5157, 0.5841, 0.6672, 0.6902, 0.6927, 0.9183, 0.9286, 0.9298, 0.9645, 1];

type SplineSegment = { x0: number; a: number; b: number; c: number; d: number };

// Duplicated (not imported) from tinman-calculator-math.ts's own private
// natural-cubic-spline solver, deliberately: that solver is unexported and
// this is a small, generic ~30-line utility, not a shared physiological
// model -- unifying it into a shared module wasn't asked for here and
// would be an unrelated refactor of an already-shipped, already-verified
// file (the same reasoning wind-physics.ts documents for not unifying its
// own flat-cost curve with grade-pace-physics.ts's).
function buildNaturalCubicSpline(xs: number[], ys: number[]): SplineSegment[] {
  const n = xs.length;
  const h: number[] = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) h[i] = xs[i + 1] - xs[i];

  const alpha = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    alpha[i] = (3 / h[i]) * (ys[i + 1] - ys[i]) - (3 / h[i - 1]) * (ys[i] - ys[i - 1]);
  }

  const l = new Array(n).fill(0);
  const mu = new Array(n).fill(0);
  const z = new Array(n).fill(0);
  l[0] = 1;
  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }
  l[n - 1] = 1;

  const c = new Array(n).fill(0);
  const b = new Array(n).fill(0);
  const d = new Array(n).fill(0);
  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (ys[j + 1] - ys[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }

  const segments: SplineSegment[] = [];
  for (let i = 0; i < n - 1; i++) {
    segments.push({ x0: xs[i], a: ys[i], b: b[i], c: c[i], d: d[i] });
  }
  return segments;
}

function evalSpline(segments: SplineSegment[], knotXs: number[], x: number): number {
  let i = 0;
  while (i < segments.length - 1 && x > knotXs[i + 1]) i++;
  const seg = segments[i];
  const dx = x - seg.x0;
  return seg.a + seg.b * dx + seg.c * dx * dx + seg.d * dx * dx * dx;
}

const fSplineSegments = buildNaturalCubicSpline(F_SPLINE_METERS, F_SPLINE_VALUES);

function aerobicContributionFraction(distanceMeters: number): number {
  if (distanceMeters >= 5000) return 1;
  if (distanceMeters <= 400) return Math.max(0, evalSpline(fSplineSegments, F_SPLINE_METERS, 400));
  return evalSpline(fSplineSegments, F_SPLINE_METERS, distanceMeters);
}

// --- Step 3: the acclimation discount --------------------------------------
//
// What fraction of the full (unacclimatized) altitude impairment is
// removed by living at a given home altitude, fit as a saturating
// exponential in *absolute* home altitude (meters) -- not home altitude
// relative to the venue. This was the key empirical finding here: pooling
// every (venue, home) pair tested and grouping only by home altitude, the
// acclimation benefit clusters tightly regardless of venue (e.g. a runner
// living at ~4,000ft gets roughly the same acclimation credit whether
// racing at 4,000ft or 12,000ft) -- consistent with acclimation being a
// real physiological adaptation to where you actually live, not a
// proportional discount tied to the race's own altitude. The saturating
// shape also captures a real ceiling effect visible in the data: runners
// living above ~8,000-10,000ft stop gaining additional acclimation credit
// as home altitude keeps climbing.
const ACCLIMATION = { amplitude: 0.6325405649810725, tauMeters: 4866.903822059606 };

function acclimationFraction(homeAltitudeMeters: number): number {
  const x = Math.max(homeAltitudeMeters, 0);
  return ACCLIMATION.amplitude * (1 - Math.exp(-x / ACCLIMATION.tauMeters));
}

// --- Orchestrator -----------------------------------------------------------

export type AltitudeConversionInput = {
  /** Race/effort distance, in meters. */
  distanceMeters: number;
  /** The performance to convert, in seconds. */
  timeSeconds: number;
  /** Altitude where the input performance was actually run, in meters. */
  venueAltitudeMeters: number;
  /** The runner's home (living) altitude, in meters -- drives the acclimation discount. Use 0 for a sea-level resident. */
  homeAltitudeMeters: number;
  /** The altitude to convert the performance to, in meters. Use 0 for a sea-level-equivalent. */
  targetAltitudeMeters: number;
};

// Converts a real performance run at one altitude into its equivalent
// effort at another altitude, for a runner acclimated to a given home
// altitude. Matches the source calculator's own two modes (pace/result
// mode and effort mode) since both are just this same time-scaling ratio
// applied in whichever direction the caller wants.
export function convertPerformanceBetweenAltitudes(input: AltitudeConversionInput): number {
  const { distanceMeters, timeSeconds, venueAltitudeMeters, homeAltitudeMeters, targetAltitudeMeters } = input;

  const aerobicFraction = aerobicContributionFraction(distanceMeters);
  const acclimation = acclimationFraction(homeAltitudeMeters);

  const venueImpairment = aerobicFraction * altitudeCostFraction(venueAltitudeMeters) * (1 - acclimation);
  const targetImpairment = aerobicFraction * altitudeCostFraction(targetAltitudeMeters) * (1 - acclimation);

  return timeSeconds * ((1 - venueImpairment) / (1 - targetImpairment));
}

// Feet <-> meters, matching the FT_PER_M convention already used in
// altitude-vo2max-math.ts.
export function feetToMeters(feet: number): number {
  return feet / FT_PER_M;
}
export function metersToFeet(meters: number): number {
  return meters * FT_PER_M;
}
