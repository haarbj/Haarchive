// Pure head-to-head course comparison logic. This module invents nothing:
// every per-mile grade adjustment comes straight from
// race-pace-planner/pace-plan.ts's existing grade heuristic
// (netGradeFtForMile, gradeAdjustSecPerMile, the FEET_PER_MILE_NOISE_THRESHOLD
// floor) -- the same +12/-6 sec-per-100ft rule of thumb and 15ft/mi noise
// floor the Race Pace Planner itself uses. A GPS-imported course's
// per-mile grade comes from course-analysis.ts's `perMileGrade` (shared
// with the Race Pace Planner and the Environmental Calculator), converted
// to feet/mile with the same FEET_PER_MILE constant pace-plan.ts exports.
// No new elevation model, no weather/wind/altitude adjustment (that's the
// Environmental Calculator's job -- this tool links to it instead).

import {
  FEET_PER_MILE,
  FEET_PER_MILE_NOISE_THRESHOLD,
  gradeAdjustSecPerMile,
  netGradeFtForMile,
  type CourseInput,
} from "@/lib/race-pace-planner/pace-plan";
import type { CourseAnalysis } from "@/lib/marathon-pacing/course-analysis";

export type CourseProfileMile = {
  mile: number;
  /** Net elevation change (feet) for this mile -- positive = net climb. */
  netGradeFt: number;
  /** The grade-adjustment heuristic's own output for this mile (0 within the noise floor). */
  gradeAdjustSecPerMile: number;
  /** Cumulative elevation change (feet) from the start of the course through the end of this mile -- what the elevation profile chart plots. */
  cumulativeElevationFt: number;
};

export type CourseProfile = {
  lengthMiles: number;
  totalGainFt: number;
  totalLossFt: number;
  netGradeFt: number;
  miles: CourseProfileMile[];
  /** The single mile with the largest net grade swing in either direction -- null only for a perfectly flat course. */
  hilliestMile: CourseProfileMile | null;
  /** Mean grade-adjustment across every mile (including flat/sub-threshold miles at 0) -- this course's own grade-adjusted difficulty signature, in sec/mi. */
  avgGradeAdjustSecPerMile: number;
};

/**
 * Builds a course's grade profile from a GPS route's own analyzed terrain
 * (course-analysis.ts) -- distance and gain/loss come from the route
 * itself, and per-mile grade is the route's own real `perMileGrade`
 * (converted from decimal grade to feet/mile), not a heuristic guess.
 */
export function courseProfileFromAnalysis(analysis: CourseAnalysis): CourseProfile {
  const perMileNetGradeFt = analysis.perMileGrade.map((grade) => grade * FEET_PER_MILE);
  const course: CourseInput = {
    totalGainFt: analysis.totalClimbM * 3.28084,
    totalLossFt: analysis.totalDescentM * 3.28084,
    climbs: [],
    perMileNetGradeFt,
  };
  return buildCourseProfile(course, Math.max(1, perMileNetGradeFt.length), course.totalGainFt, course.totalLossFt);
}

/**
 * Builds a course's grade profile from manual entry (total gain/loss plus
 * named climbs/descents, same RaceClimb model the Race Pace Planner
 * uses) over a user-entered course distance. Full miles only, same
 * "full miles only" precedent pace-plan.ts itself documents.
 */
export function courseProfileFromManualEntry(course: CourseInput, lengthMiles: number): CourseProfile {
  return buildCourseProfile(course, Math.max(1, Math.round(lengthMiles)), course.totalGainFt, course.totalLossFt);
}

function buildCourseProfile(course: CourseInput, fullMiles: number, totalGainFt: number, totalLossFt: number): CourseProfile {
  let cumulativeElevationFt = 0;
  const miles: CourseProfileMile[] = [];
  for (let mile = 1; mile <= fullMiles; mile += 1) {
    const netGradeFt = netGradeFtForMile(mile, course);
    cumulativeElevationFt += netGradeFt;
    miles.push({
      mile,
      netGradeFt,
      gradeAdjustSecPerMile: gradeAdjustSecPerMile(netGradeFt),
      cumulativeElevationFt,
    });
  }

  const hilliestMile = miles.reduce<CourseProfileMile | null>(
    (best, m) => (m.netGradeFt !== 0 && (!best || Math.abs(m.netGradeFt) > Math.abs(best.netGradeFt)) ? m : best),
    null,
  );
  const avgGradeAdjustSecPerMile = miles.reduce((sum, m) => sum + m.gradeAdjustSecPerMile, 0) / miles.length;

  return {
    lengthMiles: fullMiles,
    totalGainFt,
    totalLossFt,
    netGradeFt: totalGainFt - totalLossFt,
    miles,
    hilliestMile,
    avgGradeAdjustSecPerMile,
  };
}

