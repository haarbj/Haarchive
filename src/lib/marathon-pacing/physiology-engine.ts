// Tracks four independent, mile-by-mile fatigue states over a race, so the
// split generator (a later milestone) can constrain pacing by what's
// physiologically sustainable rather than a preset percentage table -- the
// core ambition of this whole feature versus FindMyMarathon's approach.
//
// Each state is its own small, literature-grounded model, explicit about
// which parts are an established model versus a documented heuristic:
//
//   1. W'-balance ("durability reserve") -- Skiba et al.'s W'bal-mod model
//      (Skiba, Chidnok, Vanhatalo & Jones 2012; 2014 update), adapted from
//      critical POWER to critical SPEED (the natural running-world unit --
//      the underlying math is identical, since both are "distance/work
//      capacity above a sustainable threshold"). This is a real, published,
//      widely-validated model, not a heuristic.
//   2. Glycogen depletion -- energy expenditure (from grade-pace-physics.ts,
//      so hills genuinely burn more) split into carb/fat fractions via a
//      smooth curve consistent with the well-established substrate-
//      utilization "crossover concept" (Brooks & Mercier 1994) -- the curve
//      itself is a reasonable approximation, not a fit to a specific
//      dataset, and is documented as such.
//   3. Cardiac drift -- a simple, explicitly heuristic duration+heat curve
//      capturing the well-documented *direction* and rough *scale* of
//      cardiovascular drift (Coyle et al.), not a validated dose-response
//      model.
//   4. Cumulative eccentric (downhill) damage -- reuses the same -8% grade
//      threshold course-analysis.ts's downhillSeverityScore already
//      applies. Deliberately left as a standalone, informational number
//      rather than silently discounting the other three states by an
//      unvalidated coefficient -- the muscle-damage-from-downhill-running
//      literature (Millet et al.) is clear on direction, not on how much it
//      should discount capacity mile-by-mile, and fabricating that number
//      would corrupt the other, better-grounded states with false precision.
//
// The `durability` tier deliberately touches THREE of these four states, not
// just W'-balance -- it originally only sized the W'-balance reserve, which
// only ever depletes when running above critical speed. Most marathon goal
// efforts never go above critical speed at all (that's roughly what "goal
// pace is sustainable" means), so for the common case durability changed
// nothing a runner could actually see. Trained/durable runners genuinely do
// carry more utilizable glycogen (denser muscle glycogen storage from
// training adaptation) and show measurably less cardiovascular drift at a
// given relative intensity (Coyle et al.) than untrained runners -- both
// well-documented directions, if not precisely fit dose-response curves --
// so durability now also scales glycogen store size and drift rate, which
// actually show up in every race, not just ones with above-CS surges.

import { STEEP_DOWNHILL_GRADE_THRESHOLD, totalCostJPerKgM } from "@/lib/grade-pace-physics";

export type Durability = "excellent" | "average" | "poor";

export type PhysiologyProfile = {
  /** Critical speed, m/s -- e.g. cv-threshold-math.ts's cvSpeedMS. The sustainable-vs-unsustainable line the W'-balance model is built on. */
  criticalSpeedMS: number;
  /** vVO2max speed, m/s -- e.g. cv-threshold-math.ts's vo2maxSpeedMS. Used only as the substrate-curve's relative-intensity reference. */
  vo2maxSpeedMS: number;
  weightKg?: number;
  /** Sets the W'-balance reserve size (D'), glycogen store size, and cardiac drift rate. Informed by training volume/longest run when available; "average" if unknown. */
  durability?: Durability;
  /** Overrides the default trained-runner glycogen store size (g of glycogen per kg bodyweight). */
  glycogenStoreGramsPerKg?: number;
};

export type FatigueState = {
  elapsedSeconds: number;
  distanceM: number;
  /** Meters of durability reserve remaining -- depletes above critical speed, recovers below it. */
  wPrimeBalanceM: number;
  wPrimeBalanceFraction: number;
  glycogenRemainingGrams: number;
  /** 1.0 = full stores; nearing 0 is "the wall." */
  glycogenRemainingFraction: number;
  /** Fractional HR elevation versus the very first mile at the same pace (0.05 = ~5% higher). */
  cardiacDriftFraction: number;
  /** Cumulative steep-descent exposure, in grade-meters -- informational only, see module doc. */
  cumulativeEccentricDamageScore: number;
};

