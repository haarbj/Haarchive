import { describe, expect, it } from "vitest";

import {
  MAX_ALTITUDE_KM,
  MIN_ALTITUDE_KM,
  acclimatizationBlendFraction,
  acclimatizedCapacityPercent,
  altitudeToKm,
  capacityPercentAtAltitude,
  convertTimeBetweenAltitudes,
  convertVo2MaxBetweenAltitudes,
  convertWorkoutSplits,
  feetToKm,
  homeAltitudeImpairmentMultiplier,
  isAltitudeInModelDomain,
  kmToAltitude,
  kmToFeet,
  kmToMeters,
  metersToKm,
  parseWorkoutSplitsInput,
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

describe("convertWorkoutSplits", () => {
  it("converts each split independently, matching a direct convertTimeBetweenAltitudes call per split", () => {
    // The user's own worked example: 7 one-mile splits (8:00 down to 5:55)
    // run at 7,000ft, converted to sea level.
    const splitSeconds = [480, 450, 420, 390, 375, 365, 355]; // 8:00, 7:30, 7:00, 6:30, 6:15, 6:05, 5:55
    const altitudeM = kmToMeters(feetToKm(7000));
    const results = convertWorkoutSplits(splitSeconds, altitudeM, 0);

    expect(results).toHaveLength(7);
    results.forEach((result, i) => {
      const direct = convertTimeBetweenAltitudes(splitSeconds[i], altitudeM, 0);
      expect(result.actualTimeSeconds).toBe(splitSeconds[i]);
      expect(result.targetTimeSeconds).toBeCloseTo(direct.targetTimeSeconds, 8);
      expect(result.index).toBe(i);
    });
  });

  it("every split gets faster (lower time) converting from altitude down to sea level", () => {
    const splitSeconds = [480, 450, 420, 390, 375, 365, 355];
    const altitudeM = kmToMeters(feetToKm(7000));
    const results = convertWorkoutSplits(splitSeconds, altitudeM, 0);
    results.forEach((result, i) => expect(result.targetTimeSeconds).toBeLessThan(splitSeconds[i]));
  });

  it("does not blend all splits into one averaged duration -- a short split and a long split scale differently", () => {
    // If this incorrectly converted the *total* workout time as one effort,
    // every split would be scaled by the exact same fraction. Converting
    // per-split means a much longer effort (closer to the 5K/marathon
    // anchors) gets a different fractional cost than a short one (closer
    // to the Mile anchor) -- proving the two aren't just multiplied by a
    // shared constant.
    const altitudeM = kmToMeters(feetToKm(7000));
    const shortSplit = convertTimeBetweenAltitudes(300, altitudeM, 0); // 5-minute effort
    const longSplit = convertTimeBetweenAltitudes(1400, altitudeM, 0); // ~23-minute effort
    const shortFractionOfActual = (shortSplit.actualTimeSeconds - shortSplit.targetTimeSeconds) / shortSplit.actualTimeSeconds;
    const longFractionOfActual = (longSplit.actualTimeSeconds - longSplit.targetTimeSeconds) / longSplit.actualTimeSeconds;
    expect(longFractionOfActual).toBeGreaterThan(shortFractionOfActual);
  });

  it("returns an empty array for an empty split list", () => {
    expect(convertWorkoutSplits([], 2000, 0)).toEqual([]);
  });

  it("same current and target altitude leaves every split's time unchanged", () => {
    const results = convertWorkoutSplits([480, 355], 1800, 1800);
    expect(results[0].targetTimeSeconds).toBeCloseTo(480, 6);
    expect(results[1].targetTimeSeconds).toBeCloseTo(355, 6);
  });
});

describe("parseWorkoutSplitsInput", () => {
  it("parses a comma-separated line of splits, matching the user's own example", () => {
    const result = parseWorkoutSplitsInput("8:00, 7:30, 7:00, 6:30, 6:15, 6:05, 5:55");
    expect(result).toEqual([480, 450, 420, 390, 375, 365, 355]);
  });

  it("parses one split per line", () => {
    const result = parseWorkoutSplitsInput("8:00\n7:30\n7:00");
    expect(result).toEqual([480, 450, 420]);
  });

  it("handles a mix of newlines and commas, and tolerates extra whitespace", () => {
    const result = parseWorkoutSplitsInput(" 8:00 ,7:30\n 7:00 , 6:30");
    expect(result).toEqual([480, 450, 420, 390]);
  });

  it("supports h:mm:ss for a long split", () => {
    expect(parseWorkoutSplitsInput("1:05:00")).toEqual([3900]);
  });

  it("ignores blank lines/trailing separators rather than producing a null entry for them", () => {
    const result = parseWorkoutSplitsInput("8:00,,7:30,\n\n7:00");
    expect(result).toEqual([480, 450, 420]);
  });

  it("returns null for an entry that isn't a valid time, at its own position", () => {
    const result = parseWorkoutSplitsInput("8:00, not-a-time, 7:00");
    expect(result).toEqual([480, null, 420]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseWorkoutSplitsInput("")).toEqual([]);
    expect(parseWorkoutSplitsInput("   ")).toEqual([]);
  });
});

describe("acclimatizationBlendFraction", () => {
  it("is 0 (fully unacclimatized) for a sea-level home racing at altitude", () => {
    expect(acclimatizationBlendFraction(0, 2000)).toBe(0);
  });

  it("is 1 (fully acclimatized) for a home altitude at or above the race altitude", () => {
    expect(acclimatizationBlendFraction(2000, 2000)).toBe(1);
    expect(acclimatizationBlendFraction(3000, 2000)).toBe(1);
  });

  it("is linear in between", () => {
    expect(acclimatizationBlendFraction(1000, 2000)).toBeCloseTo(0.5, 10);
  });

  it("treats a race at or below sea level as trivially fully acclimatized (no altitude to acclimate to)", () => {
    expect(acclimatizationBlendFraction(1000, 0)).toBe(1);
  });

  it("never goes negative for a below-sea-level home altitude", () => {
    expect(acclimatizationBlendFraction(-100, 2000)).toBe(0);
  });
});

describe("homeAltitudeImpairmentMultiplier", () => {
  const raceAltitudeM = kmToMeters(feetToKm(7000));

  it("is 1 (full penalty) for a sea-level home -- reproducing today's unacclimatized-by-default behavior", () => {
    expect(homeAltitudeImpairmentMultiplier(0, raceAltitudeM)).toBeCloseTo(1, 10);
  });

  it("is less than 1 (a real discount) for a home altitude at the race altitude", () => {
    const multiplier = homeAltitudeImpairmentMultiplier(raceAltitudeM, raceAltitudeM);
    expect(multiplier).toBeLessThan(1);
    // Matches the ratio of the two already-tested capacity-percent curves
    // at 7,000ft directly (86.54% unacclimatized / 90.75% acclimatized),
    // not a new, independently-chosen number.
    expect(multiplier).toBeCloseTo(86.54 / 90.75, 2);
  });

  it("is monotonically between the sea-level-home and race-altitude-home cases for a partial home altitude", () => {
    const none = homeAltitudeImpairmentMultiplier(0, raceAltitudeM);
    const partial = homeAltitudeImpairmentMultiplier(raceAltitudeM / 2, raceAltitudeM);
    const full = homeAltitudeImpairmentMultiplier(raceAltitudeM, raceAltitudeM);
    expect(partial).toBeLessThan(none);
    expect(partial).toBeGreaterThan(full);
  });

  it("returns exactly 1 for a race at or below sea level", () => {
    expect(homeAltitudeImpairmentMultiplier(2000, 0)).toBe(1);
  });
});

describe("convertTimeBetweenAltitudes with a home altitude", () => {
  it("defaults to sea level (fully unacclimatized), reproducing the exact prior 3-argument behavior", () => {
    const withDefault = convertTimeBetweenAltitudes(1200, 2134, 0);
    const explicitSeaLevel = convertTimeBetweenAltitudes(1200, 2134, 0, 0);
    expect(explicitSeaLevel).toEqual(withDefault);
  });

  it("a partially-acclimatized athlete (home near the race altitude) gets a smaller altitude penalty than a sea-level-home athlete", () => {
    const raceAltitudeM = kmToMeters(feetToKm(7000));
    const unacclimatized = convertTimeBetweenAltitudes(1200, raceAltitudeM, 0, 0);
    const acclimatized = convertTimeBetweenAltitudes(1200, raceAltitudeM, 0, raceAltitudeM);
    // A smaller penalty converting down to sea level means a *slower*
    // (larger) recovered sea-level time is not implied here -- less
    // penalty means less of the actual time gets attributed to altitude,
    // so the recovered sea-level time is closer to the actual time.
    expect(acclimatized.seaLevelTimeSeconds).toBeGreaterThan(unacclimatized.seaLevelTimeSeconds);
  });

  it("home altitude is applied independently at the current and target altitude, not one shared value", () => {
    // Same home altitude (3,000ft), two different race altitudes -- the
    // multiplier at each is computed from that altitude's own
    // acclimatized/unacclimatized gap, not a single number reused for
    // both. (Perhaps counterintuitively, full acclimatization credit at a
    // low altitude -- home >= race -- can land closer to 1 than partial
    // credit at a high one, since there's very little gap between the two
    // curves to "buy back" at low altitude in the first place; the point
    // here is that the two values are independently derived, not that one
    // is reliably bigger than the other.)
    const home = kmToMeters(feetToKm(3000));
    const multiplierAt7000 = homeAltitudeImpairmentMultiplier(home, kmToMeters(feetToKm(7000)));
    const multiplierAt1000 = homeAltitudeImpairmentMultiplier(home, kmToMeters(feetToKm(1000)));
    expect(multiplierAt7000).not.toBeCloseTo(multiplierAt1000, 3);
  });
});

describe("convertWorkoutSplits with a home altitude", () => {
  it("defaults to sea level, matching the exact prior 3-argument behavior", () => {
    const splits = [480, 420, 360];
    const withDefault = convertWorkoutSplits(splits, 2134, 0);
    const explicitSeaLevel = convertWorkoutSplits(splits, 2134, 0, 0);
    expect(explicitSeaLevel).toEqual(withDefault);
  });

  it("threads a home altitude through to every split identically", () => {
    const splits = [480, 420];
    const home = kmToMeters(feetToKm(5000));
    const currentAltitudeM = kmToMeters(feetToKm(7000));
    const results = convertWorkoutSplits(splits, currentAltitudeM, 0, home);
    results.forEach((result, i) => {
      const direct = convertTimeBetweenAltitudes(splits[i], currentAltitudeM, 0, home);
      expect(result.targetTimeSeconds).toBeCloseTo(direct.targetTimeSeconds, 8);
    });
  });
});
