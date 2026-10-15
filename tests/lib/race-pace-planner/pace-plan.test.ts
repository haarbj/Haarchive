import { describe, expect, it } from "vitest";

import {
  buildCheckpoints,
  buildRacePacePlan,
  FLAT_COURSE,
  goalPaceSecPerMileFromGoalTime,
  MARATHON_MILES,
  averageHillImpactSecPerMile,
  type RaceClimb,
} from "@/lib/race-pace-planner/pace-plan";

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
