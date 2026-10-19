import { describe, expect, it } from "vitest";

import { analyzeCourse } from "@/lib/marathon-pacing/course-analysis";
import {
  buildCheckpoints,
  buildRacePacePlan,
  FLAT_COURSE,
  goalPaceSecPerMileFromGoalTime,
  MARATHON_MILES,
  averageHillImpactSecPerMile,
  perMileNetGradeFtFromCourseAnalysis,
  type RaceClimb,
} from "@/lib/race-pace-planner/pace-plan";
import type { ParsedRoute, RoutePoint } from "@/lib/route-import/types";

const EARTH_RADIUS_M = 6371000;

/** A synthetic equator route (exact, invertible great-circle distance per degree of longitude) with a piecewise-linear elevation profile -- same technique course-analysis.test.ts uses for its own route fixtures. */
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

  return { points, source: "gpx", startTimeIso: null, movingTimeS: null };
}

const GOAL_3H03 = 3 * 3600 + 3 * 60;

describe("goalPaceSecPerMileFromGoalTime", () => {
  it("divides the goal time evenly across 26 miles", () => {
    expect(goalPaceSecPerMileFromGoalTime(26 * 420)).toBeCloseTo(420, 5);
  });
});

describe("buildRacePacePlan", () => {
  it("produces exactly 26 full-mile rows", () => {
    const plan = buildRacePacePlan(GOAL_3H03, "progressive", FLAT_COURSE);
    expect(plan.miles).toHaveLength(MARATHON_MILES);
    expect(plan.miles[0].mile).toBe(1);
    expect(plan.miles[25].mile).toBe(26);
  });

  it("starts a progressive plan slower than goal pace and converges by mile 5", () => {
    const plan = buildRacePacePlan(GOAL_3H03, "progressive", FLAT_COURSE);
    const mile1 = plan.miles[0];
    expect(mile1.flatPaceSecPerMile).toBeGreaterThan(plan.goalPaceSecPerMile + 10);
    expect(mile1.flatPaceSecPerMile).toBeLessThan(plan.goalPaceSecPerMile + 30);
    const mile5 = plan.miles[4];
    expect(mile5.flatPaceSecPerMile).toBeCloseTo(plan.goalPaceSecPerMile, 1);
  });

  it("holds flat goal pace throughout the middle miles under an even start", () => {
    const plan = buildRacePacePlan(GOAL_3H03, "even", FLAT_COURSE);
    const mile1 = plan.miles[0];
    const mile10 = plan.miles[9];
    expect(mile1.flatPaceSecPerMile).toBeCloseTo(plan.goalPaceSecPerMile, 5);
    expect(mile10.flatPaceSecPerMile).toBeCloseTo(plan.goalPaceSecPerMile, 5);
  });

  it("applies a fast finish in the final miles for both strategies", () => {
    for (const strategy of ["progressive", "even"] as const) {
      const plan = buildRacePacePlan(GOAL_3H03, strategy, FLAT_COURSE);
      const lastMile = plan.miles[MARATHON_MILES - 1];
      expect(lastMile.flatPaceSecPerMile).toBeLessThan(plan.goalPaceSecPerMile);
    }
  });

  it("ignores a net per-mile elevation change at or below the noise threshold", () => {
    const climbs: RaceClimb[] = [{ atMile: 10, lengthMiles: 1, feet: 10, direction: "climb" }];
    const plan = buildRacePacePlan(GOAL_3H03, "even", { totalGainFt: 10, totalLossFt: 0, climbs });
    expect(plan.miles[9].gradeAdjustSecPerMile).toBe(0);
  });

  it("slows the watch pace on a real named climb and speeds it on a named descent", () => {
    const climbs: RaceClimb[] = [
      { atMile: 10, lengthMiles: 1, feet: 200, direction: "climb" },
      { atMile: 16, lengthMiles: 1, feet: 200, direction: "descent" },
    ];
    const plan = buildRacePacePlan(GOAL_3H03, "even", { totalGainFt: 200, totalLossFt: 200, climbs });
    const climbMile = plan.miles[9];
    const descentMile = plan.miles[15];
    expect(climbMile.watchPaceSecPerMile).toBeGreaterThan(climbMile.flatPaceSecPerMile);
    expect(descentMile.watchPaceSecPerMile).toBeLessThan(descentMile.flatPaceSecPerMile);
    // Uphill cost and downhill benefit are asymmetric -- an equal-sized
    // climb should slow the mile down by more than an equal-sized descent
    // speeds one up.
    const climbSwing = climbMile.watchPaceSecPerMile - climbMile.flatPaceSecPerMile;
    const descentSwing = descentMile.flatPaceSecPerMile - descentMile.watchPaceSecPerMile;
    expect(climbSwing).toBeGreaterThan(descentSwing);
  });

  it("marks a climbing mile as harder effort than a flat mile at the same tier", () => {
    const climbs: RaceClimb[] = [{ atMile: 10, lengthMiles: 1, feet: 200, direction: "climb" }];
    const plan = buildRacePacePlan(GOAL_3H03, "even", { totalGainFt: 200, totalLossFt: 0, climbs });
    expect(plan.miles[9].effort).toBe("Comfortably hard");
    expect(plan.miles[7].effort).toBe("Marathon effort");
  });

  it("produces monotonically increasing elapsed time", () => {
    const plan = buildRacePacePlan(GOAL_3H03, "progressive", FLAT_COURSE);
    for (let i = 1; i < plan.miles.length; i += 1) {
      expect(plan.miles[i].elapsedSeconds).toBeGreaterThan(plan.miles[i - 1].elapsedSeconds);
    }
  });
});

