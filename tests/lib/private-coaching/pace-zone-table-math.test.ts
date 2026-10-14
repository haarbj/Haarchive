import { describe, expect, it } from "vitest";

import { computeWorkoutPaceSeconds, formatPaceOutput, parsePaceInput } from "@/lib/pace-percent-math";
import {
  altitudeAdjustPaceSeconds,
  computeZoneBounds,
  isValidPercentRow,
  type PaceZoneRow,
} from "@/lib/private-coaching/pace-zone-table-math";

const MILE_METERS = 1609.344;

function pace(mmss: string): number {
  return parsePaceInput(mmss, "mi")!;
}

describe("computeZoneBounds", () => {
  // The exact worked example from the feature request: a 5:24/mi 5K pace
  // and four named zones, checked against the exact paces given.
  const referenceSeconds = pace("5:24");

  it("Very easy (<50%): fast edge only, matches 8:06", () => {
    const row: PaceZoneRow = { label: "Very easy", minPercent: null, maxPercent: 50 };
    const bounds = computeZoneBounds(referenceSeconds, row);
    expect(formatPaceOutput(bounds.fastSeconds!, "mi")).toBe("8:06");
    expect(bounds.slowSeconds).toBeNull();
  });

  it("Easy (50-60%): matches 7:34-8:06", () => {
    const row: PaceZoneRow = { label: "Easy", minPercent: 50, maxPercent: 60 };
    const bounds = computeZoneBounds(referenceSeconds, row);
    expect(formatPaceOutput(bounds.fastSeconds!, "mi")).toBe("7:34");
    expect(formatPaceOutput(bounds.slowSeconds!, "mi")).toBe("8:06");
  });

  it("Moderate (60-75%): matches 6:45-7:34", () => {
    const row: PaceZoneRow = { label: "Moderate", minPercent: 60, maxPercent: 75 };
    const bounds = computeZoneBounds(referenceSeconds, row);
    expect(formatPaceOutput(bounds.fastSeconds!, "mi")).toBe("6:45");
    expect(formatPaceOutput(bounds.slowSeconds!, "mi")).toBe("7:34");
  });

  it("Steady (75-80%): matches 6:29-6:45", () => {
    const row: PaceZoneRow = { label: "Steady", minPercent: 75, maxPercent: 80 };
    const bounds = computeZoneBounds(referenceSeconds, row);
    expect(formatPaceOutput(bounds.fastSeconds!, "mi")).toBe("6:29");
    expect(formatPaceOutput(bounds.slowSeconds!, "mi")).toBe("6:45");
  });

  it("a row with only the low % filled (high % left blank) is one exact pace, not an open range", () => {
    const row: PaceZoneRow = { label: "Marathon Pace", minPercent: 95, maxPercent: null };
    const bounds = computeZoneBounds(referenceSeconds, row);
    expect(bounds.fastSeconds).not.toBeNull();
    expect(bounds.slowSeconds).toBe(bounds.fastSeconds);
    expect(bounds.isExact).toBe(true);
    expect(formatPaceOutput(bounds.fastSeconds!, "mi")).toBe(
      formatPaceOutput(computeWorkoutPaceSeconds(referenceSeconds, 95, "pace"), "mi"),
    );
  });

  it("a row with only the high % filled (low % left blank) keeps its open-below meaning", () => {
    const row: PaceZoneRow = { label: "Very easy", minPercent: null, maxPercent: 50 };
    const bounds = computeZoneBounds(referenceSeconds, row);
    expect(bounds.fastSeconds).not.toBeNull();
    expect(bounds.slowSeconds).toBeNull();
    expect(bounds.isExact).toBe(false);
  });

  it("a row with equal low % and high % is also exact", () => {
    const row: PaceZoneRow = { label: "Threshold", minPercent: 88, maxPercent: 88 };
    const bounds = computeZoneBounds(referenceSeconds, row);
    expect(bounds.fastSeconds).toBe(bounds.slowSeconds);
    expect(bounds.isExact).toBe(true);
  });

  it("a real range (different low/high %) is not exact", () => {
    const row: PaceZoneRow = { label: "Easy", minPercent: 50, maxPercent: 60 };
    const bounds = computeZoneBounds(referenceSeconds, row);
    expect(bounds.isExact).toBe(false);
  });
});

describe("isValidPercentRow", () => {
  it("rejects a row with neither bound set", () => {
    expect(isValidPercentRow({ label: "x", minPercent: null, maxPercent: null })).toBe(false);
  });

  it("accepts an open-below row", () => {
    expect(isValidPercentRow({ label: "x", minPercent: null, maxPercent: 50 })).toBe(true);
  });

  it("accepts a low-only (exact) row", () => {
    expect(isValidPercentRow({ label: "x", minPercent: 95, maxPercent: null })).toBe(true);
  });

  it("accepts equal low and high % (also exact)", () => {
    expect(isValidPercentRow({ label: "x", minPercent: 60, maxPercent: 60 })).toBe(true);
  });

  it("rejects a row where min exceeds max", () => {
    expect(isValidPercentRow({ label: "x", minPercent: 80, maxPercent: 60 })).toBe(false);
  });

  it("rejects an out-of-range percent", () => {
    expect(isValidPercentRow({ label: "x", minPercent: 0, maxPercent: 50 })).toBe(false);
    expect(isValidPercentRow({ label: "x", minPercent: 50, maxPercent: 301 })).toBe(false);
  });
});

describe("altitudeAdjustPaceSeconds", () => {
  it("a sea-level home altitude (0ft) leaves the pace unchanged", () => {
    const seconds = pace("6:00");
    const adjusted = altitudeAdjustPaceSeconds(seconds, MILE_METERS, 5000, 0);
    expect(adjusted).toBeCloseTo(seconds, 6);
  });

  it("a real altitude (7,000ft) slows the equivalent pace down", () => {
    const seconds = pace("6:00");
    const adjusted = altitudeAdjustPaceSeconds(seconds, MILE_METERS, 5000, 7000);
    expect(adjusted).toBeGreaterThan(seconds);
  });

  it("higher altitude produces a larger slowdown than a lower altitude", () => {
    const seconds = pace("6:00");
    const at5000ft = altitudeAdjustPaceSeconds(seconds, MILE_METERS, 5000, 5000);
    const at9000ft = altitudeAdjustPaceSeconds(seconds, MILE_METERS, 5000, 9000);
    expect(at9000ft).toBeGreaterThan(at5000ft);
  });

  it("5K and marathon reference distances produce the same adjustment ratio (both are >=5000m, where the aerobic-contribution fraction is 1)", () => {
    const seconds = pace("6:00");
    const marathonMeters = 42195;
    const via5k = altitudeAdjustPaceSeconds(seconds, MILE_METERS, 5000, 7000);
    const viaMarathon = altitudeAdjustPaceSeconds(seconds, MILE_METERS, marathonMeters, 7000);
    expect(via5k).toBeCloseTo(viaMarathon, 6);
  });
});
