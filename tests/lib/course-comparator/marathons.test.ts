import { describe, expect, it } from "vitest";

import {
  climbsFromNetGradePerMile,
  climbsForRace,
  getRaceById,
  MARATHON_RACES,
  netGradeFtPerFullMile,
  totalGainLossFromProfile,
  type RaceElevationPoint,
  type RaceRecord,
} from "@/lib/course-comparator/marathons";
import { FEET_PER_MILE_NOISE_THRESHOLD } from "@/lib/race-pace-planner/pace-plan";

function raceFixture(overrides: Partial<RaceRecord> = {}): RaceRecord {
  return {
    id: "fixture",
    name: "Fixture Marathon",
    location: "Nowhere, XX",
    typicalMonth: "March",
    distanceMi: 4,
    totalGainFt: 0,
    totalLossFt: 0,
    elevationProfile: [],
    courseType: null,
    surface: null,
    certified: null,
    avgLowF: null,
    avgHighF: null,
    finishers: null,
    bqPercent: null,
    sourceNote: "fixture",
    ...overrides,
  };
}

describe("the race database", () => {
  it("every shipped race has a non-empty elevation profile and real gain/loss totals -- no race ships without a real source", () => {
    expect(MARATHON_RACES.length).toBeGreaterThan(0);
    for (const race of MARATHON_RACES) {
      expect(race.elevationProfile.length).toBeGreaterThan(1);
      expect(race.totalGainFt).toBeGreaterThanOrEqual(0);
      expect(race.totalLossFt).toBeGreaterThanOrEqual(0);
      expect(race.sourceNote.length).toBeGreaterThan(20);
    }
  });

  it("Tucson is in the shipped set (mandatory)", () => {
    expect(getRaceById("tucson")).not.toBeNull();
  });

  it("Chicago and Tucson (the default pairing) both exist", () => {
    expect(getRaceById("chicago")).not.toBeNull();
    expect(getRaceById("tucson")).not.toBeNull();
  });

  it("every race id is unique", () => {
    const ids = MARATHON_RACES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getRaceById returns null for an unknown id", () => {
    expect(getRaceById("not-a-real-race")).toBeNull();
  });
});

describe("netGradeFtPerFullMile", () => {
  it("derives one net-grade value per full mile from the real sampled profile", () => {
    const race = raceFixture({
      distanceMi: 3,
      elevationProfile: [
        { mile: 0, elevationFt: 100 },
        { mile: 1, elevationFt: 150 },
        { mile: 2, elevationFt: 150 },
        { mile: 3, elevationFt: 50 },
      ],
    });
    expect(netGradeFtPerFullMile(race)).toEqual([50, 0, -100]);
  });

  it("interpolates between quarter-mile samples rather than only reading integer-mile points", () => {
    const race = raceFixture({
      distanceMi: 1,
      elevationProfile: [
        { mile: 0, elevationFt: 0 },
        { mile: 0.25, elevationFt: 25 },
        { mile: 0.5, elevationFt: 50 },
        { mile: 0.75, elevationFt: 75 },
        { mile: 1, elevationFt: 100 },
      ],
    });
    expect(netGradeFtPerFullMile(race)).toEqual([100]);
  });

  it("holds flat past the end of the real profile, the same 'no data = flat' rule the rest of this codebase uses", () => {
    const race = raceFixture({
      distanceMi: 2,
      elevationProfile: [
        { mile: 0, elevationFt: 0 },
        { mile: 1, elevationFt: 80 },
      ],
    });
    expect(netGradeFtPerFullMile(race)).toEqual([80, 0]);
  });
});

describe("totalGainLossFromProfile", () => {
  it("sums every up/down step between real sample points independently of the published totals", () => {
    const profile: RaceElevationPoint[] = [
      { mile: 0, elevationFt: 100 },
      { mile: 1, elevationFt: 150 },
      { mile: 2, elevationFt: 120 },
      { mile: 3, elevationFt: 140 },
    ];
    expect(totalGainLossFromProfile(profile)).toEqual({ gainFt: 70, lossFt: 30 });
  });
});

describe("climbsFromNetGradePerMile", () => {
  it("merges consecutive same-direction miles above the noise floor into one climb segment", () => {
    const climbs = climbsFromNetGradePerMile([20, 25, 30, 0]);
    expect(climbs).toEqual([{ atMile: 1, lengthMiles: 3, feet: 75, direction: "climb" }]);
  });

  it("breaks a run at a mile within the noise floor -- that mile gets no segment of its own", () => {
    const climbs = climbsFromNetGradePerMile([20, 5, 20]);
    expect(climbs).toEqual([
      { atMile: 1, lengthMiles: 1, feet: 20, direction: "climb" },
      { atMile: 3, lengthMiles: 1, feet: 20, direction: "climb" },
    ]);
  });

  it("breaks a run when the direction flips, even with no flat mile between", () => {
    const climbs = climbsFromNetGradePerMile([30, -30]);
    expect(climbs).toEqual([
      { atMile: 1, lengthMiles: 1, feet: 30, direction: "climb" },
      { atMile: 2, lengthMiles: 1, feet: 30, direction: "descent" },
    ]);
  });

  it(`a net grade exactly at the ${FEET_PER_MILE_NOISE_THRESHOLD}ft/mi noise floor produces no segment`, () => {
    expect(climbsFromNetGradePerMile([FEET_PER_MILE_NOISE_THRESHOLD])).toEqual([]);
  });

  it("an entirely flat course produces no climbs at all", () => {
    expect(climbsFromNetGradePerMile([0, 0, 0])).toEqual([]);
  });
});

describe("climbsForRace", () => {
  it("derives climbs fresh from the race's own real profile -- never a hand-typed list", () => {
    const race = raceFixture({
      distanceMi: 2,
      elevationProfile: [
        { mile: 0, elevationFt: 0 },
        { mile: 1, elevationFt: 200 },
        { mile: 2, elevationFt: 200 },
      ],
    });
    expect(climbsForRace(race)).toEqual([{ atMile: 1, lengthMiles: 1, feet: 200, direction: "climb" }]);
  });

  it("Tucson's derived climbs include a real, large early descent -- it's a well-known net-downhill course", () => {
    const tucson = getRaceById("tucson")!;
    const climbs = climbsForRace(tucson);
    expect(climbs.length).toBeGreaterThan(0);
    const earlyDescent = climbs.find((c) => c.atMile <= 2 && c.direction === "descent");
    expect(earlyDescent).toBeDefined();
  });
});
