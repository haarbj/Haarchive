// Independent, from-scratch reimplementation of the physiology behind Tom
// Schwartz's ("Tinman") Running Calculator (finalsurge.com/tinman-calculator).
// Every constant below was fit by black-box statistical regression against
// ~3,360 (input performance -> predicted output) pairs collected from the
// free public calculator -- no source code was read or copied to produce
// this file. See /docs/tinman-reverse-engineering-report.md for the full
// methodology, candidate-model comparisons, and validation results.
//
// The model has one core "fitness metric": every performance is converted
// into an equivalent 3000m time ("time3k"), via a single distance-based
// shape curve n(d) = predicted-time(d) / predicted-time(3000m), fit
// independently of the runner's ability (that self-similarity was verified
// empirically -- the ratio has <0.02% variance across 112 real, wildly
// different performances). Everything else -- training paces, equivalent
// race times, the vVO2max estimate, and the Rating percentage -- derives
// from time3k. This is *not* Jack Daniels/Gilbert VDOT: that candidate was
// tested directly and fit ~1000x worse (see the report).

export type Gender = "male" | "female";

// --- Step 2 & 5: the shape curve n(d) ------------------------------------
//
// For d >= 3000m: a pure power law (Riegel-family fatigue curve), fit by
// nonlinear regression on the pooled ratio-to-3000m data, constrained so
// a * 3000^b == 1 exactly -- guaranteeing the power-law piece and the
// spline piece below agree exactly at their shared 3000m boundary (an
// unconstrained fit lands at 0.999976, a small but needless discontinuity
// right at the curve's own reference point).
const LONG_POWER_LAW = { a: 0.00020964319676, b: 1.0579208941 };

// For d < 3000m: a natural cubic spline through empirically-measured
// ratio-to-3000m anchor points. A single global polynomial under- and
// over-shoots by enough to matter once compounded through a long
// extrapolation (e.g. projecting a mile time out to a marathon); an exact
// interpolating spline through these (near-zero-noise, CV < 0.02%) anchors
// removes that error. The two anchors at 1500m and "Mile" were further
// refined via a cross-distance backsolve (using each row's own, highly
// precise long-distance equivalent time to back out the true value) since
// those two distances are also used as *inputs*, where precision matters
// most.
const SHORT_SPLINE_METERS = [
  100, 200, 400, 800, 1000, 1200, 1500, 1600, 1609.344, 2000, 2400, 3000,
];
const SHORT_SPLINE_RATIOS = [
  0.021756001247, 0.043541363744, 0.097640939932, 0.22898664973,
  0.29798650627, 0.36628235664, 0.46727947163, 0.50220376475,
  0.5046718619, 0.64443149455, 0.7866587062, 1,
];

type SplineSegment = { x0: number; a: number; b: number; c: number; d: number };

// Standard natural-cubic-spline coefficient solve (Burden & Faires /
// "Numerical Recipes" algorithm): tridiagonal system for the second
// derivatives, with natural (zero second-derivative) boundary conditions.
// Verified to agree with R's `splinefun(method = "natural")` to 12+
// significant digits at every test point used during development.
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

const shortSplineSegments = buildNaturalCubicSpline(SHORT_SPLINE_METERS, SHORT_SPLINE_RATIOS);

// n(d): ratio of predicted time at distance `meters` to predicted time at
// 3000m, for one fixed fitness level. Used both to normalize an input
// performance into time3k (dividing) and to project time3k out to any
// other distance (multiplying) -- see fitnessMetric() and
// predictEquivalentRaceTimes().
export function distanceShapeRatio(meters: number): number {
  if (meters >= 3000) return LONG_POWER_LAW.a * Math.pow(meters, LONG_POWER_LAW.b);
  return evalSpline(shortSplineSegments, SHORT_SPLINE_METERS, meters);
}

// --- Step 2: the core fitness metric --------------------------------------

// Converts any (distance, time) performance into its equivalent 3000m time
// ("time3k", in seconds) -- the single number every other calculation in
// this module derives from.
export function calculateTinmanFitness(inputMeters: number, inputSeconds: number): number {
  return inputSeconds / distanceShapeRatio(inputMeters);
}

