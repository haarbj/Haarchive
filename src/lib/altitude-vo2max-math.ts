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
export function convertTimeBetweenAltitudes(
  actualTimeSeconds: number,
  currentAltitudeM: number,
  targetAltitudeM: number,
): TimeConversionResult {
  const currentFraction = marathonImpairmentFraction(currentAltitudeM) * altitudeDurationScale(actualTimeSeconds);
  const seaLevelTimeSeconds = actualTimeSeconds * (1 - currentFraction);
  const targetFraction = marathonImpairmentFraction(targetAltitudeM) * altitudeDurationScale(actualTimeSeconds);
  const targetTimeSeconds = seaLevelTimeSeconds / (1 - targetFraction);
  return { actualTimeSeconds, currentFraction, seaLevelTimeSeconds, targetFraction, targetTimeSeconds };
}
