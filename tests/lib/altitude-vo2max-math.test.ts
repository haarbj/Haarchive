import { describe, expect, it } from "vitest";

import {
  MAX_ALTITUDE_KM,
  MIN_ALTITUDE_KM,
  acclimatizedCapacityPercent,
  altitudeToKm,
  capacityPercentAtAltitude,
  convertTimeBetweenAltitudes,
  convertVo2MaxBetweenAltitudes,
  feetToKm,
  isAltitudeInModelDomain,
  kmToAltitude,
  kmToFeet,
  kmToMeters,
  metersToKm,
  unacclimatizedCapacityPercent,
} from "@/lib/altitude-vo2max-math";
import { altitudeDurationScale, marathonImpairmentFraction } from "@/lib/environmental/altitude-engine";

describe("unit conversion", () => {
  it("converts feet to km", () => {
    expect(feetToKm(1000)).toBeCloseTo(0.3048, 4);
    expect(feetToKm(7000)).toBeCloseTo(2.1336, 4);
  });

  it("converts meters to km", () => {
    expect(metersToKm(2134)).toBeCloseTo(2.134, 5);
  });

  it("round-trips feet -> km -> feet", () => {
    expect(kmToFeet(feetToKm(5280))).toBeCloseTo(5280, 5);
  });

  it("round-trips meters -> km -> meters", () => {
    expect(kmToMeters(metersToKm(1500))).toBeCloseTo(1500, 8);
  });

  it("altitudeToKm dispatches on unit", () => {
    expect(altitudeToKm(7000, "ft")).toBeCloseTo(2.1336, 4);
    expect(altitudeToKm(2134, "m")).toBeCloseTo(2.134, 5);
  });

  it("kmToAltitude dispatches on unit", () => {
    expect(kmToAltitude(2.1336, "ft")).toBeCloseTo(7000, 0);
    expect(kmToAltitude(2.134, "m")).toBeCloseTo(2134, 0);
  });
});

describe("acclimatizedCapacityPercent", () => {
  it("is ~99.9% at sea level (the equation's own intercept, not exactly 100)", () => {
    expect(acclimatizedCapacityPercent(0)).toBeCloseTo(99.9, 5);
  });

  it("matches the worked example: ~90.75% at 7,000 ft", () => {
    expect(acclimatizedCapacityPercent(feetToKm(7000))).toBeCloseTo(90.75, 1);
  });

  it("decreases monotonically across the supported domain", () => {
    const low = acclimatizedCapacityPercent(1);
    const high = acclimatizedCapacityPercent(5);
    expect(high).toBeLessThan(low);
  });
});

describe("unacclimatizedCapacityPercent", () => {
  it("is exactly 100% at sea level", () => {
    expect(unacclimatizedCapacityPercent(0)).toBeCloseTo(100, 5);
  });

  it("matches the worked example: ~86.54% at 7,000 ft", () => {
    expect(unacclimatizedCapacityPercent(feetToKm(7000))).toBeCloseTo(86.54, 1);
  });

  it("is below the acclimatized curve at the same moderate altitude", () => {
    const altitudeKm = feetToKm(7000);
    expect(unacclimatizedCapacityPercent(altitudeKm)).toBeLessThan(acclimatizedCapacityPercent(altitudeKm));
  });
});

describe("capacityPercentAtAltitude", () => {
  it("dispatches to the matching equation", () => {
    const altitudeKm = feetToKm(7000);
    expect(capacityPercentAtAltitude(altitudeKm, "acclimatized")).toBeCloseTo(
      acclimatizedCapacityPercent(altitudeKm),
      10,
    );
    expect(capacityPercentAtAltitude(altitudeKm, "unacclimatized")).toBeCloseTo(
      unacclimatizedCapacityPercent(altitudeKm),
      10,
    );
  });
});

describe("isAltitudeInModelDomain", () => {
  it("accepts sea level and the supported range", () => {
    expect(isAltitudeInModelDomain(0)).toBe(true);
    expect(isAltitudeInModelDomain(feetToKm(7000))).toBe(true);
    expect(isAltitudeInModelDomain(MAX_ALTITUDE_KM)).toBe(true);
  });

  it("rejects negative altitude", () => {
    expect(isAltitudeInModelDomain(-1)).toBe(false);
  });

  it("rejects altitude beyond the 20,000 ft domain cap", () => {
    expect(isAltitudeInModelDomain(MAX_ALTITUDE_KM + 1)).toBe(false);
  });

  it("domain bounds are sea level to 20,000 ft", () => {
    expect(MIN_ALTITUDE_KM).toBe(0);
    expect(kmToFeet(MAX_ALTITUDE_KM)).toBeCloseTo(20000, 5);
  });
});