export type MileFatigueInput = {
  grade: number;
  speedMS: number;
  distanceM: number;
  /** Ambient temperature during this mile, if known -- drives cardiac drift's heat multiplier. */
  tempC?: number;
  /** Carbohydrate intake during this mile, g/hr -- offsets glycogen depletion. Defaults to 0 (no fueling). */
  carbIntakeGramsPerHour?: number;
};

const DEFAULT_WEIGHT_KG = 70;

// Reasoned defaults, not individually measured values -- a real D' requires
// a two-effort critical-speed test this calculator doesn't ask the runner
// to perform. These sit within the commonly reported range for the
// critical-speed model's D' (roughly 150-400m for trained distance
// runners), scaled by the "durability" tier training inputs already
// inform (see runner-profile.ts's design sketch).
const DURABILITY_D_PRIME_METERS: Record<Durability, number> = {
  poor: 150,
  average: 225,
  excellent: 350,
};

// Skiba et al. 2012's recovery time-constant formula, in its original power
// form: tau = 546 * exp(-0.01 * DCP) + 316 (seconds), where DCP is the power
// deficit below critical power, in Watts. Adapted here by converting the
// speed deficit to a power deficit via the same flat-cost curve used
// throughout this codebase, rather than guessing at a speed-native constant.
const TAU_COEFFICIENT = 546;
const TAU_DECAY_PER_WATT = -0.01;
const TAU_OFFSET_SECONDS = 316;

const CARB_J_PER_GRAM = 16700; // ~4 kcal/g

// Literature range for trained-runner glycogen storage is roughly 6-10 g/kg
// bodyweight -- durability spans that range directly rather than applying a
// single default and scaling it separately, since it's the same underlying
// training-adaptation story the D' tiers above are already telling.
const DURABILITY_GLYCOGEN_G_PER_KG: Record<Durability, number> = {
  poor: 6.5,
  average: 8,
  excellent: 10,
};

const DRIFT_RATE_PER_HOUR = 0.03; // documented heuristic: ~3%/hr HR elevation at constant pace in neutral conditions, "average" durability
// Trained endurance athletes show measurably less cardiovascular drift at a
// given relative intensity than untrained ones (Coyle et al.) -- a
// documented heuristic multiplier on the base drift rate, not a fit curve.
const DURABILITY_DRIFT_MULTIPLIER: Record<Durability, number> = {
  poor: 1.25,
  average: 1,
  excellent: 0.75,
};
const DRIFT_REFERENCE_TEMP_C = 15;
const HEAT_DRIFT_MULTIPLIER_PER_DEGREE_C = 0.04; // each degree above the reference compounds drift ~4%
const MAX_DRIFT_FRACTION = 0.2;

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function dPrimeMetersFor(profile: PhysiologyProfile): number {
  return DURABILITY_D_PRIME_METERS[profile.durability ?? "average"];
}

function glycogenStoreGramsFor(profile: PhysiologyProfile, weightKg: number): number {
  const gPerKg = profile.glycogenStoreGramsPerKg ?? DURABILITY_GLYCOGEN_G_PER_KG[profile.durability ?? "average"];
  return gPerKg * weightKg;
}

export function initialFatigueState(profile: PhysiologyProfile): FatigueState {
  const weightKg = profile.weightKg ?? DEFAULT_WEIGHT_KG;
  return {
    elapsedSeconds: 0,
    distanceM: 0,
    wPrimeBalanceM: dPrimeMetersFor(profile),
    wPrimeBalanceFraction: 1,
    glycogenRemainingGrams: glycogenStoreGramsFor(profile, weightKg),
    glycogenRemainingFraction: 1,
    cardiacDriftFraction: 0,
    cumulativeEccentricDamageScore: 0,
  };
}

/** Flat-ground metabolic power, W/kg, via the runner's own critical speed -- reused as this step's power reference for the recovery time constant. */
function flatPowerWPerKgFromSpeed(speedMS: number): number {
  return totalCostJPerKgM(speedMS, 0) * speedMS;
}

