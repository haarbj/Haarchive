// Grade-adjusted pace (GAP) physics, ported from johnjdavisiv/gap-app (MIT
// license) -- the flat-ground cost curve and grade-cost polynomial, not the
// original's fixed-point/grid-search solvers (replaced below with the same
// bisection approach already used and tested in wind-physics.ts).
//
// Two pieces combine to answer "what does this grade cost, in pace terms":
//
//   1. Flat-ground cost as a function of speed -- black-gam-flat-cost.json
//      is a smoothed regression (a GAM, fit in R with mgcv) over Black et
//      al. 2018's own digitized data points, elite-runner category. This is
//      a different (more empirically faithful, since it's fit directly to
//      the source data rather than a hand-picked quadratic) flat-cost curve
//      than wind-physics.ts's treadmillCostWPerKg -- deliberately not
//      unified with that one, since swapping the curve underneath the
//      already-shipped, already-verified wind calculators wasn't asked for
//      and would silently shift their results.
//   2. The *added* cost of a grade -- Minetti et al., "Energy cost of
//      walking and running at extreme uphill and downhill slopes" (Journal
//      of Applied Physiology, 2002), a quintic polynomial fit to their own
//      treadmill data across the full uphill/downhill range. This is the
//      real polynomial (elevation-engine.ts's earlier heuristic was an
//      approximation of this same finding, made without the actual
//      coefficients on hand).

import { solveSpeedForCost } from "@/lib/wind-physics";
import blackGamData from "@/lib/data/black-gam-flat-cost.json";

const BLACK_GAM_SPEED_MS: readonly number[] = blackGamData.speed_m_s;
const BLACK_GAM_ENERGY_J_KG_M: readonly number[] = blackGamData.energy_j_kg_m;

const SPEED_MIN_MS = BLACK_GAM_SPEED_MS[0];
const SPEED_MAX_MS = BLACK_GAM_SPEED_MS[BLACK_GAM_SPEED_MS.length - 1];
const SPEED_STEP_MS = BLACK_GAM_SPEED_MS[1] - BLACK_GAM_SPEED_MS[0];
const SPEED_STEPS = BLACK_GAM_SPEED_MS.length - 1;

// [loIndex, hiIndex, t] into the regular Black-GAM grid, with t allowed
// outside [0, 1] to linearly extrapolate beyond the table's 0-10 m/s range
// (comfortably covers every recreational-to-elite running pace already;
// extrapolation is a graceful fallback for the rare case someone doesn't).
function bracket(speedMS: number): [number, number, number] {
  const scaled = (speedMS - SPEED_MIN_MS) / SPEED_STEP_MS;
  if (scaled <= 0) return [0, 1, scaled];
  if (scaled >= SPEED_STEPS) return [SPEED_STEPS - 1, SPEED_STEPS, scaled - (SPEED_STEPS - 1)];
  const lo = Math.floor(scaled);
  return [lo, lo + 1, scaled - lo];
}

/** Flat-ground running cost at `speedMS`, in J/kg per meter. */
export function flatCostJPerKgM(speedMS: number): number {
  const [lo, hi, t] = bracket(speedMS);
  const y0 = BLACK_GAM_ENERGY_J_KG_M[lo];
  const y1 = BLACK_GAM_ENERGY_J_KG_M[hi];
  return y0 + (y1 - y0) * t;
}

/** Flat-ground metabolic power at `speedMS`, in J/kg per second (= W/kg). */
export function flatPowerWPerKg(speedMS: number): number {
  return flatCostJPerKgM(speedMS) * speedMS;
}

/** Inverse of flatPowerWPerKg: the flat-ground speed that produces a given metabolic power. */
export function equivalentFlatSpeedMS(targetPowerWPerKg: number): number | null {
  return solveSpeedForCost(flatPowerWPerKg, targetPowerWPerKg, 0, SPEED_MAX_MS + 2);
}

/**
 * Minetti et al. 2002's quintic polynomial: the *added* energy cost of
 * running at a grade, above level-ground intensity, in J/kg per meter.
 * `grade` is a decimal gradient (0.10 for a 10% grade; negative downhill).
 */
export function gradeAddedCostJPerKgM(grade: number): number {
  return 155.4 * grade ** 5 - 30.4 * grade ** 4 - 43.3 * grade ** 3 + 46.3 * grade ** 2 + 19.5 * grade;
}

/** Total running cost at `speedMS` on a `grade` slope, in J/kg per meter. */
export function totalCostJPerKgM(speedMS: number, grade: number): number {
  return flatCostJPerKgM(speedMS) + gradeAddedCostJPerKgM(grade);
}

/**
 * "Pace" mode: given the actual speed run ON the grade, the flat-ground
 * effort that speed was worth (same total metabolic power).
 */
export function equivalentFlatSpeedForGradeMS(actualSpeedMS: number, grade: number): number | null {
  const totalPowerWPerKg = totalCostJPerKgM(actualSpeedMS, grade) * actualSpeedMS;
  return equivalentFlatSpeedMS(totalPowerWPerKg);
}

/**
 * "Effort" mode: given a flat-ground goal effort speed, the speed to
 * target ON the grade for the same metabolic power.
 */
export function equivalentGradeSpeedMS(targetFlatSpeedMS: number, grade: number): number | null {
  const targetPowerWPerKg = flatPowerWPerKg(targetFlatSpeedMS);
  return solveSpeedForCost((v) => totalCostJPerKgM(v, grade) * v, targetPowerWPerKg, 0, SPEED_MAX_MS + 2);
}

export type VerticalDirection = "uphill" | "downhill";

