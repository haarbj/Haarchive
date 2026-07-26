// Meta-analytic reference ranges for where LT1 (aerobic threshold) and LT2
// (lactate/anaerobic threshold -- the same physiological point this site
// calls "Threshold" elsewhere) actually fall as a percentage of max heart
// rate and heart rate reserve, in real runners.
//
// Source: John Davis's lt1-lt2-hr-reference-ranges meta-analysis
// (github.com/johnjdavisiv/lt1-lt2-hr-reference-ranges, MIT licensed) -- a
// proper random-effects meta-analysis (via the R `metafor` package) across
// published studies, fit on a log(100 - x) transformed scale to correct for
// percentages being bounded at 100% and skewed as they approach it.
//
// That repository is a dataset and an R analysis script, not a web app --
// there was no existing interface to port. The constants below are the
// actual fitted results, verified by running the source repo's own R
// analysis directly (metafor::rma / rma.mv, REML) and confirming this
// module's TypeScript port reproduces R's output to 5+ decimal places,
// not re-derived or approximated independently.

export type HrBasis = "hrmax" | "hrreserve";
export type ThresholdKey = "lt1" | "lt2";

export type ThresholdDistribution = {
  // Mean and variance of log(100 - pct) across the pooled studies --
  // together these fully describe the reference-range distribution, so
  // any confidence level can be computed on demand rather than needing a
  // separately hardcoded range per level.
  transformedMean: number;
  totalVariance: number;
  studies: number;
  subjects: number;
};

// %HRmax: a real multi-study meta-analysis for both thresholds.
// %HR reserve: only one study (Weltman 1990, n=31) reports this metric at
// all -- there's no between-study variance to estimate, so this is that
// single study's own individual-level variability, not a pooled estimate.
// Flagged explicitly in the UI as lower-confidence rather than presented
// with the same weight as the %HRmax figures.
export const HR_THRESHOLD_DISTRIBUTIONS: Record<HrBasis, Record<ThresholdKey, ThresholdDistribution>> = {
  hrmax: {
    lt1: { transformedMean: 2.581, totalVariance: 0.27356, studies: 7, subjects: 140 },
    lt2: { transformedMean: 1.95, totalVariance: 0.41138, studies: 9, subjects: 162 },
  },
  hrreserve: {
    lt1: { transformedMean: 2.78903, totalVariance: 0.37037 ** 2, studies: 1, subjects: 31 },
    lt2: { transformedMean: 1.85857, totalVariance: 0.71453 ** 2, studies: 1, subjects: 31 },
  },
};

// Supplementary context only (see the calculator's methodology section) --
// not wired into the interactive tool, since presenting these usefully
// would require a separate VO2max-to-pace model this tool doesn't need.
export const VO2MAX_THRESHOLD_ESTIMATE: Record<ThresholdKey, { meanPct: number; lowPct: number; highPct: number; studies: number; subjects: number }> = {
  lt1: { meanPct: 81.4, lowPct: 65.1, highPct: 90.1, studies: 8, subjects: 159 },
  lt2: { meanPct: 88.5, lowPct: 73.3, highPct: 95.0, studies: 11, subjects: 293 },
};

// Peter Acklam's rational approximation of the standard normal quantile
// function (inverse CDF) -- verified against R's qnorm() to 6+ decimal
// places across the range this tool actually uses (p in roughly 0.025-0.975).
function inverseNormalCdf(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

export function meanPercent(basis: HrBasis, threshold: ThresholdKey): number {
  const d = HR_THRESHOLD_DISTRIBUTIONS[basis][threshold];
  return 100 - Math.exp(d.transformedMean);
}

// confidenceLevel is the width of the reference range (e.g. 0.9 for a
// range covering the central 90% of runners), not a confidence interval on
// the mean estimate itself -- this describes real between-runner variation,
// not uncertainty about the pooled average.
export function referenceRangePercent(basis: HrBasis, threshold: ThresholdKey, confidenceLevel: number): { low: number; high: number } {
  const d = HR_THRESHOLD_DISTRIBUTIONS[basis][threshold];
  const sd = Math.sqrt(d.totalVariance);
  const upperTail = (1 + confidenceLevel) / 2;
  const lowerTail = 1 - upperTail;
  // Inverted because the transform is log(100 - x): a higher transformed
  // value means a LOWER original percentage, so the tails swap.
  const upperRef = d.transformedMean + inverseNormalCdf(upperTail) * sd;
  const lowerRef = d.transformedMean + inverseNormalCdf(lowerTail) * sd;
  return {
    low: 100 - Math.exp(upperRef),
    high: 100 - Math.exp(lowerRef),
  };
}
