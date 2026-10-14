import { describe, expect, it } from "vitest";

import {
  PACE_REFERENCE_KEYS,
  PACE_REFERENCE_LABELS,
  resolvePaceReference,
  formatResolvedPaceText,
  type AthleteMostRecentRace,
} from "@/lib/private-coaching/pace-reference";
import { derivePaceZones, predictRaceTime } from "@/lib/coaching-engine";
import { metersFor, MILE_METERS } from "@/lib/race-distances";
import { formatDate } from "@/lib/format";

const race: AthleteMostRecentRace = {
  id: "r1",
  raceName: "Peachtree 10K",
  raceDate: "2026-07-04",
  distanceM: 10000,
  finishTimeS: 2400, // 40:00 10K
};

describe("resolvePaceReference", () => {
  it("returns null for every reference when the athlete has no race on file", () => {
    for (const key of PACE_REFERENCE_KEYS) {
      expect(resolvePaceReference(key, null)).toBeNull();
    }
  });

  it.each(["easy", "steady", "tempo", "interval"] as const)(
    "converts derivePaceZones' own %s tuple from sec/km to sec/mile exactly",
    (zoneKey) => {
      const zones = derivePaceZones(race.distanceM, race.finishTimeS);
      const [fastSecPerKm, slowSecPerKm] = zones[zoneKey];
      const expectedMin = Math.round(fastSecPerKm * (MILE_METERS / 1000));
      const expectedMax = Math.round(slowSecPerKm * (MILE_METERS / 1000));

      const result = resolvePaceReference(zoneKey, race);
      expect(result?.minSPerMi).toBe(expectedMin);
      expect(result?.maxSPerMi).toBe(expectedMax);
    },
  );

  it.each(["5k", "10k", "half", "marathon"] as const)(
    "resolves a race-equivalent %s reference to a single point value, cross-checked against predictRaceTime",
    (refKey) => {
      const targetMeters = metersFor(refKey);
      const predictedS = predictRaceTime(race.distanceM, race.finishTimeS, targetMeters);
      const expectedPace = Math.round(predictedS / (targetMeters / MILE_METERS));

      const result = resolvePaceReference(refKey, race);
      expect(result?.minSPerMi).toBe(expectedPace);
      expect(result?.maxSPerMi).toBeNull();
    },
  );

  it("round-trips correctly when the reference distance equals the source race's own distance", () => {
    // Riegel with knownMeters === targetMeters returns the known time
    // unchanged -- resolving "10k" from a 10K result shouldn't be
    // special-cased, just fall out of the same math.
    const result = resolvePaceReference("10k", race);
    const expectedPace = Math.round(race.finishTimeS / (race.distanceM / MILE_METERS));
    expect(result?.minSPerMi).toBe(expectedPace);
  });

  it("always returns whole-second paces, never fractional", () => {
    // A race whose math doesn't land on a round number.
    const oddRace: AthleteMostRecentRace = { ...race, distanceM: 8047, finishTimeS: 1837 };
    for (const key of PACE_REFERENCE_KEYS) {
      const result = resolvePaceReference(key, oddRace);
      expect(Number.isInteger(result?.minSPerMi)).toBe(true);
      if (result?.maxSPerMi != null) expect(Number.isInteger(result.maxSPerMi)).toBe(true);
    }
  });

  it("builds the source label from the race's own name and date", () => {
    const result = resolvePaceReference("tempo", race);
    expect(result?.sourceLabel).toBe(`Peachtree 10K · ${formatDate(race.raceDate)}`);
  });
});

describe("formatResolvedPaceText", () => {
  it("renders a resolved range", () => {
    expect(formatResolvedPaceText({ minSPerMi: 390, maxSPerMi: 405, sourceLabel: "x" }, "Threshold Pace")).toBe(
      "6:30–6:45/mi (Threshold Pace)",
    );
  });

  it("renders a resolved point value (no max) without a dash", () => {
    expect(formatResolvedPaceText({ minSPerMi: 375, maxSPerMi: null, sourceLabel: "x" }, "5K Pace")).toBe("6:15/mi (5K Pace)");
  });

  it("renders the unresolved state without inventing a number", () => {
    expect(formatResolvedPaceText(null, "Threshold Pace")).toBe("Threshold Pace — no race on file yet");
  });
});

describe("PACE_REFERENCE_LABELS", () => {
  it("has a label for every key", () => {
    for (const key of PACE_REFERENCE_KEYS) {
      expect(PACE_REFERENCE_LABELS[key]).toBeTruthy();
    }
  });
});
