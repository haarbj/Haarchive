// Core prediction math behind the threshold/CV/VO2max pace calculator --
// adapted from John Davis's cv-threshold-calculator
// (github.com/johnjdavisiv/cv-threshold-calculator, MIT licensed).
//
// This is the v2 (2026-09-05) model: a real, substantive upgrade this
// codebase's first port (fit on ~8,600 performances, a 9-cell
// quantile-regression grid) had fallen behind on. The current model is a
// sinh-arcsinh (shash) distributional GAM per outcome -- threshold (cs_minus),
// CV (cs), VO2max pace (cs_plus) -- fit to 613,889 real race performances
// across 185,965 athlete-seasons. Each outcome has four parameters (mu,
// sigma, epsilon/skew, delta/tails), every one a tensor-product cubic-
// regression-spline surface in (log10 distance_m, log10 time_s). Between
// knots such a surface is exactly a bicubic polynomial, so the shipped data
// file (public/data/cv-threshold-pieces-v2026-09-05.json) holds the 16
// coefficients per knot cell directly -- no interpolation error, and any
// quantile is closed-form:
//
//   sigma = exp(log_sigma) + sigma_floor;  delta = exp(log_delta)
//   q_p = mu + sigma * delta * sinh((asinh(z_p) + eps) / delta)
//   speed_m_s = exp(q_p)
//
// mu is evaluated at the query as entered (a cubic regression spline is
// linear beyond its outer knots, so this extrapolates in a principled way);
// the three spread parameters are evaluated at the point clamped into the
// real data hull, because those surfaces blow up outside it -- see
// hullStatusFor below, which is also what drives the UI's extrapolation
// note.
//
// A real, functional change from the model this replaces: v2 has no age
// input at all (it's fit at a fixed "college" level; John Davis's own
// commit message describes this explicitly). This codebase's earlier port
// had an age input as a documented enhancement over the original tool --
// that enhancement no longer has a model underneath it, so it's removed
// here (and from every caller) rather than kept as a control that silently
// stopped doing anything.
//
// Verified against 429 real golden test cases from the source repo's own R
// predict() output (tests/fixtures/cv-threshold-goldens.json) -- every one
// of the 9,009 checked (mu, sigma, eps, delta, and all 7 quantiles x 3
// outcomes x 429 cases) matches to floating-point exactness, confirming
// this port reproduces the piecewise-bicubic evaluation exactly, not just
// approximately.

export type CvOutcome = "cs" | "cs_minus" | "cs_plus";
export type QuantileKey = "q025" | "q05" | "q10" | "q50" | "q90" | "q95" | "q975";
export type RangeLevel = 80 | 90 | 95;
export type EstimateMode = "safe" | "median";
export type HullStatus = "inside" | "slow" | "fast" | "short" | "long";

type SplinePiece = {
  x_breaks: number[];
  t_breaks: number[];
  /** [x-cell][t-cell][16 bicubic coefficients, coef[4*i+j] multiplies u^i * v^j] */
  coef: number[][][];
};

type OutcomeParams = {
  mu: SplinePiece;
  log_sigma: SplinePiece;
  eps: SplinePiece;
  log_delta: SplinePiece;
};

export type CvPiecesModel = {
  sigma_floor: number;
  hull: { distance_m: number[]; fast_s: number[]; slow_s: number[] };
  outcomes: Record<CvOutcome, OutcomeParams>;
};

export type CvThresholdPrediction = Record<CvOutcome, Record<QuantileKey, number>>;

const QUANTILE_KEYS: QuantileKey[] = ["q025", "q05", "q10", "q50", "q90", "q95", "q975"];

// Standard-normal quantiles (R's qnorm) for the levels the model uses.
const Z: Record<QuantileKey, number> = {
  q025: -1.959963984540054,
  q05: -1.6448536269514722,
  q10: -1.2815515655446004,
  q50: 0,
  q90: 1.2815515655446004,
  q95: 1.6448536269514722,
  q975: 1.959963984540054,
};

// Index of the cell holding v: the last break <= v, clamped to the first
// and last cells -- outside the model's own export domain the edge cell's
// polynomial is extended, which is still the model's real value (a cubic
// regression spline is linear beyond its outer knots, and every outer knot
// sits strictly inside the domain).
function cellIndex(v: number, breaks: number[]): number {
  let i = 0;
  while (i < breaks.length - 2 && v >= breaks[i + 1]) i++;
  return i;
}