describe("buildCheckpoints", () => {
  it("returns 5mi, halfway, and 20mi checkpoints in increasing order", () => {
    const plan = buildRacePacePlan(GOAL_3H03, "progressive", FLAT_COURSE);
    const checkpoints = buildCheckpoints(plan);
    expect(checkpoints).toHaveLength(3);
    expect(checkpoints[0].elapsedSeconds).toBeLessThan(checkpoints[1].elapsedSeconds);
    expect(checkpoints[1].elapsedSeconds).toBeLessThan(checkpoints[2].elapsedSeconds);
  });
});

describe("averageHillImpactSecPerMile", () => {
  it("is zero on a flat course", () => {
    const plan = buildRacePacePlan(GOAL_3H03, "even", FLAT_COURSE);
    expect(averageHillImpactSecPerMile(plan)).toBe(0);
  });

  it("is positive (a slowdown) when the only named feature is a climb", () => {
    const climbs: RaceClimb[] = [{ atMile: 10, lengthMiles: 1, feet: 200, direction: "climb" }];
    const plan = buildRacePacePlan(GOAL_3H03, "even", { totalGainFt: 200, totalLossFt: 0, climbs });
    expect(averageHillImpactSecPerMile(plan)).toBeGreaterThan(0);
  });
});

describe("Ch. 18-20 numeric ranges (John Davis, Marathon Excellence for Everyone)", () => {
  it("opens a progressive start 12-25 sec/mi slower than goal pace on mile 1, and has converged by mile 5", () => {
    const plan = buildRacePacePlan(GOAL_3H03, "progressive", FLAT_COURSE);
    const mile1Delta = plan.miles[0].flatPaceSecPerMile - plan.goalPaceSecPerMile;
    expect(mile1Delta).toBeGreaterThanOrEqual(12);
    expect(mile1Delta).toBeLessThanOrEqual(25);
    expect(plan.miles[4].flatPaceSecPerMile).toBeCloseTo(plan.goalPaceSecPerMile, 1);
  });

  it("holds goal pace from mile 1 under an even start -- no progressive-style delta at all", () => {
    const plan = buildRacePacePlan(GOAL_3H03, "even", FLAT_COURSE);
    expect(plan.miles[0].flatPaceSecPerMile - plan.goalPaceSecPerMile).toBeCloseTo(0, 5);
  });

  it("ramps a 3-5 sec/mi fast finish in over the final 4-6 miles for both strategies", () => {
    for (const strategy of ["progressive", "even"] as const) {
      const plan = buildRacePacePlan(GOAL_3H03, strategy, FLAT_COURSE);
      const lastMileDelta = plan.goalPaceSecPerMile - plan.miles[MARATHON_MILES - 1].flatPaceSecPerMile;
      expect(lastMileDelta).toBeGreaterThanOrEqual(3);
      expect(lastMileDelta).toBeLessThanOrEqual(5);
      // Ramped in, not a step: a mile just outside the finish-kick window
      // should show no kick at all yet.
      const milesBeforeKick = MARATHON_MILES - plan.finishKickStartMile;
      expect(milesBeforeKick).toBeGreaterThanOrEqual(4);
      expect(milesBeforeKick).toBeLessThanOrEqual(6);
    }
  });

  it("treats a net per-mile elevation change at exactly the 15ft/mi noise threshold as noise, and one foot beyond it as real", () => {
    const atThreshold: RaceClimb[] = [{ atMile: 10, lengthMiles: 1, feet: 15, direction: "climb" }];
    const justBeyond: RaceClimb[] = [{ atMile: 10, lengthMiles: 1, feet: 16, direction: "climb" }];
    const planAtThreshold = buildRacePacePlan(GOAL_3H03, "even", { totalGainFt: 15, totalLossFt: 0, climbs: atThreshold });
    const planBeyond = buildRacePacePlan(GOAL_3H03, "even", { totalGainFt: 16, totalLossFt: 0, climbs: justBeyond });
    expect(planAtThreshold.miles[9].gradeAdjustSecPerMile).toBe(0);
    expect(planBeyond.miles[9].gradeAdjustSecPerMile).toBeGreaterThan(0);
  });
});

