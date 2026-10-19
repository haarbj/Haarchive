import { describe, expect, it } from "vitest";

import { analyzeCourse } from "@/lib/marathon-pacing/course-analysis";
import {
  compareCourses,
  courseProfileFromAnalysis,
  courseProfileFromManualEntry,
  type CourseProfile,
} from "@/lib/course-comparator/compare";
import { FLAT_COURSE, type CourseInput, type RaceClimb } from "@/lib/race-pace-planner/pace-plan";
import type { ParsedRoute, RoutePoint } from "@/lib/route-import/types";

const EARTH_RADIUS_M = 6371000;
const MILE_M = 1609.344;

/** Same synthetic-route technique pace-plan.test.ts and course-analysis.test.ts use for their own fixtures. */
function buildRoute(profile: { distanceM: number; elevationM: number }[], stepM = 20): ParsedRoute {
  const totalDistanceM = profile[profile.length - 1].distanceM;
  const points: RoutePoint[] = [];

  function elevationAt(distanceM: number): number {
    for (let i = 0; i < profile.length - 1; i++) {
      const a = profile[i];
      const b = profile[i + 1];
      if (distanceM >= a.distanceM && distanceM <= b.distanceM) {
        const t = (distanceM - a.distanceM) / (b.distanceM - a.distanceM);
        return a.elevationM + (b.elevationM - a.elevationM) * t;
      }
    }
    return profile[profile.length - 1].elevationM;
  }

  for (let d = 0; d <= totalDistanceM; d += stepM) {
    const lonDeg = (d / EARTH_RADIUS_M) * (180 / Math.PI);
    points.push({ lat: 0, lon: lonDeg, elevationM: elevationAt(d), elapsedSeconds: null });
  }

  return { points, source: "gpx", startTimeIso: null, movingTimeS: null };
}

function flatManualCourse(lengthMiles: number): CourseProfile {
  return courseProfileFromManualEntry(FLAT_COURSE, lengthMiles);
}

function hillyManualCourse(lengthMiles: number): CourseProfile {
  const climbs: RaceClimb[] = [{ atMile: 10, lengthMiles: 1, feet: 500, direction: "climb" }];
  const course: CourseInput = { totalGainFt: 500, totalLossFt: 0, climbs };
  return courseProfileFromManualEntry(course, lengthMiles);
}

describe("A/B symmetry", () => {
  // Plain `===` (what the task spec itself asks for: "delta(A,B) === -delta(B,A)
  // exactly"), not vitest's `toBe`/Object.is -- Object.is treats +0 and -0
  // as different values, but 0 === -0 is true in JS, and a genuinely
  // symmetric result can legitimately land on +0 one direction and -0 the
  // other (e.g. two courses with equal grade-adjusted difficulty). That's
  // still exact symmetry by the spec's own `===` definition, so asserting
  // with `===` (wrapped in toBe(true)) is the correct exactness check here,
  // not a loosened one.
  function isExactNegation(x: number, y: number): boolean {
    return x === -y;
  }

  it("delta(A, B) is the exact negation of delta(B, A)", () => {
    const flat = flatManualCourse(26);
    const hilly = hillyManualCourse(26);
    const forward = compareCourses(flat, "Flat", hilly, "Hilly", 26.2);
    const backward = compareCourses(hilly, "Hilly", flat, "Flat", 26.2);
    expect(isExactNegation(forward.deltaSecPerMile, backward.deltaSecPerMile)).toBe(true);
    expect(isExactNegation(forward.totalTimeDeltaSeconds, backward.totalTimeDeltaSeconds)).toBe(true);
  });

  it("holds for a variety of goal distances and course shapes, not just one example", () => {
    const climbsA: RaceClimb[] = [{ atMile: 3, lengthMiles: 2, feet: 300, direction: "climb" }];
    const climbsB: RaceClimb[] = [
      { atMile: 5, lengthMiles: 1, feet: 150, direction: "climb" },
      { atMile: 20, lengthMiles: 1, feet: 400, direction: "descent" },
    ];
    const courseA = courseProfileFromManualEntry({ totalGainFt: 300, totalLossFt: 0, climbs: climbsA }, 26);
    const courseB = courseProfileFromManualEntry({ totalGainFt: 150, totalLossFt: 400, climbs: climbsB }, 13.1);
    for (const goalDistanceMiles of [13.1, 26.2, 5, 50]) {
      const forward = compareCourses(courseA, "A", courseB, "B", goalDistanceMiles);
      const backward = compareCourses(courseB, "B", courseA, "A", goalDistanceMiles);
      expect(isExactNegation(forward.deltaSecPerMile, backward.deltaSecPerMile)).toBe(true);
      expect(isExactNegation(forward.totalTimeDeltaSeconds, backward.totalTimeDeltaSeconds)).toBe(true);
    }
  });
});

describe("identical courses", () => {
  it("gives a delta of exactly zero when both sides are the same course", () => {
    const hilly = hillyManualCourse(26);
    const result = compareCourses(hilly, "A", hilly, "B", 26.2);
    expect(result.deltaSecPerMile).toBe(0);
    expect(result.totalTimeDeltaSeconds).toBe(0);
    expect(result.verdict).toMatch(/roughly the same difficulty/);
  });

  it("also gives zero for two independently-built profiles of the same course definition", () => {
    const climbs: RaceClimb[] = [{ atMile: 8, lengthMiles: 1, feet: 300, direction: "climb" }];
    const course: CourseInput = { totalGainFt: 300, totalLossFt: 0, climbs };
    const a = courseProfileFromManualEntry(course, 26);
    const b = courseProfileFromManualEntry(course, 26);
    expect(compareCourses(a, "A", b, "B", 26.2).deltaSecPerMile).toBe(0);
  });
});