// --- Step 3: vVO2max -------------------------------------------------------
//
// vVO2max is recovered as a log-correction applied to 3000m pace: a slower
// (longer-duration) time3k represents a smaller fraction of vVO2max, so the
// correction factor grows as time3k grows. Fit by nonlinear regression
// against the calculator's own "VO2 max" training-zone ceiling, which is
// column-distance-independent (CV < 0.02% across all 112 test
// performances) -- i.e. it IS vVO2max itself, not a zone-adjusted pace.
const VVO2MAX_LOG_CORRECTION = { alpha: -0.052812103132, beta: 1.1026960634 };

export type VVO2Max = {
  paceSecPerKm: number;
  paceSecPerMile: number;
  speedMetersPerMin: number;
};

const KM_PER_MILE = 1.609344;

export function calculateVVO2(time3kSeconds: number): VVO2Max {
  const time3kMinutes = time3kSeconds / 60;
  const pace3kSecPerKm = time3kSeconds / 3; // 3000m = 3km
  const correction = VVO2MAX_LOG_CORRECTION.alpha * Math.log(time3kMinutes) + VVO2MAX_LOG_CORRECTION.beta;
  const paceSecPerKm = pace3kSecPerKm * correction;
  return {
    paceSecPerKm,
    paceSecPerMile: paceSecPerKm * KM_PER_MILE,
    speedMetersPerMin: 60000 / paceSecPerKm,
  };
}

// --- Step 4: training zones -------------------------------------------------
//
// Each zone's low/high pace bound is a fixed ratio to vVO2max pace,
// constant across every fitness level tested (CV < 0.02%) -- an
// empirically-derived lookup table, not an assumed parametric curve (a
// single global "percent of vVO2max, raised to one shared exponent" model
// was tested and does not reproduce these ratios without knowing Tinman's
// own internal nominal-percent labels, which aren't publicly observable).
export const TRAINING_ZONES = [
  "Recovery", "Easy", "Moderate", "Tempo", "MLSS/Threshold", "CV",
  "Aerobic Power", "VO2 max", "Mixed Zone", "Anaerobic Capacity",
  "Anaerobic Power", "Speed Endurance", "Speed",
] as const;
export type TrainingZone = (typeof TRAINING_ZONES)[number];

const ZONE_RATIOS: Record<TrainingZone, { low: number; high: number }> = {
  Recovery: { low: 1.73283845753204, high: 1.60668015735869 },
  Easy: { low: 1.55101419179357, high: 1.45176233911231 },
  Moderate: { low: 1.40729980288112, high: 1.32696124686422 },
  Tempo: { low: 1.25630306196751, high: 1.19361075863812 },
  "MLSS/Threshold": { low: 1.16482952014335, high: 1.13229864342668 },
  CV: { low: 1.11171954752105, high: 1.08715445079098 },
  "Aerobic Power": { low: 1.06378832843183, high: 1.03719536445565 },
  "VO2 max": { low: 1.02028265518867, high: 1 },
  "Mixed Zone": { low: 0.962036725397828, high: 0.92718706754389 },
  "Anaerobic Capacity": { low: 0.895053127618146, high: 0.865342238024482 },
  "Anaerobic Power": { low: 0.837749533837554, high: 0.812078409981327 },
  "Speed Endurance": { low: 0.788103327727487, high: 0.7656859735309 },
  Speed: { low: 0.74459007511175, high: 0.724807828074212 },
};

// Column order matches the calculator's own display (widest/longest
// distance first). The four most intense zones hide their longest columns
// (that combination of zone x distance is never a meaningful prescription
// -- nobody runs a mile at "Speed" intensity) -- `hideBefore` is how many
// leading columns to hide for that zone.
export const TRAINING_PACE_COLUMNS: { label: string; meters: number }[] = [
  { label: "Mile", meters: KM_PER_MILE * 1000 },
  { label: "1600m", meters: 1600 },
  { label: "1000m", meters: 1000 },
  { label: "800m", meters: 800 },
  { label: "600m", meters: 600 },
  { label: "500m", meters: 500 },
  { label: "400m", meters: 400 },
  { label: "300m", meters: 300 },
  { label: "200m", meters: 200 },
  { label: "100m", meters: 100 },
];

