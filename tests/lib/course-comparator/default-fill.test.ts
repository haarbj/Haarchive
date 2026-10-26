import { describe, expect, it } from "vitest";

import { compareCourses, courseProfileFromManualEntry } from "@/lib/course-comparator/compare";
import { climbsForRace, getRaceById } from "@/lib/course-comparator/marathons";
import type { CourseInput } from "@/lib/race-pace-planner/pace-plan";

// Regression coverage for the "picker shows a race, but the form stays
// empty" bug: a race's own published totals and derived climbs must
// actually reach compareCourses as a real, non-empty CourseInput, not a
// blank default. This exercises the exact real data flow
// course-comparator.tsx's own manualStateFromRace/buildProfile use
// (race -> gain/loss/climbs -> courseProfileFromManualEntry ->
// compareCourses), asserting the real default-pairing numbers end to
// end rather than just that the right functions are imported.

function profileFor(raceId: string) {
  const race = getRaceById(raceId)!;
  const course: CourseInput = { totalGainFt: race.totalGainFt, totalLossFt: race.totalLossFt, climbs: climbsForRace(race) };
  return courseProfileFromManualEntry(course, race.distanceMi);
}

describe("a selected race produces a real, populated course -- never a blank default", () => {
  it("Chicago's own published gain/loss reaches the course profile untouched", () => {
    const chicago = getRaceById("chicago")!;
    const profile = profileFor("chicago");
    expect(chicago.totalGainFt).toBe(243);
    expect(chicago.totalLossFt).toBe(242);
    expect(profile.totalGainFt).toBe(243);
    expect(profile.totalLossFt).toBe(242);
  });

  it("Chicago's derived climbs are non-empty -- a real hill, not an empty list", () => {
    const climbs = climbsForRace(getRaceById("chicago")!);
    expect(climbs.length).toBeGreaterThan(0);
  });

  it("Tucson's own published gain/loss also reaches the course profile untouched", () => {
    const tucson = getRaceById("tucson")!;
    const profile = profileFor("tucson");
    expect(tucson.totalGainFt).toBe(292);
    expect(tucson.totalLossFt).toBe(1493);
    expect(profile.totalGainFt).toBe(292);
    expect(profile.totalLossFt).toBe(1493);
  });

  it("comparing the real default pairing (Chicago vs Tucson) produces a non-zero grade-adjusted delta -- never 'Roughly even' from two accidentally-empty courses", () => {
    const comparison = compareCourses(profileFor("chicago"), "Chicago Marathon", profileFor("tucson"), "Tucson Marathon", 26.2);
    expect(comparison.deltaSecPerMile).not.toBe(0);
    expect(Math.round(Math.abs(comparison.deltaSecPerMile))).toBe(6);
    expect(comparison.totalTimeDeltaSeconds).not.toBe(0);
  });

  it("the projected time difference over a full marathon is about 2:31, matching what the live page should show", () => {
    const comparison = compareCourses(profileFor("chicago"), "Chicago Marathon", profileFor("tucson"), "Tucson Marathon", 26.2);
    const totalSeconds = Math.round(Math.abs(comparison.totalTimeDeltaSeconds));
    expect(totalSeconds).toBeGreaterThan(149); // 2:29
    expect(totalSeconds).toBeLessThan(153); // 2:33
  });
});