describe("flat vs. hilly", () => {
  it("flags the hilly course as harder by the heuristic's own expected magnitude", () => {
    const flat = flatManualCourse(26);
    const hilly = hillyManualCourse(26);
    // 500ft climb over 1 mile at mile 10 -> gradeAdjustSecPerMile = 5 * 12 = 60s on that one mile.
    // Averaged across all 26 miles (25 flat, 1 at +60s): 60/26 ~= 2.31 s/mi.
    const result = compareCourses(hilly, "Hilly", flat, "Flat", 26.2);
    expect(result.deltaSecPerMile).toBeCloseTo(60 / 26, 2);
    expect(result.deltaSecPerMile).toBeGreaterThan(0);
    expect(result.verdict).toMatch(/Hilly is roughly/);
    expect(result.verdict).toMatch(/climb around mile 10/);
  });
});

describe("15ft/mi noise floor", () => {
  it("treats two courses differing only within the noise floor as having ~zero delta", () => {
    const course10ft: CourseInput = { totalGainFt: 10, totalLossFt: 0, climbs: [{ atMile: 5, lengthMiles: 1, feet: 10, direction: "climb" }] };
    const course15ft: CourseInput = { totalGainFt: 15, totalLossFt: 0, climbs: [{ atMile: 5, lengthMiles: 1, feet: 15, direction: "climb" }] };
    const a = courseProfileFromManualEntry(course10ft, 26);
    const b = courseProfileFromManualEntry(course15ft, 26);
    const result = compareCourses(a, "A", b, "B", 26.2);
    expect(result.deltaSecPerMile).toBe(0);
    expect(result.totalTimeDeltaSeconds).toBe(0);
  });

  it("a net change one foot beyond the noise floor is no longer treated as noise", () => {
    const atThreshold: CourseInput = { totalGainFt: 15, totalLossFt: 0, climbs: [{ atMile: 5, lengthMiles: 1, feet: 15, direction: "climb" }] };
    const beyondThreshold: CourseInput = { totalGainFt: 16, totalLossFt: 0, climbs: [{ atMile: 5, lengthMiles: 1, feet: 16, direction: "climb" }] };
    const a = courseProfileFromManualEntry(atThreshold, 26);
    const b = courseProfileFromManualEntry(beyondThreshold, 26);
    const result = compareCourses(b, "Beyond", a, "AtThreshold", 26.2);
    expect(result.deltaSecPerMile).toBeGreaterThan(0);
  });
});

describe("GPS course profile (courseProfileFromAnalysis)", () => {
  it("builds a profile with the route's own real gain/loss and per-mile grade", () => {
    const route = buildRoute([
      { distanceM: 0, elevationM: 0 },
      { distanceM: 9 * MILE_M, elevationM: 0 },
      { distanceM: 10 * MILE_M, elevationM: 91 }, // ~300ft climb over mile 10
      { distanceM: 26 * MILE_M, elevationM: 91 },
    ]);
    const analysis = analyzeCourse(route);
    const profile = courseProfileFromAnalysis(analysis);

    expect(profile.totalGainFt).toBeGreaterThan(250);
    expect(profile.hilliestMile).not.toBeNull();
    expect(profile.hilliestMile!.mile).toBe(10);
    expect(profile.avgGradeAdjustSecPerMile).toBeGreaterThan(0);
  });

  it("a route too short/corrupt to analyze throws, independent of any other course being compared", () => {
    const corruptRoute: ParsedRoute = {
      points: [{ lat: 0, lon: 0, elevationM: 0, elapsedSeconds: null }],
      source: "gpx",
      startTimeIso: null,
      movingTimeS: null,
    };
    // The corrupt side throws...
    expect(() => courseProfileFromAnalysis(analyzeCourse(corruptRoute))).toThrow();
    // ...but a perfectly ordinary manual course on "the other side" builds
    // fine regardless -- the two sides are independent pure function
    // calls with no shared state, which is what the component's try/catch
    // (falling back that one side to manual entry with a notice) relies on.
    const otherSide = flatManualCourse(26);
    expect(otherSide.miles).toHaveLength(26);
    expect(otherSide.avgGradeAdjustSecPerMile).toBe(0);
  });
});

describe("hilliest mile", () => {
  it("is null for a perfectly flat course", () => {
    expect(flatManualCourse(26).hilliestMile).toBeNull();
  });

  it("identifies the single steepest mile when several hills are present", () => {
    const climbs: RaceClimb[] = [
      { atMile: 4, lengthMiles: 1, feet: 100, direction: "climb" },
      { atMile: 18, lengthMiles: 1, feet: 400, direction: "climb" },
    ];
    const course: CourseInput = { totalGainFt: 500, totalLossFt: 0, climbs };
    const profile = courseProfileFromManualEntry(course, 26);
    expect(profile.hilliestMile!.mile).toBe(18);
  });
});
