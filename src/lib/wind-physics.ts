// Metabolic-cost model for headwinds/tailwinds/crosswinds, ported from the
// physics in johnjdavisiv/wind-calculator (MIT license) and rebuilt as
// small, pure, typed functions instead of the original's global-mutable-
// state + DOM-lookup implementation.
//
// The chain of reasoning, in order:
//   1. Running at a given speed on a calm-air treadmill has a known
//      metabolic cost (Black et al. 2018, an empirical polynomial).
//   2. Moving through air at all -- even on a still day -- creates drag
//      proportional to the runner's frontal area and the square of their
//      speed (the standard drag equation).
//   3. A real wind adds to (or subtracts from) that relative airflow
//      depending on its speed and angle, which changes the drag force.
//   4. Da Silva et al. 2022 gives an empirical conversion from "drag force
//      as a percentage of body weight" to "percentage change in metabolic
//      cost" -- this is what actually turns wind into a pace effect.
//   5. Wind measured by a weather station (10m up) is stronger than what a
//      runner's chest actually encounters -- the wind profile power law
//      (a standard meteorology formula) corrects for that, based on how
//      sheltered the terrain is.
//
// Frontal area is estimated from body weight alone (Livingston & Lee 2001
// for body surface area, Pugh 1970 for the fraction of it that's forward-
// facing) -- no height input needed, and the original's own writeup notes
// height/weight effects on wind sensitivity are small and mostly cancel out.

// Exported: track-wind-physics.ts reuses these directly rather than
// re-declaring the same physical constants a second time.
export const GRAVITY_M_S2 = 9.80665; // ISA standard gravity
export const AIR_DENSITY_KG_M3 = 1.225; // ISA air density, 15°C, sea level
export const DRAG_COEFFICIENT = 0.8; // typical experimental value for a running human
export const DA_SILVA_SLOPE = 6.13; // Da Silva et al. 2022: drag-force-to-metabolic-cost slope

const FRONTAL_AREA_RATIO = 0.266; // Pugh 1970: fraction of body surface area facing forward
const WIND_REFERENCE_HEIGHT_M = 10; // standard weather-station measurement height
const CHEST_HEIGHT_M = 1.5; // approximate height a runner's torso encounters wind at

// Black et al. 2018's reference dataset was elite runners; the offset below
// is a small, ~constant reduction (roughly 1-3 sec/mile) baked into that
// baseline. It doesn't meaningfully change how wind *changes* your pace --
// only the absolute cost number -- so it's kept fixed rather than exposed
// as a setting, matching the original calculator's own default.
const ELITE_OFFSET_W_PER_KG = 1.13918;

export type WindProfile = "urban" | "suburban" | "rural" | "none";

// Exponents from the wind profile power law -- higher means more terrain
// sheltering between the 10m reference height and chest height.
export const WIND_PROFILE_ALPHA: Record<WindProfile, number> = {
  urban: 0.4,
  suburban: 0.3,
  rural: 0.16,
  none: 0,
};

export const WIND_PROFILE_LABEL: Record<WindProfile, string> = {
  urban: "City / dense forest",
  suburban: "Suburbs",
  rural: "Rural / open",
  none: "Ground-level reading",
};

/** Body surface area in m², from weight alone. Valid roughly 10-250 kg. */
export function bodySurfaceAreaM2(weightKg: number): number {
  return 0.1173 * weightKg ** 0.6466;
}

/** Projected frontal area in m², the part of the body that faces the wind. */
export function frontalAreaM2(weightKg: number): number {
  return FRONTAL_AREA_RATIO * bodySurfaceAreaM2(weightKg);
}

/** Metabolic cost of running at a given speed in still air, in W/kg. */
export function treadmillCostWPerKg(speedMS: number): number {
  return 8.09986 + 0.129_1 * speedMS + 0.481_05 * speedMS ** 2 - ELITE_OFFSET_W_PER_KG;
}

/**
 * Wind speed at chest height, adjusted down from a reference (weather
 * station / forecast) reading using the wind profile power law, given a
 * raw exponent directly -- the shared core formula, exported so
 * wind-exposure.ts's continuous road/route model can feed in an
 * interpolated alpha instead of picking from the fixed WindProfile enum.
 */