const ZONE_HIDE_BEFORE: Partial<Record<TrainingZone, number>> = {
  "Anaerobic Capacity": 3,
  "Anaerobic Power": 5,
  "Speed Endurance": 7,
  Speed: 9,
};

export type TrainingPaceCell = { low: number; high: number } | null;
export type TrainingPaceRow = { zone: TrainingZone; cells: TrainingPaceCell[] };

// Returns every zone's low/high time (seconds) to cover each column
// distance, given the runner's vVO2max. `null` cells match the
// calculator's own "-" (not a meaningful prescription at that distance).
export function calculateTrainingPaces(vvo2: VVO2Max): TrainingPaceRow[] {
  return TRAINING_ZONES.map((zone) => {
    const hideBefore = ZONE_HIDE_BEFORE[zone] ?? 0;
    const ratios = ZONE_RATIOS[zone];
    const cells = TRAINING_PACE_COLUMNS.map((col, i) => {
      if (i < hideBefore) return null;
      const pace = col.label === "Mile" ? vvo2.paceSecPerMile : (vvo2.paceSecPerKm * col.meters) / 1000;
      return { low: pace * ratios.low, high: pace * ratios.high };
    });
    return { zone, cells };
  });
}

// --- Step 5: equivalent race times ------------------------------------------

export const EQUIVALENT_RACE_DISTANCES: { label: string; meters: number }[] = [
  { label: "100m", meters: 100 },
  { label: "200m", meters: 200 },
  { label: "400m", meters: 400 },
  { label: "800m", meters: 800 },
  { label: "1000m", meters: 1000 },
  { label: "1200m", meters: 1200 },
  { label: "1500m", meters: 1500 },
  { label: "1600m", meters: 1600 },
  { label: "Mile", meters: KM_PER_MILE * 1000 },
  { label: "2000m", meters: 2000 },
  { label: "2400m", meters: 2400 },
  { label: "3000m", meters: 3000 },
  { label: "3200m", meters: 3200 },
  { label: "2 miles", meters: KM_PER_MILE * 2000 },
  { label: "4k", meters: 4000 },
  { label: "3 miles", meters: KM_PER_MILE * 3000 },
  { label: "5k", meters: 5000 },
  { label: "4 miles", meters: KM_PER_MILE * 4000 },
  { label: "8k", meters: 8000 },
  { label: "5 miles", meters: KM_PER_MILE * 5000 },
  { label: "6 miles", meters: KM_PER_MILE * 6000 },
  { label: "10k", meters: 10000 },
  { label: "15k", meters: 15000 },
  { label: "10 miles", meters: KM_PER_MILE * 10000 },
  { label: "20k", meters: 20000 },
  { label: "Half Marathon", meters: 21097.5 },
  { label: "25k", meters: 25000 },
  { label: "30k", meters: 30000 },
  { label: "20 miles", meters: KM_PER_MILE * 20000 },
  { label: "marathon", meters: 42195 },
];

export type EquivalentRaceTime = { label: string; meters: number; seconds: number; paceSecPerKm: number; paceSecPerMile: number };

// Projects a time3k value out to every standard race distance. This is the
// exact same shape curve n(d) used to derive time3k in the first place,
// applied in the other direction.
export function predictEquivalentRaceTimes(time3kSeconds: number): EquivalentRaceTime[] {
  return EQUIVALENT_RACE_DISTANCES.map(({ label, meters }) => {
    const seconds = distanceShapeRatio(meters) * time3kSeconds;
    return {
      label,
      meters,
      seconds,
      paceSecPerKm: seconds / (meters / 1000),
      paceSecPerMile: (seconds / (meters / 1000)) * KM_PER_MILE,
    };
  });
}

// --- Race splits: plain even-pace arithmetic (no fitness curve at all) -----