export type CourseComparison = {
  /** Course A's avg grade-adjust minus Course B's -- positive means A is harder. Computing this as a plain subtraction of two independently-computed values (never re-derived from a prior comparison) is what makes delta(A,B) === -delta(B,A) hold exactly, not just approximately -- see compare.test.ts's symmetry test. */
  deltaSecPerMile: number;
  /** deltaSecPerMile projected across the user's goal distance. */
  totalTimeDeltaSeconds: number;
  verdict: string;
};

/**
 * Head-to-head comparison of two already-built course profiles. Pure
 * arithmetic on the profiles' own numbers -- no new course data is read
 * or re-derived here, which is what guarantees the symmetry property
 * (swap the arguments, including the labels, and every number in the
 * result negates exactly).
 */
export function compareCourses(a: CourseProfile, labelA: string, b: CourseProfile, labelB: string, goalDistanceMiles: number): CourseComparison {
  const deltaSecPerMile = a.avgGradeAdjustSecPerMile - b.avgGradeAdjustSecPerMile;
  const totalTimeDeltaSeconds = deltaSecPerMile * goalDistanceMiles;
  const verdict = buildVerdict(a, labelA, b, labelB, deltaSecPerMile);
  return { deltaSecPerMile, totalTimeDeltaSeconds, verdict };
}

/** Roughly what fraction of the total per-mile difference a single dominant mile needs to represent before the verdict names that mile specifically, rather than describing the difference as spread across the course. */
const DOMINANT_MILE_SHARE_THRESHOLD = 0.4;

function buildVerdict(a: CourseProfile, labelA: string, b: CourseProfile, labelB: string, deltaSecPerMile: number): string {
  const roundedDelta = Math.round(Math.abs(deltaSecPerMile));
  if (roundedDelta === 0) {
    return `${labelA} and ${labelB} are grade-adjusted roughly the same difficulty -- any net elevation difference between them is within the ${FEET_PER_MILE_NOISE_THRESHOLD}ft/mi noise floor this model doesn't adjust for.`;
  }

  const harder = deltaSecPerMile > 0 ? labelA : labelB;
  const easier = deltaSecPerMile > 0 ? labelB : labelA;
  const reason = describeDominantFactor(a, b);
  return `${harder} is roughly ${roundedDelta} sec/mi harder than ${easier} on a grade-adjusted basis${reason ? `, mostly from ${reason}` : ""}.`;
}

/**
 * Looks at the per-mile difference between the two profiles (padding the
 * shorter course with flat/zero miles beyond its own length, the same
 * "no data = flat" assumption pace-plan.ts makes elsewhere) and decides
 * whether one specific mile explains most of the gap, or whether it's
 * spread across many smaller differences -- purely a description of the
 * two profiles' own already-computed numbers, not a new calculation.
 */
function describeDominantFactor(a: CourseProfile, b: CourseProfile): string | null {
  const length = Math.max(a.miles.length, b.miles.length);
  const perMileDelta: number[] = [];
  for (let i = 0; i < length; i += 1) {
    const adjustA = a.miles[i]?.gradeAdjustSecPerMile ?? 0;
    const adjustB = b.miles[i]?.gradeAdjustSecPerMile ?? 0;
    perMileDelta.push(adjustA - adjustB);
  }

  const totalAbs = perMileDelta.reduce((sum, d) => sum + Math.abs(d), 0);
  if (totalAbs === 0) return null;

  let dominantIndex = 0;
  for (let i = 1; i < perMileDelta.length; i += 1) {
    if (Math.abs(perMileDelta[i]) > Math.abs(perMileDelta[dominantIndex])) dominantIndex = i;
  }

  const share = Math.abs(perMileDelta[dominantIndex]) / totalAbs;
  if (share >= DOMINANT_MILE_SHARE_THRESHOLD) {
    const mile = dominantIndex + 1;
    return `${perMileDelta[dominantIndex] > 0 ? "a climb" : "a descent"} around mile ${mile}`;
  }
  return "sustained rolling grade spread across the course, not one single hill";
}
