// The math behind the athlete-facing Percent Pace Zone Table
// (coaching/pace-zones): a coach-free, self-service tool that turns a
// single reference pace (5K or marathon) into a table of named effort
// zones, each defined as a percent-of-pace range against that reference --
// and, optionally, the same zones re-expressed as the equivalent paces to
// actually run at the athlete's home altitude. Both computations reuse
// this codebase's existing John Davis (Running Writings) ports directly:
// computeWorkoutPaceSeconds (pace-percent-math.ts, from
// github.com/johnjdavisiv/pace-percents) for the zone math, and
// convertPerformanceBetweenAltitudes (altitude-adjusted-pace-math.ts, from
// apps.runningwritings.com/altitude-adjusted-pace/) for the altitude
// table. No new physiology is introduced here -- this module only combines
// two already-shipped, already-validated models.

import { computeWorkoutPaceSeconds } from "@/lib/pace-percent-math";
import { convertPerformanceBetweenAltitudes, feetToMeters } from "@/lib/altitude-adjusted-pace-math";

export type PaceZoneRow = {
  label: string;
  /**
   * Percent of the reference pace. Null means open-ended in that
   * direction (e.g. "under 50%") -- EXCEPT that minPercent set with
   * maxPercent left null means one exact percent (e.g. "95% 5K"), not an
   * open-ended "at least this fast" range. See computeZoneBounds below.
   */
  minPercent: number | null;
  maxPercent: number | null;
};

export type PaceZoneBounds = {
  /** Seconds per the reference pace's own distance unit. Null = no cap in that direction. */
  fastSeconds: number | null;
  slowSeconds: number | null;
  /** True when this row is one exact pace (fastSeconds === slowSeconds), not a range. */
  isExact: boolean;
};

const MIN_PERCENT = 1;
const MAX_PERCENT = 300;

// A row needs at least one real, in-range bound to mean anything. When
// both are given, the low percent may equal the high (an explicit exact
// value entered into both fields) but may not exceed it -- a higher
// percent is always the faster/lower-time end, via
// computeWorkoutPaceSeconds's own "pace" basis (see that function's own
// header for why).
export function isValidPercentRow(row: PaceZoneRow): boolean {
  const { minPercent, maxPercent } = row;
  if (minPercent === null && maxPercent === null) return false;
  if (minPercent !== null && (minPercent < MIN_PERCENT || minPercent > MAX_PERCENT)) return false;
  if (maxPercent !== null && (maxPercent < MIN_PERCENT || maxPercent > MAX_PERCENT)) return false;
  if (minPercent !== null && maxPercent !== null && minPercent > maxPercent) return false;
  return true;
}

// The percent-of-pace conversion (Canova's own convention -- see
// pace-percent-math.ts) applied to a row's percent bound(s).
//
// Low % filled in, high % left blank: one exact pace at that percent --
// the natural way to type a single target (e.g. "95% 5K") without a
// second, redundant field. High % filled in, low % left blank: kept as
// the original open-below meaning ("50% or slower") -- these two
// blank-field cases are deliberately NOT symmetric, only the low-only one
// means "exact." Both filled: a real range, using maxPercent (the higher,
// faster percent) for the fast/low-time edge and minPercent for the
// slow/high-time edge (equal values also collapse to exact, same as the
// low-only case).
export function computeZoneBounds(referenceSeconds: number, row: PaceZoneRow): PaceZoneBounds {
  if (row.minPercent !== null && row.maxPercent === null) {
    const seconds = computeWorkoutPaceSeconds(referenceSeconds, row.minPercent, "pace");
    return { fastSeconds: seconds, slowSeconds: seconds, isExact: true };
  }
  const fastSeconds = row.maxPercent !== null ? computeWorkoutPaceSeconds(referenceSeconds, row.maxPercent, "pace") : null;
  const slowSeconds = row.minPercent !== null ? computeWorkoutPaceSeconds(referenceSeconds, row.minPercent, "pace") : null;
  return { fastSeconds, slowSeconds, isExact: fastSeconds !== null && fastSeconds === slowSeconds };
}

// Altitude-adjusts one pace-per-unit-distance value, by treating it as a
// full performance at `distanceMeters` and converting that performance,
// then converting back -- the same pseudo-performance trick the
// Altitude-Adjusted Pace calculator's own "Pace" entry mode already uses
// (see altitude-adjusted-pace-calculator.tsx's timeFromPace/predictedPaceMi),
// applied here to a whole table of zone boundaries instead of one single
// result. Venue is always sea level: the reference pace entered into this
// tool is assumed to represent the athlete's flatland/sea-level fitness,
// and home==target is the athlete's own altitude, since the question this
// answers is "what would this same fitness look like as a real pace where
// I actually train" (not "what would a sea-level race look like run at
// altitude on race day" -- a genuinely different question this tool isn't
// trying to answer).
export function altitudeAdjustPaceSeconds(
  paceSeconds: number,
  paceUnitMeters: number,
  distanceMeters: number,
  homeAltitudeFeet: number,
): number {
  const homeAltitudeMeters = feetToMeters(homeAltitudeFeet);
  const unitsPerDistance = distanceMeters / paceUnitMeters;
  const timeAtDistance = paceSeconds * unitsPerDistance;
  const adjustedTime = convertPerformanceBetweenAltitudes({
    distanceMeters,
    timeSeconds: timeAtDistance,
    venueAltitudeMeters: 0,
    homeAltitudeMeters,
    targetAltitudeMeters: homeAltitudeMeters,
  });
  return adjustedTime / unitsPerDistance;
}