export const RACE_SPLIT_DISTANCES: { label: string; meters: number }[] = [
  { label: "Mile", meters: KM_PER_MILE * 1000 },
  { label: "1600m", meters: 1600 },
  { label: "1200m", meters: 1200 },
  { label: "1000m", meters: 1000 },
  { label: "800m", meters: 800 },
  { label: "600m", meters: 600 },
  { label: "400m", meters: 400 },
  { label: "300m", meters: 300 },
  { label: "200m", meters: 200 },
];

// The literal, unadjusted per-distance time you'd hit running the input
// race at a perfectly even pace -- distinct from equivalentRaceTimes, which
// asks "what would this level of *fitness* predict at another distance."
export function calculateRaceSplits(inputMeters: number, inputSeconds: number): { label: string; seconds: number }[] {
  const paceSecPerMeter = inputSeconds / inputMeters;
  return RACE_SPLIT_DISTANCES.map(({ label, meters }) => ({
    label,
    seconds: paceSecPerMeter * meters,
  }));
}

// --- Step 6: Rating ----------------------------------------------------------
//
// A cubic polynomial in vVO2max speed (m/min), fit by regression against
// 112 real (performance -> rating%) pairs (RMSE 0.028 percentage points).
// Women's rating at the same vVO2max is a fixed 1.1326x multiple of men's
// (measured directly from 4 same-performance male/female query pairs, SD
// 0.0004 -- i.e. essentially an exact constant, not an approximation).
const RATING_COEFS = [2.6645523781, 0.21252340912, 7.188790065e-6, 1.1960275118e-7];
const RATING_FEMALE_MULTIPLIER = 1.132614131;

export function calculateRating(vvo2SpeedMetersPerMin: number, gender: Gender): number {
  const [c0, c1, c2, c3] = RATING_COEFS;
  const v = vvo2SpeedMetersPerMin;
  const male = c0 + c1 * v + c2 * v * v + c3 * v * v * v;
  return gender === "female" ? male * RATING_FEMALE_MULTIPLIER : male;
}

// --- Full pipeline, matching the calculator's own "Calculate Paces" ---------

export type TinmanResult = {
  time3kSeconds: number;
  vvo2: VVO2Max;
  rating: number;
  raceSplits: { label: string; seconds: number }[];
  trainingPaces: TrainingPaceRow[];
  equivalentRaceTimes: EquivalentRaceTime[];
};

// --- Step 7: display formatting ---------------------------------------------
//
// Two discovered, and unusual, conventions -- confirmed via self-consistency
// checks (an input's own equivalent time at its own distance should
// reproduce the input almost exactly; the residual reveals the display
// rule): (1) times under an hour are TRUNCATED (not rounded) to hundredths
// of a second -- self-checks for 3000m/5k/10k inputs consistently showed
// exactly -0.01s, never positive or larger, which is the signature of
// truncation rather than round-half-up; (2) times of an hour or more drop
// the hundredths entirely and truncate to the whole second -- half-
// marathon/marathon self-checks consistently showed exactly -1.00s.
export function formatTinmanTime(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  if (clamped >= 3600) {
    const wholeSeconds = Math.floor(clamped);
    const h = Math.floor(wholeSeconds / 3600);
    const m = Math.floor((wholeSeconds % 3600) / 60);
    const s = wholeSeconds % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  const truncatedHundredths = Math.floor(clamped * 100) / 100;
  const m = Math.floor(truncatedHundredths / 60);
  const s = truncatedHundredths - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

export function calculateTinman(inputMeters: number, inputSeconds: number, gender: Gender): TinmanResult {
  const time3kSeconds = calculateTinmanFitness(inputMeters, inputSeconds);
  const vvo2 = calculateVVO2(time3kSeconds);
  return {
    time3kSeconds,
    vvo2,
    rating: calculateRating(vvo2.speedMetersPerMin, gender),
    raceSplits: calculateRaceSplits(inputMeters, inputSeconds),
    trainingPaces: calculateTrainingPaces(vvo2),
    equivalentRaceTimes: predictEquivalentRaceTimes(time3kSeconds),
  };
}
