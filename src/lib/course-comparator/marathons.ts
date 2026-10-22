// Real-race data for the Course Comparator's race picker. The dataset
// itself (marathons.json) is the only thing this module adds -- it
// produces the EXACT same shapes the existing manual-entry pipeline
// already consumes (RaceClimb[], totalGainFt, totalLossFt, a course
// distance), so compare.ts/pace-plan.ts never change. Picking a race is
// just a faster way to fill out the same form a user could type by hand.
//
// Every stat here traces to a real, named source (see each record's own
// sourceNote) -- never estimated. A race with no real elevation profile
// available is left out of this dataset entirely rather than shipped
// with an invented shape (see the data file's own header for which
// races that applied to, and the task report for why).

import rawMarathons from "./data/marathons.json";
import { FEET_PER_MILE_NOISE_THRESHOLD, type RaceClimb } from "@/lib/race-pace-planner/pace-plan";

export type RaceElevationPoint = {
  mile: number;
  elevationFt: number;
};

export type RaceFinishers = {
  count: number;
  year: number;
};

export type RaceRecord = {
  id: string;
  name: string;
  location: string;
  typicalMonth: string;
  distanceMi: number;
  /** Published total climbing, feet. Required for any race actually shipped in the picker -- a core engine input, not a display extra. */
  totalGainFt: number;
  totalLossFt: number;
  /** Sampled roughly every 0.25mi, real course elevation data only. Required for any race shipped in the picker (see this module's own header). */
  elevationProfile: RaceElevationPoint[];
  /** Display-only extras. Each is independently nullable -- an unsourced one renders as "--", never a guess. */
  courseType: string | null;
  surface: string | null;
  certified: boolean | null;
  avgLowF: number | null;
  avgHighF: number | null;
  finishers: RaceFinishers | null;
  bqPercent: number | null;
  /** Where every number above actually came from -- always present, even for a record with several null extras. */
  sourceNote: string;
};

export const MARATHON_RACES: RaceRecord[] = rawMarathons as RaceRecord[];

export function getRaceById(id: string): RaceRecord | null {
  return MARATHON_RACES.find((race) => race.id === id) ?? null;
}

/**
 * Elevation at an arbitrary mile mark, linearly interpolated between the
 * dataset's own real sample points -- never extrapolated past the
 * profile's own ends (a mile beyond the last sample just holds at the
 * last real elevation, the same "no data past here" rule pace-plan.ts
 * already applies to a short GPS route).
 */
function elevationAtMile(profile: RaceElevationPoint[], mile: number): number {
  if (profile.length === 0) return 0;
  const first = profile[0];
  const last = profile[profile.length - 1];
  if (mile <= first.mile) return first.elevationFt;
  if (mile >= last.mile) return last.elevationFt;
  for (let i = 0; i < profile.length - 1; i += 1) {
    const p0 = profile[i];
    const p1 = profile[i + 1];
    if (mile >= p0.mile && mile <= p1.mile) {
      const span = p1.mile - p0.mile;
      const t = span === 0 ? 0 : (mile - p0.mile) / span;
      return p0.elevationFt + t * (p1.elevationFt - p0.elevationFt);
    }
  }
  return last.elevationFt;
}

/**
 * Net elevation change (feet) for each full mile of the race, derived
 * directly from the real sampled profile -- this is what lets a race's
 * climbs be computed rather than hand-typed per record.
 */
export function netGradeFtPerFullMile(race: RaceRecord): number[] {
  const fullMiles = Math.max(1, Math.round(race.distanceMi));
  const out: number[] = [];
  for (let mile = 1; mile <= fullMiles; mile += 1) {
    out.push(elevationAtMile(race.elevationProfile, mile) - elevationAtMile(race.elevationProfile, mile - 1));
  }
  return out;
}

/**
 * Sums every up/down step between consecutive real sample points --
 * independent of the published totalGainFt/totalLossFt, used only to
 * cross-check them (see marathons.json's own header on what happens when
 * the two disagree: the published figures always win for the form
 * fields, and the record's sourceNote says so).
 */
export function totalGainLossFromProfile(profile: RaceElevationPoint[]): { gainFt: number; lossFt: number } {
  let gainFt = 0;
  let lossFt = 0;
  for (let i = 1; i < profile.length; i += 1) {
    const delta = profile[i].elevationFt - profile[i - 1].elevationFt;
    if (delta > 0) gainFt += delta;
    else lossFt += -delta;
  }
  return { gainFt, lossFt };
}

/**
 * Merges consecutive full miles on the same side of the noise floor into
 * named climb/descent segments -- the Course Comparator's manual-entry
 * `climbs` shape (RaceClimb[]), the exact same noise threshold
 * (FEET_PER_MILE_NOISE_THRESHOLD, pace-plan.ts) the engine itself already
 * applies. A mile within the noise floor breaks a run; it never gets its
 * own trivial segment.
 */
export function climbsFromNetGradePerMile(netGradeFtPerMile: number[]): RaceClimb[] {
  const climbs: RaceClimb[] = [];
  let i = 0;
  while (i < netGradeFtPerMile.length) {
    const value = netGradeFtPerMile[i];
    if (Math.abs(value) <= FEET_PER_MILE_NOISE_THRESHOLD) {
      i += 1;
      continue;
    }
    const direction: RaceClimb["direction"] = value > 0 ? "climb" : "descent";
    let j = i;
    let totalFt = 0;
    while (j < netGradeFtPerMile.length) {
      const next = netGradeFtPerMile[j];
      const nextDirection: RaceClimb["direction"] = next > 0 ? "climb" : "descent";
      if (Math.abs(next) <= FEET_PER_MILE_NOISE_THRESHOLD || nextDirection !== direction) break;
      totalFt += Math.abs(next);
      j += 1;
    }
    climbs.push({ atMile: i + 1, lengthMiles: j - i, feet: Math.round(totalFt), direction });
    i = j;
  }
  return climbs;
}

/** The race's own climbs, derived fresh from its real elevation profile every time -- never stored or hand-typed. */
export function climbsForRace(race: RaceRecord): RaceClimb[] {
  return climbsFromNetGradePerMile(netGradeFtPerFullMile(race));
}