/**
 * "Pace" mode, targeting a vertical speed instead of a fixed grade: given
 * the actual along-slope speed and a target vertical speed (m/s of
 * climbing or descending), derives the implied grade by simple
 * trigonometry (the along-slope speed decomposes into horizontal and
 * vertical components), then runs the standard pace-mode solve at that
 * grade.
 */
export function equivalentFlatSpeedForVerticalSpeedMS(
  actualSlopeSpeedMS: number,
  verticalSpeedMS: number,
  direction: VerticalDirection,
): { flatSpeedMS: number | null; grade: number } {
  const horizontalSpeedMS = Math.sqrt(Math.max(0, actualSlopeSpeedMS ** 2 - verticalSpeedMS ** 2));
  if (horizontalSpeedMS <= 0) {
    return { flatSpeedMS: null, grade: direction === "uphill" ? Infinity : -Infinity };
  }
  const magnitude = verticalSpeedMS / horizontalSpeedMS;
  const grade = direction === "uphill" ? magnitude : -magnitude;
  return { flatSpeedMS: equivalentFlatSpeedForGradeMS(actualSlopeSpeedMS, grade), grade };
}

const VERT_SEARCH_MIN_GRADE = 0.005;
const VERT_SEARCH_MAX_GRADE = 0.6;
const VERT_SEARCH_COARSE_STEPS = 120;
const VERT_SEARCH_FINE_STEPS = 100;
const VERT_SEARCH_TOLERANCE_FRACTION = 0.05;

/**
 * "Effort" mode, targeting a vertical speed: given a flat-ground goal
 * effort and a target vertical speed, finds the along-slope speed AND
 * grade that together produce that vertical speed at that effort.
 *
 * Unlike a fixed grade, metabolic cost isn't monotonic in grade when
 * vertical speed is held constant: too shallow a grade demands excessive
 * horizontal speed to hit the target climb rate, too steep runs straight
 * up Minetti's polynomial, so there's a genuine cost-minimizing grade
 * in between and no closed-form solve. This scans a coarse grid of
 * candidate grades, then refines around the best match -- the same
 * approach gap-app uses, just with a second, finer pass around the coarse
 * winner instead of a single fixed 0.5%-grade resolution.
 */
export function solveForVerticalSpeed(
  targetFlatSpeedMS: number,
  verticalSpeedMS: number,
  direction: VerticalDirection,
): { speedMS: number; grade: number } | null {
  const targetPowerWPerKg = flatPowerWPerKg(targetFlatSpeedMS);
  const sign = direction === "uphill" ? 1 : -1;

  function costAtGradeMagnitude(magnitude: number): number {
    const horizontalSpeedMS = verticalSpeedMS / magnitude;
    const actualSpeedMS = Math.sqrt(horizontalSpeedMS ** 2 + verticalSpeedMS ** 2);
    return totalCostJPerKgM(actualSpeedMS, sign * magnitude) * actualSpeedMS;
  }

  function bestMagnitudeInRange(lo: number, hi: number, steps: number): { magnitude: number; diff: number } {
    let bestMagnitude = lo;
    let bestDiff = Infinity;
    for (let i = 0; i <= steps; i++) {
      const magnitude = lo + ((hi - lo) * i) / steps;
      const diff = Math.abs(costAtGradeMagnitude(magnitude) - targetPowerWPerKg);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestMagnitude = magnitude;
      }
    }
    return { magnitude: bestMagnitude, diff: bestDiff };
  }

  const coarse = bestMagnitudeInRange(VERT_SEARCH_MIN_GRADE, VERT_SEARCH_MAX_GRADE, VERT_SEARCH_COARSE_STEPS);
  const coarseStep = (VERT_SEARCH_MAX_GRADE - VERT_SEARCH_MIN_GRADE) / VERT_SEARCH_COARSE_STEPS;
  const fine = bestMagnitudeInRange(
    Math.max(VERT_SEARCH_MIN_GRADE, coarse.magnitude - coarseStep),
    coarse.magnitude + coarseStep,
    VERT_SEARCH_FINE_STEPS,
  );

  if (fine.diff / targetPowerWPerKg > VERT_SEARCH_TOLERANCE_FRACTION) return null;

  const grade = sign * fine.magnitude;
  const horizontalSpeedMS = verticalSpeedMS / fine.magnitude;
  const speedMS = Math.sqrt(horizontalSpeedMS ** 2 + verticalSpeedMS ** 2);
  return { speedMS, grade };
}

export const STEEP_DOWNHILL_GRADE_THRESHOLD = -0.08;
export const WALK_VS_RUN_GRADE_THRESHOLD = 0.25;

/**
 * Below -8% grade, downhill running may not capture the full energetic
 * benefit Minetti's polynomial predicts (a real limitation the source tool
 * flags too); above +25%, walking may be more economical than running.
 * Both are informational nudges, not hard limits on what the calculator
 * will compute.
 */
export function gradeAlert(grade: number): "steep-downhill" | "steep-uphill" | null {
  if (grade < STEEP_DOWNHILL_GRADE_THRESHOLD) return "steep-downhill";
  if (grade > WALK_VS_RUN_GRADE_THRESHOLD) return "steep-uphill";
  return null;
}

export function gradePercentToDecimal(percent: number): number {
  return percent / 100;
}

export function decimalToGradePercent(grade: number): number {
  return grade * 100;
}

export function gradeDegreesToDecimal(degrees: number): number {
  return Math.tan((degrees * Math.PI) / 180);
}

export function decimalToGradeDegrees(grade: number): number {
  return (Math.atan(grade) * 180) / Math.PI;
}
