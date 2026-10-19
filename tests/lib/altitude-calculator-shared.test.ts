import { describe, expect, it } from "vitest";

import { resolveHomeAltitudeKm, resolveTargetAltitudeKm } from "@/lib/altitude-calculator-shared";
import {
  altitudeToKm,
  capacityPercentAtAltitude,
  convertTimeBetweenAltitudes,
  convertVo2MaxBetweenAltitudes,
  kmToMeters,
} from "@/lib/altitude-vo2max-math";
import { convertPerformanceBetweenAltitudes, type AltitudeConversionInput } from "@/lib/altitude-adjusted-pace-math";

describe("resolveHomeAltitudeKm", () => {
  it("'sea' always resolves to 0 km, matching both original tools' default (fully unacclimatized)", () => {
    expect(resolveHomeAltitudeKm("sea", 5, 3)).toBe(0);
    expect(resolveHomeAltitudeKm("sea", null, null)).toBe(0);
  });

  it("'same' resolves to the current elevation", () => {
    expect(resolveHomeAltitudeKm("same", null, 2.5)).toBe(2.5);
    expect(resolveHomeAltitudeKm("same", 99, 2.5)).toBe(2.5);
  });

  it("'other' resolves to the custom value, or null when not yet entered", () => {
    expect(resolveHomeAltitudeKm("other", 1.2, 3)).toBe(1.2);
    expect(resolveHomeAltitudeKm("other", null, 3)).toBeNull();
  });
});

describe("resolveTargetAltitudeKm", () => {
  it("'none' always resolves to null -- distinct from a real 0 km (sea level) target", () => {
    expect(resolveTargetAltitudeKm("none", 5, 0)).toBeNull();
    expect(resolveTargetAltitudeKm("none", null, null)).toBeNull();
  });

  it("'sea' resolves to 0 km, a real target, not 'no target'", () => {
    expect(resolveTargetAltitudeKm("sea", 5, 3)).toBe(0);
  });

  it("'home' resolves to the already-resolved home altitude", () => {
    expect(resolveTargetAltitudeKm("home", null, 1.8)).toBe(1.8);
    expect(resolveTargetAltitudeKm("home", 99, 1.8)).toBe(1.8);
  });

  it("'other' resolves to the custom value, or null when not yet entered", () => {
    expect(resolveTargetAltitudeKm("other", 4, 1)).toBe(4);
    expect(resolveTargetAltitudeKm("other", null, 1)).toBeNull();
  });
});

// --- Pinning: the unified tool's wiring must reproduce each original
// standalone tool's own math exactly for the same inputs -- no drift.

describe("VO2max mode matches the original Altitude Calculator's own math", () => {
  it("resolves 'sea' target + convertVo2MaxBetweenAltitudes identically to a direct call with target=0", () => {
    const altitudeKm = altitudeToKm(7000, "ft"); // the unified tool's own default current elevation
    const homeAltitudeKm = resolveHomeAltitudeKm("sea", null, altitudeKm); // irrelevant to VO2max mode, but shared
    const targetAltitudeKm = resolveTargetAltitudeKm("sea", null, homeAltitudeKm);
    expect(targetAltitudeKm).toBe(0);

    const viaResolution = convertVo2MaxBetweenAltitudes(61, altitudeKm, targetAltitudeKm!, "acclimatized");
    const direct = convertVo2MaxBetweenAltitudes(61, altitudeKm, 0, "acclimatized");
    expect(viaResolution).toEqual(direct);
  });

  it("'none' target falls back to the current elevation (no target shown), matching the original blank-target default", () => {
    const altitudeKm = altitudeToKm(7000, "ft");
    const targetAltitudeKm = resolveTargetAltitudeKm("none", null, 0);
    expect(targetAltitudeKm).toBeNull();
    // The component's own fallback when there's no target: convert to itself.
    const result = convertVo2MaxBetweenAltitudes(61, altitudeKm, altitudeKm, "acclimatized");
    expect(result.targetVo2Max).toBeCloseTo(61, 6);
  });

  it("capacity percent at the default 7,000ft is still exactly the original acclimatized/unacclimatized curve", () => {
    const altitudeKm = altitudeToKm(7000, "ft");
    expect(capacityPercentAtAltitude(altitudeKm, "acclimatized")).toBeCloseTo(-1.12 * altitudeKm ** 2 - 1.9 * altitudeKm + 99.9, 9);
    expect(capacityPercentAtAltitude(altitudeKm, "unacclimatized")).toBeCloseTo(
      0.178 * altitudeKm ** 3 - 1.43 * altitudeKm ** 2 - 4.07 * altitudeKm + 100,
      9,
    );
  });
});

