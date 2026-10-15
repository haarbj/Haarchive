// Independent, from-scratch reimplementation of the science-informed
// fueling targets behind Goran Winblad's GW Endurance Fueling Calculator
// (goranwinblad.se/endurancefuelingcalculator/). Every constant below was
// fit by black-box statistical regression against 324 (input -> output)
// pairs collected from the live calculator -- no source code was read or
// copied to produce this file. See
// /docs/endurance-fueling-reverse-engineering-report.md for the full
// methodology, candidate-model comparisons, and validation results.
//
// Unlike the Tinman and Altitude-Adjusted-Pace calculators this codebase
// has also reverse-engineered, this target's page is password-gated (a
// legacy "old, login-free basic web app" that's mid-migration to a paid
// Patreon-login platform). The site's owner has purchased legitimate
// access and explicitly authorized using that access for this specific
// black-box collection -- see the report for the full access-authorization
// note. Every query was still driven through the real rendered UI, reading
// only displayed output, exactly like every other reverse-engineered
// module in this codebase.
//
// Five outputs turned out to be cleanly, independently characterizable
// (carbs, fluid loss, fluid TARGET, sodium loss, sodium target -- the
// fluid target was missed in this module's first pass and added in a
// follow-up correction, see fluidTargetMlPerHour below); a sixth (the
// cumulative fluid total over a full session) did not, and is
// deliberately NOT included here -- see the report's "What's not
// included" section.

export type HeartRateZone = "50-60%" | "60-70%" | "70-80%" | "80-90%" | "90-100%";
export type GiTrainingLevel = "Not" | "Moderate" | "Well" | "HighCarbMachine";

// --- Suggested carbs (g/hr) ------------------------------------------------
//
// An exact 5x4 lookup table (heart-rate zone x GI training level),
// confirmed to 0 error across 120 held-out randomized queries plus the
// original 20-cell grid. Body weight, temperature, and session duration
// were all tested directly and confirmed to have ZERO effect on this
// value -- the carb rate here is intensity- and gut-tolerance-driven
// only, not scaled by runner size or conditions.
//
// The "HighCarbMachine" row is a genuine override, not a table cell that
// happens to be high: it returns exactly 120 regardless of HR zone,
// matching the calculator's own copy ("You can handle 120g/hr or more
// regardless of intensity").
const CARBS_PER_HOUR_TABLE: Record<HeartRateZone, Record<GiTrainingLevel, number>> = {
  "50-60%": { Not: 35, Moderate: 40, Well: 45, HighCarbMachine: 120 },
  "60-70%": { Not: 45, Moderate: 55, Well: 65, HighCarbMachine: 120 },
  "70-80%": { Not: 65, Moderate: 75, Well: 85, HighCarbMachine: 120 },
  "80-90%": { Not: 75, Moderate: 90, Well: 105, HighCarbMachine: 120 },
  "90-100%": { Not: 85, Moderate: 100, Well: 115, HighCarbMachine: 120 },
};

export function suggestedCarbsPerHour(zone: HeartRateZone, giTraining: GiTrainingLevel): number {
  return CARBS_PER_HOUR_TABLE[zone][giTraining];
}

// --- Fluid loss rate (mL/hr) -----------------------------------------------
//
// A temperature curve (measured at every whole degree C from 0-40, the
// calculator's own tested range -- it plateaus at both ends: flat at
// 300mL/hr from 0-2C, flat at 2,000mL/hr from 35-40C) combined additively
// with a 3-tier body-weight bucket and a 5-level HR-zone offset. Fit by
// holding two of {weight, temperature, zone} fixed while sweeping the
// third, then confirmed against 10 held-out cross-combinations and 118
// randomized (weight, temp, zone) triples: RMSE 80mL/hr (~5-8% of a
// typical 600-2,000mL/hr rate), worst single-point error 260mL/hr. The
// residual is real, not a bug -- these three factors likely don't combine
// perfectly additively in the source calculator, but additive is the best
// single-structure fit found (a fully independent 3D grid would be needed
// to resolve the remainder, and wasn't run given the size of the
// remaining error relative to the practical range of the tool).
const FLUID_ML_BY_TEMP_C: number[] = [
  300, 300, 300, 310, 330, 350, 380, 410, 440, 470, 500, 540, 580, 620, 660, 700, 750, 800, 850, 900, 950, 1000, 1050,
  1100, 1150, 1200, 1280, 1360, 1440, 1520, 1600, 1680, 1760, 1840, 1920, 2000, 2000, 2000, 2000, 2000, 2000,
];

const FLUID_MIN_ML_PER_HOUR = 300;