describe("GPS route course input (perMileNetGradeFtFromCourseAnalysis + buildRacePacePlan)", () => {
  it("parses a valid route's real per-mile elevation and adjusts pace on the mile it climbs", () => {
    // Flat for the first 9 miles (14484m), a 300ft/91m climb over mile 10
    // (14484m-16093m), flat the rest of the way to a full marathon.
    const mileM = 1609.344;
    const route = buildRoute(
      [
        { distanceM: 0, elevationM: 0 },
        { distanceM: 9 * mileM, elevationM: 0 },
        { distanceM: 10 * mileM, elevationM: 91 },
        { distanceM: 26 * mileM, elevationM: 91 },
      ],
      20,
    );
    const analysis = analyzeCourse(route);
    const perMileNetGradeFt = perMileNetGradeFtFromCourseAnalysis(analysis);

    expect(perMileNetGradeFt).toHaveLength(MARATHON_MILES);
    // Mile 10 (index 9) is the real climb -- comfortably past the noise threshold.
    expect(perMileNetGradeFt[9]).toBeGreaterThan(15);
    // Mile 5 (index 4) is flat.
    expect(Math.abs(perMileNetGradeFt[4])).toBeLessThanOrEqual(15);

    const plan = buildRacePacePlan(GOAL_3H03, "even", {
      totalGainFt: Math.round(analysis.totalClimbM * 3.28084),
      totalLossFt: Math.round(analysis.totalDescentM * 3.28084),
      climbs: [],
      perMileNetGradeFt,
    });
    expect(plan.miles[9].watchPaceSecPerMile).toBeGreaterThan(plan.miles[9].flatPaceSecPerMile);
    expect(plan.miles[4].gradeAdjustSecPerMile).toBe(0);
  });

  it("treats a route shorter than a full marathon as flat beyond its own analyzed length", () => {
    const mileM = 1609.344;
    // A real climb early, but the route itself only covers 10mi.
    const route = buildRoute([
      { distanceM: 0, elevationM: 0 },
      { distanceM: 2 * mileM, elevationM: 91 },
      { distanceM: 10 * mileM, elevationM: 91 },
    ]);
    const analysis = analyzeCourse(route);
    const perMileNetGradeFt = perMileNetGradeFtFromCourseAnalysis(analysis);
    expect(perMileNetGradeFt).toHaveLength(MARATHON_MILES);
    // Every mile beyond what the route actually covers is flat (0), not NaN/undefined.
    for (let i = 10; i < MARATHON_MILES; i++) {
      expect(perMileNetGradeFt[i]).toBe(0);
    }
  });

  it("a route too short/corrupt to analyze (fewer than two usable GPS points) throws, rather than silently returning a bogus plan -- this is what the component catches to fall back to manual entry with a notice", () => {
    const corruptRoute: ParsedRoute = { points: [{ lat: 0, lon: 0, elevationM: 0, elapsedSeconds: null }], source: "gpx", startTimeIso: null, movingTimeS: null };
    expect(() => analyzeCourse(corruptRoute)).toThrow();
  });
});

describe("/marathon-pacing-calculator redirects to the merged /race-pace-planner", () => {
  it("301-redirects the retired Marathon Pacing Calculator URL to the canonical Race Pace Planner URL", async () => {
    const nextConfig = (await import("../../../next.config")).default;
    const redirects = await nextConfig.redirects!();
    const rule = redirects.find((r) => r.source === "/marathon-pacing-calculator");
    expect(rule).toBeDefined();
    expect(rule!.destination).toBe("/race-pace-planner");
    expect(rule!.permanent).toBe(true);
  });
});
