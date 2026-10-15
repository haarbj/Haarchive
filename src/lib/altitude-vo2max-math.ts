// Altitude-performance and VO2max-conversion math for the Altitude
// Calculator. Two genuinely different questions live in this file, each
// deliberately sourced from a different model:
//
//   - "What % of sea-level aerobic capacity is available, and how does a
//     VO2 max convert between altitudes?" -- acclimatization-aware
//     (acclimatized vs. unacclimatized), from the Bassett/Peronnet
//     regressions below. Nothing in src/lib/environmental/altitude-engine.ts
//     answers this question at all (it has no acclimatization concept), so
//     there's no existing engine to share here.
//   - "What time/pace does a real run convert to at another altitude?" --
//     this now DELIBERATELY REUSES marathonImpairmentFraction and
//     altitudeDurationScale, imported directly from
//     src/lib/environmental/altitude-engine.ts, the exact same functions
//     the Environmental Performance Calculator uses (and Marathon Pacing
//     Calculator, via precise-altitude-engine.ts) -- see
//     convertTimeBetweenAltitudes below. An earlier version of this
//     function applied the Bassett/Peronnet capacity percentage flatly to
//     pace instead; that produced numbers that could diverge substantially
//     from the Environmental Performance Calculator for the same nominal
//     altitude (the two source models disagree on the sea-level
//     marathon-equivalent cost, and the flat version didn't scale down for
//     shorter, less aerobic-dominant efforts the way Daniels' tables do).
//     Sharing the engine means the two tools now agree by construction on
//     what a given altitude costs a given run, instead of merely being
//     "close." The trade-off: Daniels' tables have no acclimatization split
//     at all, so time/pace results below do NOT vary with the
//     Acclimatization toggle -- a real, named limitation, not a bug (see
//     the Altitude Calculator's own "Behind the calculator" section).
//
// Equations and coefficients below (for capacity % and VO2 max) are
// population-level regressions popularized
// by TrainingPeaks (trainingpeaks.com/blog/the-effect-of-racing-at-altitude),
// tracing to two underlying studies:
//   - Acclimatized (several weeks at altitude): Bassett, D.R. et al. (1999).
//     "Comparing cycling world hour records, 1967-1996: modeling with
//     empirical data." Medicine & Science in Sports & Exercise, 31(11),
//     1665-1676. Bassett's paper itself models track-cycling hour-record
//     power output, but Bassett's own account (an archived Wattage-forum FAQ
//     he authored) describes this specific altitude-adjustment curve as
//     adapted from earlier research on four groups of highly trained/elite
//     runners, not derived from the cycling data in his own paper -- a real
//     distinction worth preserving in citation, not silently smoothed over.
//   - Unacclimatized (1-7 days at altitude): Peronnet, F., Thibault, G., &
//     Cousineau, D.L. (1991). "A theoretical analysis of the effect of
//     altitude on running performance." Journal of Applied Physiology,
//     70(1), 399-404 -- a running-specific model, confirmed directly
//     against the paper's own abstract.
// Both underlying sources describe the output as "aerobic power" rather
// than a lab-measured VO2max. The VO2 max conversion below still works by
// treating that percentage as directly applicable to a user-supplied VO2max
// value, which is the standard practical proxy exercise science uses for
// "aerobic power" -- but the result is an estimate from a population model,
// not a personalized physiological measurement. See the Altitude
// Calculator's "Behind the calculator" section for the full caveat.

import { altitudeDurationScale, marathonImpairmentFraction } from "@/lib/environmental/altitude-engine";
import { parseTimeToSeconds } from "@/lib/running-format";

const FT_PER_M = 3.28084;

export type AltitudeUnit = "ft" | "m";
export type AcclimatizationState = "acclimatized" | "unacclimatized";

export function feetToKm(feet: number): number {
  return feet / FT_PER_M / 1000;
}

export function metersToKm(meters: number): number {
  return meters / 1000;
}

export function kmToFeet(km: number): number {
  return km * 1000 * FT_PER_M;
}

export function kmToMeters(km: number): number {
  return km * 1000;
}

export function altitudeToKm(value: number, unit: AltitudeUnit): number {
  return unit === "ft" ? feetToKm(value) : metersToKm(value);
}

export function kmToAltitude(km: number, unit: AltitudeUnit): number {
  return unit === "ft" ? kmToFeet(km) : kmToMeters(km);
}

// Sea level up to 20,000 ft (~6.10 km). This isn't a domain limit the source
// itself states -- but the unacclimatized cubic below has its own
// mathematical minimum around x = 6.52 km, past which it curves back upward
// (implying capacity *recovers* at more extreme altitude, which nothing in
// the source supports). 20,000 ft stays safely inside the range where both
// curves are still monotonically decreasing, and comfortably covers every
// altitude a runner would plausibly race or train at.
export const MIN_ALTITUDE_FT = 0;
export const MAX_ALTITUDE_FT = 20000;
export const MIN_ALTITUDE_KM = 0;
export const MAX_ALTITUDE_KM = feetToKm(MAX_ALTITUDE_FT);

