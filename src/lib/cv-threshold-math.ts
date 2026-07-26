// Core prediction math behind the threshold/CV/VO2max pace calculator --
// adapted from John Davis's cv-threshold-calculator
// (github.com/johnjdavisiv/cv-threshold-calculator, MIT licensed).
//
// The model itself is a set of pre-fit quantile-regression (GAM) surfaces,
// shipped as static data (see /public/data/cv-threshold-model.json) rather
// than fit here -- this module only evaluates that already-fit model at a
// query point. Each of the 9 outcome/percentile combinations below is a
// small additive model: predicted = intercept + f(age) + f(distance, time),
// where the two f() terms were already evaluated onto fixed grids when the
// model was fit in R, so "evaluating" them here is just interpolation:
// nearest-neighbor for the 1D age term (the age grid is 1 year per step,
// dense enough that nearest-neighbor is effectively exact), bilinear for
// the 2D distance/time term.

export type CvOutcome =
  | "cs_minus_10"
  | "cs_minus_50"
  | "cs_minus_90"
  | "cs_10"
  | "cs_50"
  | "cs_90"
  | "cs_plus_10"
  | "cs_plus_50"
  | "cs_plus_90";

export type OutcomeParams = {
  beta0: number;
  age_smooth: number[];
  te_smooth: number[][];
};

export type CvThresholdModel = {
  age_grid: number[];
  log10_dist_grid: number[];
  log10_time_grid: number[];
} & Record<CvOutcome, OutcomeParams>;

export type PercentileTriple = { p10: number; p50: number; p90: number };

export type CvThresholdPrediction = {
  thresholdSpeedMS: PercentileTriple;
  cvSpeedMS: PercentileTriple;
  vo2maxSpeedMS: PercentileTriple;
};

export type EstimateMode = "safe" | "median";

// Finds the index i such that grid[i] <= value <= grid[i+1], clamping to
// the first/last interval when value is outside the grid entirely (so a
// slightly-out-of-range query still extrapolates linearly from the nearest
// edge instead of throwing) -- domain validity itself is a separate check,
// see isWithinModelDomain.
function findGridIndex(value: number, grid: number[]): number {
  if (value <= grid[0]) return 0;
  if (value >= grid[grid.length - 1]) return grid.length - 2;
  for (let i = 0; i < grid.length - 1; i++) {
    if (value >= grid[i] && value <= grid[i + 1]) return i;
  }
  return 0;
}

function bilinearInterp(rowGrid: number[], colGrid: number[], matrix: number[][], queryRow: number, queryCol: number): number {
  const i = findGridIndex(queryRow, rowGrid);
  const j = findGridIndex(queryCol, colGrid);
  const r1 = rowGrid[i];
  const r2 = rowGrid[i + 1];
  const c1 = colGrid[j];
  const c2 = colGrid[j + 1];
  const t = (queryRow - r1) / (r2 - r1);
  const u = (queryCol - c1) / (c2 - c1);
  const q11 = matrix[i][j];
  const q21 = matrix[i + 1][j];
  const q12 = matrix[i][j + 1];
  const q22 = matrix[i + 1][j + 1];
  return (1 - t) * (1 - u) * q11 + t * (1 - u) * q21 + (1 - t) * u * q12 + t * u * q22;
}

function nearestAgeEffect(ageGrid: number[], ageSmooth: number[], queryAge: number): number {
  let closestIndex = 0;
  let smallestDiff = Math.abs(ageGrid[0] - queryAge);
  for (let i = 1; i < ageGrid.length; i++) {
    const diff = Math.abs(ageGrid[i] - queryAge);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closestIndex = i;
    }
  }
  return ageSmooth[closestIndex];
}

function predictOutcomeSpeed(model: CvThresholdModel, outcome: CvOutcome, log10Dist: number, log10Time: number, age: number): number {
  const params = model[outcome];
  const teEffect = bilinearInterp(model.log10_dist_grid, model.log10_time_grid, params.te_smooth, log10Dist, log10Time);
  const ageEffect = nearestAgeEffect(model.age_grid, params.age_smooth, age);
  return params.beta0 + ageEffect + teEffect;
}