describe("Performance mode's primary model matches the original Altitude Calculator's own math", () => {
  const FIVE_K_METERS = 5000;
  const PACE_SEC_PER_MI = 6 * 60 + 0; // 6:00/mi
  const MILE_METERS = 1609.344;

  it("resolves home='sea' + target='sea' and reproduces convertTimeBetweenAltitudes exactly", () => {
    const altitudeKm = altitudeToKm(7000, "ft");
    const homeAltitudeKm = resolveHomeAltitudeKm("sea", null, altitudeKm);
    const targetAltitudeKm = resolveTargetAltitudeKm("sea", null, homeAltitudeKm);
    expect(homeAltitudeKm).toBe(0);
    expect(targetAltitudeKm).toBe(0);

    const actualTimeSeconds = (PACE_SEC_PER_MI / MILE_METERS) * FIVE_K_METERS;
    const viaResolution = convertTimeBetweenAltitudes(actualTimeSeconds, kmToMeters(altitudeKm), kmToMeters(targetAltitudeKm!), kmToMeters(homeAltitudeKm!));
    const direct = convertTimeBetweenAltitudes(actualTimeSeconds, kmToMeters(altitudeKm), 0, 0);
    expect(viaResolution).toEqual(direct);
  });

  it("'same' home altitude resolves to the current elevation, giving the full acclimatization discount", () => {
    const altitudeKm = altitudeToKm(7000, "ft");
    const homeAltitudeKm = resolveHomeAltitudeKm("same", null, altitudeKm);
    expect(homeAltitudeKm).toBe(altitudeKm);

    const actualTimeSeconds = (PACE_SEC_PER_MI / MILE_METERS) * FIVE_K_METERS;
    const fullyAcclimated = convertTimeBetweenAltitudes(actualTimeSeconds, kmToMeters(altitudeKm), 0, kmToMeters(homeAltitudeKm!));
    const fullyUnacclimatized = convertTimeBetweenAltitudes(actualTimeSeconds, kmToMeters(altitudeKm), 0, 0);
    // A full-time local resident should see a smaller (or equal) altitude
    // penalty than someone with no acclimation at all.
    expect(fullyAcclimated.currentFraction).toBeLessThanOrEqual(fullyUnacclimatized.currentFraction);
  });
});

describe("Performance mode's second model (Running Writings) matches the original Altitude-Adjusted Pace Calculator's own math", () => {
  const FIVE_K_METERS = 5000;
  const PACE_SEC_PER_MI = 6 * 60;
  const MILE_METERS = 1609.344;

  it("reproduces convertPerformanceBetweenAltitudes exactly, fed the same resolved venue/home/target as the primary model", () => {
    const altitudeKm = altitudeToKm(5000, "ft"); // the old standalone tool's own default venue
    const homeAltitudeKm = resolveHomeAltitudeKm("sea", null, altitudeKm);
    const targetAltitudeKm = resolveTargetAltitudeKm("sea", null, homeAltitudeKm);
    const actualTimeSeconds = (PACE_SEC_PER_MI / MILE_METERS) * FIVE_K_METERS;

    const input: AltitudeConversionInput = {
      distanceMeters: FIVE_K_METERS,
      timeSeconds: actualTimeSeconds,
      venueAltitudeMeters: kmToMeters(altitudeKm),
      homeAltitudeMeters: kmToMeters(homeAltitudeKm!),
      targetAltitudeMeters: kmToMeters(targetAltitudeKm!),
    };
    const viaResolution = convertPerformanceBetweenAltitudes(input);
    const direct = convertPerformanceBetweenAltitudes({
      distanceMeters: FIVE_K_METERS,
      timeSeconds: actualTimeSeconds,
      venueAltitudeMeters: kmToMeters(altitudeKm),
      homeAltitudeMeters: 0,
      targetAltitudeMeters: 0,
    });
    expect(viaResolution).toBeCloseTo(direct, 9);
  });

  it("'home' target mode resolves to the already-resolved home altitude, not a separate input", () => {
    const altitudeKm = altitudeToKm(5000, "ft");
    const homeAltitudeKm = resolveHomeAltitudeKm("other", altitudeToKm(2000, "ft"), altitudeKm);
    const targetAltitudeKm = resolveTargetAltitudeKm("home", null, homeAltitudeKm);
    expect(targetAltitudeKm).toBe(homeAltitudeKm);
  });

  it("disagrees with the primary (Daniels-table) model for the same nominal altitude -- neither model is silently discarded or forced to match", () => {
    const altitudeKm = altitudeToKm(10000, "ft"); // a high-ish altitude where the two sources diverge more
    const actualTimeSeconds = (PACE_SEC_PER_MI / MILE_METERS) * FIVE_K_METERS;

    const primary = convertTimeBetweenAltitudes(actualTimeSeconds, kmToMeters(altitudeKm), 0, 0);
    const second = convertPerformanceBetweenAltitudes({
      distanceMeters: FIVE_K_METERS,
      timeSeconds: actualTimeSeconds,
      venueAltitudeMeters: kmToMeters(altitudeKm),
      homeAltitudeMeters: 0,
      targetAltitudeMeters: 0,
    });
    // Both are real, legitimate, differently-sourced estimates -- they are
    // not expected to agree, and this test exists specifically to catch a
    // future "simplification" that accidentally makes them identical
    // (which would mean one of the two models silently stopped being used).
    expect(Math.abs(primary.seaLevelTimeSeconds - second)).toBeGreaterThan(0.01);
  });
});
