import { describe, expect, it } from "vitest";

import { analyzeCourse } from "@/lib/marathon-pacing/course-analysis";
import type { ParsedRoute, RoutePoint } from "@/lib/route-import/types";

const EARTH_RADIUS_M = 6371000;
const METERS_PER_MILE = 1609.344;

/**
 * Builds a synthetic route along the equator (where great-circle distance
 * per degree of longitude is exact and easy to invert) whose elevation
 * follows a piecewise-linear profile defined by keyframes, sampled every
 * `stepM` -- comparable to a real GPS recording interval at running pace.
 */
function buildRoute(profile: { distanceM: number; elevationM: number }[], stepM = 5): ParsedRoute {
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

  return { points, source: "gpx", startTimeIso: null };
}

describe("analyzeCourse", () => {
  it("distinguishes one sustained climb from the same total gain spread across many rollers", () => {
    // One climb: 300m gain over the first 4000m (7.5%), flat for the rest. 8000m total.
    const oneClimb = buildRoute([
      { distanceM: 0, elevationM: 0 },
      { distanceM: 4000, elevationM: 300 },
      { distanceM: 8000, elevationM: 300 },
    ]);

    // 20 rollers, each climbing 25m over 300m (8.3%) then dropping 20m over
    // 300m (-6.7%) -- comparable total climb to the one big climb above,
    // spread across 20 legs instead of 1. Amplitude is kept comfortably
    // above minSwingM so smoothing doesn't erase individual reversals.
    const rollerProfile: { distanceM: number; elevationM: number }[] = [{ distanceM: 0, elevationM: 0 }];
    let d = 0;
    let elev = 0;
    for (let i = 0; i < 20; i++) {
      d += 300;
      elev += 25;
      rollerProfile.push({ distanceM: d, elevationM: elev });
      d += 300;
      elev -= 20;
      rollerProfile.push({ distanceM: d, elevationM: elev });
    }
    const rollers = buildRoute(rollerProfile);

    const oneClimbAnalysis = analyzeCourse(oneClimb);
    const rollersAnalysis = analyzeCourse(rollers);

    // Both routes have substantial, comparable-order-of-magnitude total
    // climb -- the interesting difference is how it's distributed, not the total.
    expect(oneClimbAnalysis.totalClimbM).toBeGreaterThan(150);
    expect(rollersAnalysis.totalClimbM).toBeGreaterThan(150);

    expect(oneClimbAnalysis.climbs.length).toBe(1);
    expect(rollersAnalysis.climbs.length).toBeGreaterThan(10);

    // Comparable total climb, very different rolling index -- the whole point of segmenting into legs.
    expect(rollersAnalysis.rollingIndex).toBeGreaterThan(oneClimbAnalysis.rollingIndex * 5);
  });

  it("REGRESSION: perMileTerrainCostJPerKg still costs a mile that climbs and descends back to net-zero within itself", () => {
    // A single mile that climbs 40m over its first 200m then descends the
    // same 40m back down over the next 200m, flat for the remaining
    // ~1200m -- start and end elevation are identical, so perMileGrade
    // (net start-to-finish) reads as ~0, exactly the "erased" case a
    // net-grade-only model treats as free. Real terrain cost from climbing
    // and descending a steep 20% pitch is definitely not free.
    const route = buildRoute([
      { distanceM: 0, elevationM: 0 },
      { distanceM: 200, elevationM: 40 },
      { distanceM: 400, elevationM: 0 },
      { distanceM: METERS_PER_MILE + 50, elevationM: 0 },
    ]);
    const analysis = analyzeCourse(route);

    expect(analysis.perMileGrade).toHaveLength(1);
    expect(analysis.perMileGrade[0]).toBeCloseTo(0, 2);
    // Before this fix, a mile reading as net-zero grade contributed exactly
    // zero cost -- this asserts the real, segment-by-segment cost survives
    // even when the net trend cancels out.
    expect(analysis.perMileTerrainCostJPerKg[0]).toBeGreaterThan(100);
  });

  it("reports a flat course as having no climbs or descents", () => {
    const flat = buildRoute([
      { distanceM: 0, elevationM: 50 },
      { distanceM: 5000, elevationM: 50 },
    ]);
    const analysis = analyzeCourse(flat);

    expect(analysis.climbs).toHaveLength(0);
    expect(analysis.descents).toHaveLength(0);
    expect(analysis.totalClimbM).toBe(0);
    expect(analysis.totalDescentM).toBe(0);
    expect(analysis.rollingIndex).toBe(0);
    expect(analysis.avgGrade).toBeCloseTo(0, 5);
    expect(analysis.downhillSeverityScore).toBe(0);
  });

  it("filters GPS/barometric noise below minSwingM instead of reporting phantom climbs", () => {
    const profile: { distanceM: number; elevationM: number }[] = [{ distanceM: 0, elevationM: 100 }];
    let toggled = 100;
    for (let d = 50; d <= 5000; d += 50) {
      toggled = toggled === 100 ? 102 : 100; // +/-2m wobble, well under the default 10m minSwingM
      profile.push({ distanceM: d, elevationM: toggled });
    }
    const noisy = buildRoute(profile, 5);
    const analysis = analyzeCourse(noisy);

    expect(analysis.climbs).toHaveLength(0);
    expect(analysis.descents).toHaveLength(0);
  });

  it("computes a longest climb and a steepest climb that can legitimately differ", () => {
    // A long, gentle climb, a real valley (so it doesn't merge with the next
    // leg), then a short, very steep climb.
    const route = buildRoute([
      { distanceM: 0, elevationM: 0 },
      { distanceM: 3000, elevationM: 90 }, // 3% over 3000m -- long
      { distanceM: 3000 + 100, elevationM: 70 }, // -20m dip -- a genuine reversal, well above minSwingM
      { distanceM: 3000 + 100 + 200, elevationM: 70 + 40 }, // 20% over 200m -- steep and short
      { distanceM: 4000, elevationM: 110 },
    ]);
    const analysis = analyzeCourse(route);

    expect(analysis.longestClimb).not.toBeNull();
    expect(analysis.steepestClimb).not.toBeNull();
    expect(analysis.longestClimb!.distanceM).toBeGreaterThan(analysis.steepestClimb!.distanceM);
    expect(analysis.steepestClimb!.maxGrade).toBeGreaterThan(analysis.longestClimb!.maxGrade);
  });

  it("scores steep descents (beyond -8%) but not gentle ones", () => {
    const gentle = buildRoute([
      { distanceM: 0, elevationM: 100 },
      { distanceM: 3000, elevationM: 10 }, // -3% -- gentle, above the -8% threshold
    ]);
    const steep = buildRoute([
      { distanceM: 0, elevationM: 500 },
      { distanceM: 2000, elevationM: 200 }, // -15% -- well beyond the -8% threshold
    ]);

    expect(analyzeCourse(gentle).downhillSeverityScore).toBe(0);
    const steepScore = analyzeCourse(steep).downhillSeverityScore;
    // Excess-grade-times-distance: (0.15 - 0.08) * 2000m = 140 grade-meters,
    // with some smoothing attenuation expected near the transition edges.
    expect(steepScore).toBeGreaterThan(100);
    expect(steepScore).toBeLessThan(140);
  });

  it("derives per-mile net grade that reflects a known ramp", () => {
    const route = buildRoute([
      { distanceM: 0, elevationM: 0 },
      { distanceM: 4000, elevationM: 300 }, // 7.5% for the first ~2.5 miles
      { distanceM: 8000, elevationM: 300 }, // flat after that
    ]);
    const analysis = analyzeCourse(route);

    const mileCount = Math.floor(8000 / METERS_PER_MILE);
    expect(analysis.perMileGrade).toHaveLength(mileCount);
    expect(analysis.perMileGrade[0]).toBeCloseTo(0.075, 2);
    expect(analysis.perMileGrade[1]).toBeCloseTo(0.075, 2);
    expect(analysis.perMileGrade[mileCount - 1]).toBeCloseTo(0, 2); // last full mile is entirely in the flat section
  });

  it("partitions the full course distance across the grade histogram exactly", () => {
    const route = buildRoute([
      { distanceM: 0, elevationM: 0 },
      { distanceM: 2000, elevationM: 60 },
      { distanceM: 5000, elevationM: 0 },
    ]);
    const analysis = analyzeCourse(route);
    const histogramTotal = analysis.gradeHistogram.reduce((sum, b) => sum + b.distanceM, 0);
    expect(histogramTotal).toBeCloseTo(analysis.totalDistanceM, 3);
  });

  it("derives a per-mile heading pointing due east for a straight eastward course", () => {
    // buildRoute walks the equator eastward (increasing longitude), so a
    // flat, straight course should read as a due-east (90deg) heading.
    const route = buildRoute([
      { distanceM: 0, elevationM: 0 },
      { distanceM: 5000, elevationM: 0 },
    ]);
    const analysis = analyzeCourse(route);
    for (const heading of analysis.perMileHeadingDeg) {
      expect(heading).not.toBeNull();
      expect(heading!).toBeCloseTo(90, 0);
    }
  });

  it("throws when there isn't enough route data to analyze", () => {
    const empty: ParsedRoute = { points: [], source: "gpx", startTimeIso: null };
    expect(() => analyzeCourse(empty)).toThrow();
  });
});
