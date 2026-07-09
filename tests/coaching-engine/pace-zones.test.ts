import { describe, expect, it } from "vitest";
import { derivePaceZones } from "@/lib/coaching-engine/pace-zones";
import { distanceBucket } from "@/lib/coaching-engine/distance-buckets";
import { predictRaceTime } from "@/lib/coaching-engine/race-prediction";

const METERS_PER_MILE = 1609.34;

const GOALS = [
  { name: "mile", distanceM: 1609, timeS: 6 * 60 },
  { name: "5K", distanceM: 5000, timeS: 20 * 60 },
  { name: "10K", distanceM: 10000, timeS: 42 * 60 },
  { name: "half marathon", distanceM: 21097, timeS: 90 * 60 },
  { name: "marathon", distanceM: 42195, timeS: 3 * 3600 + 30 * 60 },
];

describe("derivePaceZones", () => {
  it.each(GOALS)("orders zones fastest-to-slowest for a $name goal", ({ distanceM, timeS }) => {
    const zones = derivePaceZones(distanceM, timeS);
    // Every zone is [fast, slow] with fast <= slow...
    for (const key of ["interval", "tempo", "steady", "easy"] as const) {
      const [fast, slow] = zones[key];
      expect(fast).toBeLessThanOrEqual(slow);
    }
    // ...and the zones themselves run interval < tempo < steady < easy.
    expect(zones.interval[1]).toBeLessThan(zones.tempo[0]);
    expect(zones.tempo[1]).toBeLessThan(zones.steady[0]);
    expect(zones.steady[1]).toBeLessThan(zones.easy[0]);
  });

  it("puts marathon steady pace close to goal pace itself", () => {
    const distanceM = 42195;
    const timeS = 3 * 3600 + 30 * 60;
    const goalPaceSecPerKm = timeS / (distanceM / 1000);
    const zones = derivePaceZones(distanceM, timeS);
    expect(zones.steady[0]).toBeLessThanOrEqual(goalPaceSecPerKm * 1.05);
    expect(zones.steady[1]).toBeGreaterThanOrEqual(goalPaceSecPerKm * 0.95);
  });

  it("covers every distance bucket across the sample goals", () => {
    const buckets = new Set(GOALS.map((g) => distanceBucket(g.distanceM)));
    expect(buckets).toEqual(new Set(["short", "middle", "long"]));
  });

  // The following pin short/middle-bucket zones to this program's own XC
  // guidelines' exact formulas (anchored to 5K pace), rather than an
  // invented percentage-of-goal-pace table: VO2/interval at 5K pace itself,
  // tempo at 5K pace / 0.93, easy at 5K pace + 1:30-2:30/mile.
  describe("XC-anchored short/middle-bucket formulas", () => {
    it("centers interval pace on 5K goal pace itself for a 5K goal (not faster than it)", () => {
      const distanceM = 5000;
      const timeS = 20 * 60;
      const goalPaceSecPerKm = timeS / (distanceM / 1000);
      const zones = derivePaceZones(distanceM, timeS);
      const intervalMid = (zones.interval[0] + zones.interval[1]) / 2;
      expect(intervalMid).toBeCloseTo(goalPaceSecPerKm, 1);
    });

    it("centers tempo pace on 5K pace / 0.93 for a 5K goal", () => {
      const distanceM = 5000;
      const timeS = 20 * 60;
      const fiveKSecPerKm = timeS / (distanceM / 1000);
      const zones = derivePaceZones(distanceM, timeS);
      const tempoMid = (zones.tempo[0] + zones.tempo[1]) / 2;
      expect(tempoMid).toBeCloseTo(fiveKSecPerKm / 0.93, 1);
    });

    it("matches the program's own '16:00 5K -> ~5:30 tempo pace' example", () => {
      const zones = derivePaceZones(5000, 16 * 60);
      const tempoMidSecPerMile = ((zones.tempo[0] + zones.tempo[1]) / 2) * (METERS_PER_MILE / 1000);
      expect(tempoMidSecPerMile).toBeGreaterThan(5 * 60 + 25);
      expect(tempoMidSecPerMile).toBeLessThan(5 * 60 + 35);
    });

    it("offsets easy pace from 5K pace by 1:30-2:30 per mile for a 5K goal", () => {
      const distanceM = 5000;
      const timeS = 20 * 60;
      const fiveKSecPerKm = timeS / (distanceM / 1000);
      const zones = derivePaceZones(distanceM, timeS);
      const expectedFast = fiveKSecPerKm + 90 / (METERS_PER_MILE / 1000);
      const expectedSlow = fiveKSecPerKm + 150 / (METERS_PER_MILE / 1000);
      expect(zones.easy[0]).toBeCloseTo(expectedFast, 1);
      expect(zones.easy[1]).toBeCloseTo(expectedSlow, 1);
    });

    it("derives a middle-bucket (10K) goal's zones from an equivalent 5K via Riegel, not straight goal pace", () => {
      const distanceM = 10000;
      const timeS = 42 * 60;
      const fiveKSeconds = predictRaceTime(distanceM, timeS, 5000);
      const fiveKSecPerKm = fiveKSeconds / 5;
      const goalPaceSecPerKm = timeS / (distanceM / 1000);
      const zones = derivePaceZones(distanceM, timeS);
      const intervalMid = (zones.interval[0] + zones.interval[1]) / 2;
      expect(intervalMid).toBeCloseTo(fiveKSecPerKm, 1);
      expect(Math.abs(intervalMid - goalPaceSecPerKm)).toBeGreaterThan(5);
    });

    it("keeps zones strictly ordered even for an extremely slow 5K goal (defensive clamp)", () => {
      const zones = derivePaceZones(5000, 50 * 60);
      expect(zones.interval[1]).toBeLessThan(zones.tempo[0]);
      expect(zones.tempo[1]).toBeLessThan(zones.steady[0]);
      expect(zones.steady[1]).toBeLessThan(zones.easy[0]);
    });
  });
});