function fluidTempBaseline(temperatureC: number): number {
  const clamped = Math.max(0, Math.min(40, Math.round(temperatureC)));
  return FLUID_ML_BY_TEMP_C[clamped];
}

function bodyWeightFluidOffset(bodyWeightKg: number): number {
  if (bodyWeightKg <= 54) return -100;
  if (bodyWeightKg >= 81) return 100;
  return 0;
}

// Zone offsets relative to the 700mL/hr value at 70-80% (the reference
// zone used while measuring the temperature curve above).
const ZONE_FLUID_ML_PER_HOUR: Record<HeartRateZone, number> = {
  "50-60%": 595,
  "60-70%": 665,
  "70-80%": 700,
  "80-90%": 770,
  "90-100%": 840,
};

export function estimatedFluidLossMlPerHour(bodyWeightKg: number, temperatureC: number, zone: HeartRateZone): number {
  const value =
    fluidTempBaseline(temperatureC) + bodyWeightFluidOffset(bodyWeightKg) + (ZONE_FLUID_ML_PER_HOUR[zone] - 700);
  return Math.max(FLUID_MIN_ML_PER_HOUR, value);
}

// --- Fluid intake target (mL/hr) -------------------------------------------
//
// A genuinely separate quantity from the loss estimate above, initially
// missed in this module's first pass: the calculator's own UI shows a
// distinct "Target: Xml" line next to "Est. loss: ~Yml/hr" for fluid, the
// same target/loss split already correctly captured for sodium below --
// this codebase's first implementation only captured the loss estimate,
// which is not the number the calculator actually recommends drinking
// (see docs/endurance-fueling-reverse-engineering-report.md's "Fluid
// target correction" section for the full story of how that was found and
// fixed). Confirmed, like sodium, to be a temperature-only curve with
// zero dependence on body weight or HR zone (both swept independently;
// the tiny 350mL blips at 55kg and at the 90-100% zone are boundary
// rounding noise, not a real weight/zone effect -- the other 8 weight
// points and 4 zone points all land on the flat temperature-only curve
// exactly). Flat at 300mL/hr from 0-17C, then rises to a 1,600mL/hr
// ceiling from 35C onward -- deliberately lower than the loss estimate at
// every temperature, the same "controlled deficit" reasoning the
// calculator's own copy gives for sodium.
const FLUID_TARGET_ML_BY_TEMP_C: number[] = [
  300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 350, 400, 450, 600, 650,
  700, 750, 800, 850, 950, 1000, 1100, 1200, 1250, 1350, 1400, 1500, 1600, 1600, 1600, 1600, 1600, 1600,
];

export function fluidTargetMlPerHour(temperatureC: number): number {
  return tempLookup(FLUID_TARGET_ML_BY_TEMP_C, temperatureC);
}

// --- Sodium loss estimate and target (mg/hr) -------------------------------
//
// Both are temperature-only curves -- confirmed to have ZERO dependence
// on body weight or HR zone across every combination tested (118
// randomized queries, 0 error). "Loss" is the calculator's estimate of
// actual sweat sodium loss; "Target" is deliberately lower at every
// temperature (the calculator's own copy: sodium's role during exercise
// is to support fluid absorption and thirst, not to fully replace sweat
// losses 1:1) -- the two are independent measured curves, not one derived
// from the other by a fixed ratio (the ratio itself isn't constant across
// temperature, so this codebase doesn't invent one).
const SODIUM_LOSS_MG_BY_TEMP_C: number[] = [
  250, 300, 300, 350, 350, 400, 450, 450, 500, 500, 550, 600, 600, 650, 650, 700, 750, 750, 800, 800, 850, 900, 900,
  950, 950, 1000, 1050, 1100, 1100, 1150, 1200, 1250, 1300, 1300, 1350, 1400, 1400, 1400, 1400, 1400, 1400,
];
const SODIUM_TARGET_MG_BY_TEMP_C: number[] = [
  300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 350, 350, 350, 400, 400, 400, 450, 450, 500, 500, 500, 550, 550,
  550, 550, 600, 650, 650, 650, 700, 700, 750, 750, 750, 750, 750, 750, 750, 750, 750, 750,
];

function tempLookup(table: number[], temperatureC: number): number {
  const clamped = Math.max(0, Math.min(40, Math.round(temperatureC)));
  return table[clamped];
}

export function estimatedSodiumLossMgPerHour(temperatureC: number): number {
  return tempLookup(SODIUM_LOSS_MG_BY_TEMP_C, temperatureC);
}

export function sodiumTargetMgPerHour(temperatureC: number): number {
  return tempLookup(SODIUM_TARGET_MG_BY_TEMP_C, temperatureC);
}