// sum_{i,j=0..3} coef[ix][it][4i+j] * u^i * v^j, Horner in both variables.
function evalPiece(piece: SplinePiece, x: number, t: number): number {
  const ix = cellIndex(x, piece.x_breaks);
  const it = cellIndex(t, piece.t_breaks);
  const u = (x - piece.x_breaks[ix]) / (piece.x_breaks[ix + 1] - piece.x_breaks[ix]);
  const v = (t - piece.t_breaks[it]) / (piece.t_breaks[it + 1] - piece.t_breaks[it]);
  const c = piece.coef[ix][it];
  let out = 0;
  for (let i = 3; i >= 0; i--) {
    const k = 4 * i;
    out = out * u + ((c[k + 3] * v + c[k + 2]) * v + c[k + 1]) * v + c[k];
  }
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

// Linear in log-log between the hull's vertices, constant beyond the end
// vertices. At a vertex the tabulated time is returned exactly.
function hullEdge(logHullD: number[], edgeS: number[], log10Dist: number): number {
  const n = logHullD.length;
  if (log10Dist <= logHullD[0]) return edgeS[0];
  if (log10Dist >= logHullD[n - 1]) return edgeS[n - 1];
  let i = 0;
  while (log10Dist > logHullD[i + 1]) i++;
  if (log10Dist === logHullD[i]) return edgeS[i];
  if (log10Dist === logHullD[i + 1]) return edgeS[i + 1];
  const w = (log10Dist - logHullD[i]) / (logHullD[i + 1] - logHullD[i]);
  return 10 ** (Math.log10(edgeS[i]) + w * (Math.log10(edgeS[i + 1]) - Math.log10(edgeS[i])));
}

function hullBounds(model: CvPiecesModel, distanceMeters: number): { fastS: number; slowS: number } {
  const hull = model.hull;
  const logHullD = hull.distance_m.map(Math.log10);
  const x = Math.log10(clamp(distanceMeters, hull.distance_m[0], hull.distance_m[hull.distance_m.length - 1]));
  return { fastS: hullEdge(logHullD, hull.fast_s, x), slowS: hullEdge(logHullD, hull.slow_s, x) };
}

// 'inside' | 'slow' | 'fast' | 'short' | 'long' -- distance first, then the
// time band at that distance. Drives the UI's extrapolation note.
export function hullStatusFor(model: CvPiecesModel, distanceMeters: number, timeSeconds: number): HullStatus {
  const hull = model.hull;
  const minM = hull.distance_m[0];
  const maxM = hull.distance_m[hull.distance_m.length - 1];
  if (!(distanceMeters >= minM)) return "short";
  if (distanceMeters > maxM) return "long";
  const b = hullBounds(model, distanceMeters);
  if (timeSeconds > b.slowS) return "slow";
  if (timeSeconds < b.fastS) return "fast";
  return "inside";
}

export function isWithinModelDomain(model: CvPiecesModel, distanceMeters: number, timeSeconds: number): boolean {
  return hullStatusFor(model, distanceMeters, timeSeconds) === "inside";
}

// The model's own valid input-speed range (m/s) -- outside this, the
// spline pieces aren't meaningful at all (not just extrapolated).
const MODEL_MIN_SPEED_MS = 2.1;
const MODEL_MAX_SPEED_MS = 10;
export function speedInModelRange(speedMS: number): boolean {
  return Number.isFinite(speedMS) && speedMS >= MODEL_MIN_SPEED_MS && speedMS <= MODEL_MAX_SPEED_MS;
}

export type ShashParams = { mu: number; sigma: number; eps: number; delta: number };

// The four shash parameters for one outcome: mu at the query as entered,
// the three spread parameters at the hull-clamped point.
export function predictOutcomeParams(
  model: CvPiecesModel,
  outcome: CvOutcome,
  distanceMeters: number,
  timeSeconds: number,
): ShashParams {
  const P = model.outcomes[outcome];
  const x = Math.log10(distanceMeters);
  const t = Math.log10(timeSeconds);
  const hull = model.hull;
  const dc = clamp(distanceMeters, hull.distance_m[0], hull.distance_m[hull.distance_m.length - 1]);
  const b = hullBounds(model, dc);
  const xc = Math.log10(dc);
  const tc = Math.log10(clamp(timeSeconds, b.fastS, b.slowS));
  return {
    mu: evalPiece(P.mu, x, t),
    sigma: Math.exp(evalPiece(P.log_sigma, xc, tc)) + model.sigma_floor,
    eps: evalPiece(P.eps, xc, tc),
    delta: Math.exp(evalPiece(P.log_delta, xc, tc)),
  };
}

export function quantileSpeed(params: ShashParams, quantile: QuantileKey): number {
  return Math.exp(
    params.mu + params.sigma * params.delta * Math.sinh((Math.asinh(Z[quantile]) + params.eps) / params.delta),
  );
}

// Runs the full prediction: a race performance (distance + time) in, all
// 3 outcomes x 7 percentiles out, as speeds in m/s. No age input -- see
// this file's own header for why.
export function predictSpeeds(model: CvPiecesModel, distanceMeters: number, timeSeconds: number): CvThresholdPrediction {
  const result = {} as CvThresholdPrediction;
  for (const outcome of ["cs", "cs_minus", "cs_plus"] as const) {
    const params = predictOutcomeParams(model, outcome, distanceMeters, timeSeconds);
    const quantiles = {} as Record<QuantileKey, number>;
    for (const q of QUANTILE_KEYS) quantiles[q] = quantileSpeed(params, q);
    result[outcome] = quantiles;
  }
  return result;
}

// Threshold pace wants to be genuinely, reliably sub-threshold, so "safe"
// picks the slower (10th-percentile-speed) end; VO2max pace wants to be
// genuinely, reliably unsustainable, so "safe" picks the faster
// (90th-percentile-speed) end. CV pace is intentionally the 50/50 boundary
// in both modes -- there's no "safe" direction for a pace defined as the
// exact line between sustainable and unsustainable.
export function selectTrainingPaces(prediction: CvThresholdPrediction, mode: EstimateMode) {
  return {
    thresholdSpeedMS: mode === "safe" ? prediction.cs_minus.q10 : prediction.cs_minus.q50,
    cvSpeedMS: prediction.cs.q50,
    vo2maxSpeedMS: mode === "safe" ? prediction.cs_plus.q90 : prediction.cs_plus.q50,
  };
}

// Range ends as quantile keys: lo is the faster pace (the upper speed
// quantile), hi the slower -- matches the source calculator's own 80/90/95%
// range chips (v1 only ever showed a fixed 90% range).
const RANGE_QUANTILES: Record<RangeLevel, { lo: QuantileKey; hi: QuantileKey }> = {
  80: { lo: "q90", hi: "q10" },
  90: { lo: "q95", hi: "q05" },
  95: { lo: "q975", hi: "q025" },
};

export function uncertaintyRangeMS(prediction: CvThresholdPrediction, level: RangeLevel = 90) {
  const rq = RANGE_QUANTILES[level];
  return {
    threshold: { fastMS: prediction.cs_minus[rq.lo], slowMS: prediction.cs_minus[rq.hi] },
    cv: { fastMS: prediction.cs[rq.lo], slowMS: prediction.cs[rq.hi] },
    vo2max: { fastMS: prediction.cs_plus[rq.lo], slowMS: prediction.cs_plus[rq.hi] },
  };
}

// "30:00" for an extrapolation note (never rolls into hours -- the hull's
// own distance range, 800m-10km, never needs one).
function edgeTimeText(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// The extrapolation note for a race outside the data hull, or null inside
// it -- matches the source calculator's own wording exactly.
export function extrapolationNote(
  model: CvPiecesModel,
  distanceMeters: number,
  timeSeconds: number,
  raceLabel: string,
): string | null {
  const status = hullStatusFor(model, distanceMeters, timeSeconds);
  if (status === "inside") return null;
  const tail = "so these paces are extrapolated.";
  const hull = model.hull;
  const minM = hull.distance_m[0];
  const maxM = hull.distance_m[hull.distance_m.length - 1];
  const b = hullBounds(model, distanceMeters);
  switch (status) {
    case "slow":
      return `Few runners in our dataset ran slower than ${edgeTimeText(b.slowS)} for ${raceLabel}, ${tail}`;
    case "fast":
      return `Few runners in our dataset ran faster than ${edgeTimeText(b.fastS)} for ${raceLabel}, ${tail}`;
    case "short":
      return `Few runners in our dataset raced shorter than ${minM} m, ${tail}`;
    case "long":
      return `Few runners in our dataset raced longer than ${maxM / 1000} km, ${tail}`;
  }
}