export function windAtChestHeightMSFromAlpha(referenceWindMS: number, alpha: number): number {
  return referenceWindMS * (CHEST_HEIGHT_M / WIND_REFERENCE_HEIGHT_M) ** alpha;
}

/**
 * Wind speed at chest height, adjusted down from a reference (weather
 * station / forecast) reading using the wind profile power law. More
 * sheltered terrain (a higher alpha) means more of the reference wind gets
 * blocked before it reaches the runner.
 */
export function windAtChestHeightMS(referenceWindMS: number, profile: WindProfile): number {
  return windAtChestHeightMSFromAlpha(referenceWindMS, WIND_PROFILE_ALPHA[profile]);
}

/**
 * Splits a wind speed into forward/lateral components given its angle
 * relative to the runner. Convention: 0° = direct headwind, 180° =
 * direct tailwind, 90°/270° = pure crosswind (matches a compass dial
 * where "north" at the top means "wind blowing at the runner").
 */
export function windForwardLateral(windSpeedMS: number, angleDeg: number): { forward: number; lateral: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { forward: windSpeedMS * Math.cos(rad), lateral: windSpeedMS * Math.sin(rad) };
}

export function classifyWindAngle(angleDeg: number): "headwind" | "tailwind" | "crosswind" {
  const normalized = ((angleDeg % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return "headwind";
  if (normalized >= 157.5 && normalized < 202.5) return "tailwind";
  return "crosswind";
}

/**
 * Converts a true (meteorological) wind reading into this module's
 * relative-angle convention (0deg = headwind), given the true compass
 * direction the runner is heading toward. Weather data reports wind as the
 * direction it's blowing FROM; a runner heading due north straight into a
 * wind that's also blowing from the north is running directly into it --
 * a headwind -- which is why this is a subtraction, not a sum.
 */
export function relativeAngleFromTrueBearing(windFromBearingDeg: number, headingToBearingDeg: number): number {
  return ((windFromBearingDeg - headingToBearingDeg) % 360 + 360) % 360;
}

// Drag force in Newtons -- the standard drag equation. Only ever called
// with a non-negative relative speed magnitude; direction/sign is handled
// separately by whichever caller derives the forward component (a
// relative angle here, a heading dot-product in track-wind-physics.ts).
export function dragForceN(relativeSpeedMS: number, area: number): number {
  return 0.5 * AIR_DENSITY_KG_M3 * relativeSpeedMS ** 2 * DRAG_COEFFICIENT * area;
}

/**
 * Da Silva et al. 2022's conversion from a forward-facing drag force
 * (Newtons, signed -- positive opposes the runner) into a % change in
 * metabolic cost (as a decimal, e.g. 0.03 for +3%).
 */
export function metabolicCostPctFromForwardDragN(forwardDragN: number, weightKg: number): number {
  const bodyWeightN = weightKg * GRAVITY_M_S2;
  return (forwardDragN / bodyWeightN) * DA_SILVA_SLOPE;
}

function vectorMagnitude(x: number, y: number): number {
  return Math.sqrt(x ** 2 + y ** 2);
}

// atan(forward / |lateral|) preserves the sign of the forward component
// (which is what tells us whether relative airflow is net-headwind or
// net-tailwind) while folding the lateral component down to its
// magnitude. At zero lateral wind this correctly resolves to ±90°
// (JS's native x/0 → ±Infinity handling), a pure head-on or tail-on case.
function relativeWindAngleDeg(lateral: number, forwardTotal: number): number {
  return (Math.atan(forwardTotal / Math.abs(lateral)) * 180) / Math.PI;
}

/**
 * The % change in metabolic cost (as a decimal, e.g. 0.03 for +3%) from
 * moving through relative airflow of the given magnitude and angle. Only
 * the forward component of the resulting drag force is costed -- the
 * lateral component is deliberately left out, matching the original
 * calculator: there's no published research on the metabolic cost of
 * resisting a purely lateral force in running, so it's left as a known,
 * documented gap rather than guessed at.
 */
function metabolicCostPctChange(relativeSpeedMagnitudeMS: number, relativeAngleDeg: number, weightKg: number): number {
  const relativeAngleRad = (relativeAngleDeg * Math.PI) / 180;
  const totalDrag = dragForceN(relativeSpeedMagnitudeMS, frontalAreaM2(weightKg));
  const forwardDrag = totalDrag * Math.sin(relativeAngleRad);
  return metabolicCostPctFromForwardDragN(forwardDrag, weightKg);
}

/**
 * Total metabolic cost (W/kg) of running at `speedMS` overground, given a
 * true wind with the supplied forward/lateral components (in m/s, already
 * adjusted to chest height). Passing 0/0 for the wind components gives
 * the calm-air cost -- a runner moving through still air still generates
 * their own head-on relative airflow equal to their own speed, which this
 * function models automatically rather than needing a separate "calm air"
 * code path.
 */
export function metabolicCostInWindWPerKg(
  speedMS: number,
  windForwardMS: number,
  windLateralMS: number,
  weightKg: number,
): number {
  const forwardTotal = windForwardMS + speedMS;
  const magnitude = vectorMagnitude(windLateralMS, forwardTotal);
  const treadmillCost = treadmillCostWPerKg(speedMS);
  // Zero relative airflow (a stationary runner with no wind at all) means
  // zero drag regardless of angle -- avoid computing an undefined 0/0
  // angle for a force that's zero either way.
  const pct = magnitude === 0 ? 0 : metabolicCostPctChange(magnitude, relativeWindAngleDeg(windLateralMS, forwardTotal), weightKg);
  return treadmillCost * (1 + pct);
}

const SOLVE_MIN_MS = 0;
const SOLVE_MAX_MS = 12; // ~26.8 mph -- comfortably above any distance-running pace
const SOLVE_TOLERANCE_MS = 0.0005;
const SOLVE_MAX_ITERATIONS = 60;

/**
 * Finds the speed (m/s) at which `costFn` produces `targetCost`, assuming
 * costFn is monotonically increasing over [lo, hi] -- true in practice for
 * every real distance-running pace and wind condition this calculator is
 * meant to cover. Returns null if the target falls outside the range
 * costFn actually produces across the bracket, rather than extrapolating
 * to a meaningless answer.
 */
export function solveSpeedForCost(
  costFn: (speedMS: number) => number,
  targetCost: number,
  lo: number = SOLVE_MIN_MS,
  hi: number = SOLVE_MAX_MS,
): number | null {
  const costLo = costFn(lo);
  const costHi = costFn(hi);
  if (targetCost < Math.min(costLo, costHi) || targetCost > Math.max(costLo, costHi)) {
    return null;
  }

  let low = lo;
  let high = hi;
  for (let i = 0; i < SOLVE_MAX_ITERATIONS && high - low > SOLVE_TOLERANCE_MS; i++) {
    const mid = (low + high) / 2;
    const cost = costFn(mid);
    if (cost < targetCost) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

/**
 * Pace mode: "I actually ran this pace in this wind -- what calm-air pace
 * was that the same effort as?"
 */
export function paceModeEquivalentSpeedMS(
  actualSpeedMS: number,
  windForwardMS: number,
  windLateralMS: number,
  weightKg: number,
): number | null {
  if (actualSpeedMS <= 0) return 0;
  const actualCost = metabolicCostInWindWPerKg(actualSpeedMS, windForwardMS, windLateralMS, weightKg);
  return solveSpeedForCost((v) => metabolicCostInWindWPerKg(v, 0, 0, weightKg), actualCost);
}

/**
 * Effort mode: "I want to run this calm-air effort -- what pace should I
 * actually target in this wind?"
 */
export function effortModeEquivalentSpeedMS(
  targetCalmSpeedMS: number,
  windForwardMS: number,
  windLateralMS: number,
  weightKg: number,
): number | null {
  if (targetCalmSpeedMS <= 0) return 0;
  const targetCost = metabolicCostInWindWPerKg(targetCalmSpeedMS, 0, 0, weightKg);
  return solveSpeedForCost((v) => metabolicCostInWindWPerKg(v, windForwardMS, windLateralMS, weightKg), targetCost);
}