// Runs the full prediction: a race performance (distance + time) and an
// age in, all 9 percentile/outcome speeds out. Distance and time are the
// only two dimensions of the underlying critical-speed model; age is a
// secondary adjustment on top of it.
export function predictSpeeds(model: CvThresholdModel, distanceMeters: number, timeSeconds: number, age: number): CvThresholdPrediction {
  const log10Dist = Math.log10(distanceMeters);
  const log10Time = Math.log10(timeSeconds);

  return {
    thresholdSpeedMS: {
      p10: predictOutcomeSpeed(model, "cs_minus_10", log10Dist, log10Time, age),
      p50: predictOutcomeSpeed(model, "cs_minus_50", log10Dist, log10Time, age),
      p90: predictOutcomeSpeed(model, "cs_minus_90", log10Dist, log10Time, age),
    },
    cvSpeedMS: {
      p10: predictOutcomeSpeed(model, "cs_10", log10Dist, log10Time, age),
      p50: predictOutcomeSpeed(model, "cs_50", log10Dist, log10Time, age),
      p90: predictOutcomeSpeed(model, "cs_90", log10Dist, log10Time, age),
    },
    vo2maxSpeedMS: {
      p10: predictOutcomeSpeed(model, "cs_plus_10", log10Dist, log10Time, age),
      p50: predictOutcomeSpeed(model, "cs_plus_50", log10Dist, log10Time, age),
      p90: predictOutcomeSpeed(model, "cs_plus_90", log10Dist, log10Time, age),
    },
  };
}

// Threshold pace wants to be genuinely, reliably sub-threshold, so "safe"
// picks the slower (10th-percentile-speed) end; VO2max pace wants to be
// genuinely, reliably unsustainable, so "safe" picks the faster
// (90th-percentile-speed) end. CV pace is intentionally the 50/50 boundary
// in both modes -- there's no "safe" direction for a pace defined as the
// exact line between sustainable and unsustainable.
export function selectTrainingPaces(prediction: CvThresholdPrediction, mode: EstimateMode) {
  return {
    thresholdSpeedMS: mode === "safe" ? prediction.thresholdSpeedMS.p10 : prediction.thresholdSpeedMS.p50,
    cvSpeedMS: prediction.cvSpeedMS.p50,
    vo2maxSpeedMS: mode === "safe" ? prediction.vo2maxSpeedMS.p90 : prediction.vo2maxSpeedMS.p50,
  };
}

// The uncertainty band shown alongside the point estimate -- always the
// 10th-to-90th-percentile speed range, converted the same "faster speed ->
// lower pace number" direction for all three paces (regardless of which
// percentile "safe" mode happens to pick as its point estimate above).
export function uncertaintyRangeMS(prediction: CvThresholdPrediction) {
  return {
    threshold: { fastMS: prediction.thresholdSpeedMS.p90, slowMS: prediction.thresholdSpeedMS.p10 },
    cv: { fastMS: prediction.cvSpeedMS.p90, slowMS: prediction.cvSpeedMS.p10 },
    vo2max: { fastMS: prediction.vo2maxSpeedMS.p90, slowMS: prediction.vo2maxSpeedMS.p10 },
  };
}

// Whether a query point is genuinely inside the range of race performances
// and ages the model was actually fit on -- checked directly against the
// grids' own real extents, not an arbitrary separate speed-bound constant
// (the original tool's out-of-range check tested a since-renamed object key
// and silently never fired; this checks the real domain instead).
export function isWithinModelDomain(model: CvThresholdModel, distanceMeters: number, timeSeconds: number, age: number): boolean {
  const log10Dist = Math.log10(distanceMeters);
  const log10Time = Math.log10(timeSeconds);
  const distGrid = model.log10_dist_grid;
  const timeGrid = model.log10_time_grid;
  const ageGrid = model.age_grid;

  return (
    log10Dist >= distGrid[0] &&
    log10Dist <= distGrid[distGrid.length - 1] &&
    log10Time >= timeGrid[0] &&
    log10Time <= timeGrid[timeGrid.length - 1] &&
    age >= ageGrid[0] &&
    age <= ageGrid[ageGrid.length - 1]
  );
}
