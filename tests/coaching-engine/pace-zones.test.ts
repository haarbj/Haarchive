import { describe, expect, it } from "vitest";
import { derivePaceZones } from "@/lib/coaching-engine/pace-zones";
import { distanceBucket } from "@/lib/coaching-engine/distance-buckets";

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

  it("keeps 5K interval pace faster than 5K goal pace itself", () => {
    const distanceM = 5000;
    const timeS = 20 * 60;
    const goalPaceSecPerKm = timeS / (distanceM / 1000);
    const zones = derivePaceZones(distanceM, timeS);
    expect(zones.interval[1]).toBeLessThan(goalPaceSecPerKm);
  });

  it("covers every distance bucket across the sample goals", () => {
    const buckets = new Set(GOALS.map((g) => distanceBucket(g.distanceM)));
    expect(buckets).toEqual(new Set(["short", "middle", "long"]));
  });
});