function stepWPrimeBalance(
  currentBalanceM: number,
  dPrimeM: number,
  criticalSpeedMS: number,
  speedMS: number,
  durationSeconds: number,
  weightKg: number,
): number {
  if (speedMS > criticalSpeedMS) {
    const depletedM = (speedMS - criticalSpeedMS) * durationSeconds;
    return Math.max(0, currentBalanceM - depletedM);
  }

  const deficitWatts = (flatPowerWPerKgFromSpeed(criticalSpeedMS) - flatPowerWPerKgFromSpeed(speedMS)) * weightKg;
  const tauSeconds = TAU_COEFFICIENT * Math.exp(TAU_DECAY_PER_WATT * deficitWatts) + TAU_OFFSET_SECONDS;
  return dPrimeM - (dPrimeM - currentBalanceM) * Math.exp(-durationSeconds / tauSeconds);
}

function carbFractionOfEnergy(effortFraction: number): number {
  return clamp(0.35 + 0.65 * effortFraction ** 2, 0.2, 0.95);
}

function eccentricLoadForMile(grade: number, distanceM: number): number {
  if (grade >= STEEP_DOWNHILL_GRADE_THRESHOLD) return 0;
  return (STEEP_DOWNHILL_GRADE_THRESHOLD - grade) * distanceM;
}

export function stepFatigueState(state: FatigueState, profile: PhysiologyProfile, mile: MileFatigueInput): FatigueState {
  const weightKg = profile.weightKg ?? DEFAULT_WEIGHT_KG;
  const dPrimeM = dPrimeMetersFor(profile);
  const glycogenStoreG = glycogenStoreGramsFor(profile, weightKg);
  const durationSeconds = mile.distanceM / mile.speedMS;
  const elapsedSeconds = state.elapsedSeconds + durationSeconds;

  const wPrimeBalanceM = stepWPrimeBalance(
    state.wPrimeBalanceM,
    dPrimeM,
    profile.criticalSpeedMS,
    mile.speedMS,
    durationSeconds,
    weightKg,
  );

  const totalPowerWattsIncludingGrade = totalCostJPerKgM(mile.speedMS, mile.grade) * mile.speedMS * weightKg;
  const effortFraction = clamp(mile.speedMS / profile.vo2maxSpeedMS, 0, 1.2);
  const carbEnergyWatts = totalPowerWattsIncludingGrade * carbFractionOfEnergy(effortFraction);
  const carbBurnedGrams = (carbEnergyWatts * durationSeconds) / CARB_J_PER_GRAM;
  const carbIntakeGrams = ((mile.carbIntakeGramsPerHour ?? 0) / 3600) * durationSeconds;
  const glycogenRemainingGrams = Math.max(0, state.glycogenRemainingGrams - carbBurnedGrams + carbIntakeGrams);

  const heatMultiplier =
    mile.tempC !== undefined ? 1 + Math.max(0, mile.tempC - DRIFT_REFERENCE_TEMP_C) * HEAT_DRIFT_MULTIPLIER_PER_DEGREE_C : 1;
  const durabilityDriftMultiplier = DURABILITY_DRIFT_MULTIPLIER[profile.durability ?? "average"];
  const cardiacDriftFraction = Math.min(
    MAX_DRIFT_FRACTION,
    DRIFT_RATE_PER_HOUR * durabilityDriftMultiplier * (elapsedSeconds / 3600) * heatMultiplier,
  );

  const cumulativeEccentricDamageScore = state.cumulativeEccentricDamageScore + eccentricLoadForMile(mile.grade, mile.distanceM);

  return {
    elapsedSeconds,
    distanceM: state.distanceM + mile.distanceM,
    wPrimeBalanceM,
    wPrimeBalanceFraction: dPrimeM > 0 ? wPrimeBalanceM / dPrimeM : 1,
    glycogenRemainingGrams,
    glycogenRemainingFraction: glycogenStoreG > 0 ? glycogenRemainingGrams / glycogenStoreG : 0,
    cardiacDriftFraction,
    cumulativeEccentricDamageScore,
  };
}