describe("convertVo2MaxBetweenAltitudes", () => {
  it("matches the acclimatized worked example: 61 VO2max @ 7,000 ft -> ~67.22 sea level -> ~66.7 @ 1,000 ft", () => {
    const result = convertVo2MaxBetweenAltitudes(61, feetToKm(7000), feetToKm(1000), "acclimatized");
    expect(result.currentCapacityPercent).toBeCloseTo(90.75, 1);
    expect(result.seaLevelVo2Max).toBeCloseTo(67.22, 1);
    expect(result.targetCapacityPercent).toBeCloseTo(99.22, 1);
    expect(result.targetVo2Max).toBeCloseTo(66.7, 1);
  });

  it("matches the unacclimatized worked example: 61 VO2max @ 7,000 ft -> ~70.49 sea level -> ~69.5 @ 1,000 ft", () => {
    const result = convertVo2MaxBetweenAltitudes(61, feetToKm(7000), feetToKm(1000), "unacclimatized");
    expect(result.currentCapacityPercent).toBeCloseTo(86.54, 1);
    expect(result.seaLevelVo2Max).toBeCloseTo(70.49, 1);
    expect(result.targetCapacityPercent).toBeCloseTo(98.63, 1);
    expect(result.targetVo2Max).toBeCloseTo(69.5, 1);
  });

  it("same current and target altitude returns the original VO2max unchanged", () => {
    const altitudeKm = feetToKm(4500);
    const result = convertVo2MaxBetweenAltitudes(55, altitudeKm, altitudeKm, "acclimatized");
    expect(result.targetVo2Max).toBeCloseTo(55, 5);
  });

  it("sea-level to sea-level round-trips exactly", () => {
    const result = convertVo2MaxBetweenAltitudes(60, 0, 0, "unacclimatized");
    expect(result.seaLevelVo2Max).toBeCloseTo(60, 5);
    expect(result.targetVo2Max).toBeCloseTo(60, 5);
  });

  it("works in reverse: sea-level VO2max projected up to altitude", () => {
    // "Current altitude" of 0 still runs through the acclimatized equation's
    // own 99.9% (not exactly 100%) sea-level intercept, so the recovered
    // sea-level baseline is a hair above the input VO2max -- expected, not a bug.
    const result = convertVo2MaxBetweenAltitudes(67.22, 0, feetToKm(7000), "acclimatized");
    expect(result.seaLevelVo2Max).toBeCloseTo(67.29, 1);
    expect(result.targetVo2Max).toBeCloseTo(61, 0);
  });

  it("stays sensible at the top of the supported domain (20,000 ft)", () => {
    const result = convertVo2MaxBetweenAltitudes(60, 0, MAX_ALTITUDE_KM, "unacclimatized");
    expect(result.targetCapacityPercent).toBeGreaterThan(0);
    expect(result.targetVo2Max).toBeGreaterThan(0);
    expect(result.targetVo2Max).toBeLessThan(60);
  });
});

describe("convertTimeBetweenAltitudes", () => {
  it("reproduces the Environmental Performance Calculator's own numbers for the same run", () => {
    // The exact scenario from a real cross-tool discrepancy report: a 10K
    // run in 54:30 (3270s) at 2134m (~7,000ft). The Environmental
    // Performance Calculator displayed "Equivalent Performance in Ideal
    // Conditions: 52:29" for this input -- this must match, since both
    // tools now call the same underlying functions.
    const result = convertTimeBetweenAltitudes(3270, 2134, 0);
    expect(result.seaLevelTimeSeconds).toBeGreaterThan(3148);
    expect(result.seaLevelTimeSeconds).toBeLessThan(3151);
  });

  it("matches marathonImpairmentFraction * altitudeDurationScale directly (no independent formula)", () => {
    const actualTimeSeconds = 3270;
    const altitudeM = 2134;
    const expectedFraction = marathonImpairmentFraction(altitudeM) * altitudeDurationScale(actualTimeSeconds);
    const result = convertTimeBetweenAltitudes(actualTimeSeconds, altitudeM, 0);
    expect(result.currentFraction).toBeCloseTo(expectedFraction, 10);
  });

  it("a run at altitude converts to a faster (lower) time at sea level", () => {
    const result = convertTimeBetweenAltitudes(1200, 2000, 0);
    expect(result.seaLevelTimeSeconds).toBeLessThan(1200);
  });

  it("is slower (not faster) at every higher altitude than the starting point", () => {
    const low = convertTimeBetweenAltitudes(1200, 0, 1000).targetTimeSeconds;
    const high = convertTimeBetweenAltitudes(1200, 0, 3000).targetTimeSeconds;
    expect(high).toBeGreaterThan(low);
    expect(low).toBeGreaterThan(1200);
  });

  it("same current and target altitude returns the original time unchanged", () => {
    const result = convertTimeBetweenAltitudes(1500, 1800, 1800);
    expect(result.targetTimeSeconds).toBeCloseTo(1500, 6);
  });

  it("sea-level to sea-level round-trips exactly", () => {
    const result = convertTimeBetweenAltitudes(1500, 0, 0);
    expect(result.targetTimeSeconds).toBeCloseTo(1500, 6);
  });

  it("round-trips altitude -> sea level -> the same altitude, within a fraction of a percent", () => {
    // Not bit-exact: altitudeDurationScale is evaluated against a slightly
    // different actualTimeSeconds on each leg (1400s going down, the
    // shorter sea-level-equivalent time coming back up), unlike the old
    // scale-invariant flat-percentage model, which always round-tripped
    // exactly. That's an inherent, expected property of reusing a
    // duration-dependent model, not a bug -- the residual here is under
    // 0.05% of the total time.
    const toSeaLevel = convertTimeBetweenAltitudes(1400, 2500, 0);
    const backUp = convertTimeBetweenAltitudes(toSeaLevel.seaLevelTimeSeconds, 0, 2500);
    expect(Math.abs(backUp.targetTimeSeconds - 1400) / 1400).toBeLessThan(0.001);
  });

  it("has no altitude effect at sea level (fraction is zero)", () => {
    const result = convertTimeBetweenAltitudes(1500, 0, 0);
    expect(result.currentFraction).toBe(0);
    expect(result.targetFraction).toBe(0);
  });
});