export function isAltitudeInModelDomain(altitudeKm: number): boolean {
  return altitudeKm >= MIN_ALTITUDE_KM && altitudeKm <= MAX_ALTITUDE_KM;
}

// y = percent of sea-level aerobic capacity available, x = altitude in km.
export function acclimatizedCapacityPercent(altitudeKm: number): number {
  const x = altitudeKm;
  return -1.12 * x * x - 1.9 * x + 99.9;
}

// The steeper near-term drop before any adaptation has occurred.
export function unacclimatizedCapacityPercent(altitudeKm: number): number {
  const x = altitudeKm;
  return 0.178 * x ** 3 - 1.43 * x * x - 4.07 * x + 100;
}

export function capacityPercentAtAltitude(altitudeKm: number, state: AcclimatizationState): number {
  return state === "acclimatized" ? acclimatizedCapacityPercent(altitudeKm) : unacclimatizedCapacityPercent(altitudeKm);
}

export type Vo2MaxConversionResult = {
  currentCapacityPercent: number;
  seaLevelVo2Max: number;
  targetCapacityPercent: number;
  targetVo2Max: number;
};

// Three-step conversion: recover an implied sea-level baseline from a VO2max
// measured/estimated at one altitude, then re-apply the model's percentage
// at a second altitude. Works in either direction -- "current" and "target"
// are just labels, not an assumption about which altitude is higher.
export function convertVo2MaxBetweenAltitudes(
  currentVo2Max: number,
  currentAltitudeKm: number,
  targetAltitudeKm: number,
  state: AcclimatizationState,
): Vo2MaxConversionResult {
  const currentCapacityPercent = capacityPercentAtAltitude(currentAltitudeKm, state);
  const seaLevelVo2Max = currentVo2Max / (currentCapacityPercent / 100);
  const targetCapacityPercent = capacityPercentAtAltitude(targetAltitudeKm, state);
  const targetVo2Max = seaLevelVo2Max * (targetCapacityPercent / 100);
  return { currentCapacityPercent, seaLevelVo2Max, targetCapacityPercent, targetVo2Max };
}

// How acclimatized an athlete living at `homeAltitudeM` is when racing at
// `raceAltitudeM`, as a simple 0-1 fraction: 0 (home at or below sea level)
// means fully unacclimatized to that race altitude, 1 (home at or above
// the race altitude) means fully acclimatized, linear in between. This is
// a deliberately simple proxy for a genuinely continuous physiological
// process this site has no finer-grained data to model directly -- Bassett
// and Peronnet's own underlying studies (see this file's header) each
// measured exactly one fixed acclimatization state (several weeks vs. 1-7
// days), not a continuum, so nothing below claims to reproduce a
// third, independently-fitted curve. (A similar real, published tool --
// runningwritings.com's Altitude-Adjusted Pace Calculator, by exercise
// physiologist John J. Davis -- models home-altitude acclimation as a
// continuous discount fit to its own independently-collected race-result
// dataset; this function is built from this site's own already-cited
// sources rather than reproducing that tool's specific, unpublished
// coefficients.)
export function acclimatizationBlendFraction(homeAltitudeM: number, raceAltitudeM: number): number {
  if (raceAltitudeM <= 0) return 1;
  return Math.min(1, Math.max(0, homeAltitudeM / raceAltitudeM));
}

// How much of the "fully unacclimatized" Daniels-table penalty (see
// convertTimeBetweenAltitudes below) a partially-acclimatized athlete
// actually experiences at `raceAltitudeM`, expressed as a multiplier on
// that penalty (1 = full penalty, smaller = less impaired). Built by
// comparing this file's own two already-cited capacity-percent curves at
// the same altitude: full acclimatization retains more capacity (a higher
// %) than none at all, so the gap between the unacclimatized and
// acclimatized percentages, scaled by acclimatizationBlendFraction, is
// treated as the fraction of the penalty that acclimatization "buys back."
// Deliberately reuses the two sources already cited in this file rather
// than introducing a new coefficient -- see the file header for why this
// file's own two curves, not a new fit, are the input here.
export function homeAltitudeImpairmentMultiplier(homeAltitudeM: number, raceAltitudeM: number): number {
  if (raceAltitudeM <= 0) return 1;
  const raceAltitudeKm = metersToKm(raceAltitudeM);
  const unacclimatizedPercent = unacclimatizedCapacityPercent(raceAltitudeKm);
  const acclimatizedPercent = acclimatizedCapacityPercent(raceAltitudeKm);
  const fraction = acclimatizationBlendFraction(homeAltitudeM, raceAltitudeM);
  const effectivePercent = unacclimatizedPercent + fraction * (acclimatizedPercent - unacclimatizedPercent);
  if (effectivePercent <= 0) return 1;
  // effectivePercent >= unacclimatizedPercent whenever acclimatization
  // helps (the normal case), so this ratio is <= 1 -- it shrinks the
  // Daniels-based penalty for a more-acclimatized athlete, never grows it.
  return unacclimatizedPercent / effectivePercent;
}

export type TimeConversionResult = {
  actualTimeSeconds: number;
  currentFraction: number;
  seaLevelTimeSeconds: number;
  targetFraction: number;
  targetTimeSeconds: number;
};

// Converts a real time run at one altitude into the equivalent time at
// another altitude, reusing marathonImpairmentFraction and
// altitudeDurationScale directly from
// src/lib/environmental/altitude-engine.ts -- the same functions the
// Environmental Performance Calculator's altitudeEngine.compute() calls.
// Uses that engine's own "equivalent performance" convention: equivalent
// time = actual time * (1 - impairment fraction), where the fraction
// already has Daniels' duration-scaling baked in via
// altitudeDurationScale(actualTimeSeconds). Both the "recover the
// sea-level baseline" step and the "project onto the target altitude" step
// use the SAME actualTimeSeconds as the duration-scaling anchor, rather
// than solving for an unknown target-altitude duration -- altitude's
// duration-scale curve is fairly insensitive to the small time differences
// a single-digit-percent adjustment produces, so this avoids an implicit
// equation for a marginal precision gain. altitudeM inputs are in meters
// (marathonImpairmentFraction's own unit), not the km this file's
// capacity-percent functions use -- see kmToMeters for the conversion.
//
// `homeAltitudeM` (optional, defaults to 0 -- sea level, i.e. fully
// unacclimatized, exactly reproducing this function's own prior behavior
// when omitted) is the one real acclimatization lever Daniels' own tables
// don't provide on their own -- see homeAltitudeImpairmentMultiplier above
// for how it's derived. It's applied independently at the current and
// target altitude, since an athlete's real acclimatization to each is
// governed by the same home altitude but a different race altitude.
export function convertTimeBetweenAltitudes(
  actualTimeSeconds: number,
  currentAltitudeM: number,
  targetAltitudeM: number,
  homeAltitudeM: number = 0,
): TimeConversionResult {
  const currentFraction =
    marathonImpairmentFraction(currentAltitudeM) *
    altitudeDurationScale(actualTimeSeconds) *
    homeAltitudeImpairmentMultiplier(homeAltitudeM, currentAltitudeM);
  const seaLevelTimeSeconds = actualTimeSeconds * (1 - currentFraction);
  const targetFraction =
    marathonImpairmentFraction(targetAltitudeM) *
    altitudeDurationScale(actualTimeSeconds) *
    homeAltitudeImpairmentMultiplier(homeAltitudeM, targetAltitudeM);
  const targetTimeSeconds = seaLevelTimeSeconds / (1 - targetFraction);
  return { actualTimeSeconds, currentFraction, seaLevelTimeSeconds, targetFraction, targetTimeSeconds };
}

export type WorkoutSplitResult = {
  index: number;
  actualTimeSeconds: number;
  targetTimeSeconds: number;
};

// A structured workout (mile repeats, a fartlek ladder, progression splits)
// is a series of short, independent efforts, not one continuous run -- each
// split gets its own call to convertTimeBetweenAltitudes rather than one
// call for the workout's total time. This matters physiologically, not
// just mechanically: altitudeDurationScale reads each split's own duration,
// so a set of ~6-8 minute mile reps is correctly scaled as a series of
// short, largely-Mile-anchored efforts (per DURATION_ANCHORS in
// altitude-engine.ts), rather than being averaged into one ~50-minute
// blended duration that would push the whole workout toward the much
// larger 5K/marathon-anchored scale a single continuous run of the same
// total time would warrant. Converting the total instead of each part
// would systematically overstate altitude's cost on a hard, short-interval
// session.
export function convertWorkoutSplits(
  splitTimesSeconds: number[],
  currentAltitudeM: number,
  targetAltitudeM: number,
  homeAltitudeM: number = 0,
): WorkoutSplitResult[] {
  return splitTimesSeconds.map((actualTimeSeconds, index) => {
    const { targetTimeSeconds } = convertTimeBetweenAltitudes(actualTimeSeconds, currentAltitudeM, targetAltitudeM, homeAltitudeM);
    return { index, actualTimeSeconds, targetTimeSeconds };
  });
}

// Accepts a workout pasted or typed as free text -- newlines and/or commas
// as separators, since that's how someone would naturally type "8:00, 7:30,
// 7:00" or paste one split per line from a training log. Returns null for
// any entry that isn't a valid mm:ss/h:mm:ss time rather than silently
// dropping it, so the UI can point at exactly which split is malformed
// instead of quietly producing a shorter list than the athlete entered.
export function parseWorkoutSplitsInput(input: string): (number | null)[] {
  return input
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => parseTimeToSeconds(part));
}
