import { describe, expect, it } from "vitest";

import { getExtraFieldShape, isSuggestedExtraKind, emptyExtra, ALL_FIELDS_SHAPE } from "@/lib/private-coaching/extras";

describe("getExtraFieldShape", () => {
  it("gives Strides the rep-based shape (count/distance/duration, no items)", () => {
    expect(getExtraFieldShape("Strides")).toEqual({
      showCount: true,
      showDistance: true,
      showDuration: true,
      showItems: false,
    });
  });

  it("gives Drills, Mobility, Plyos, and Strength the itemized shape (overview/items, no count/distance/duration)", () => {
    const itemized = { showCount: false, showDistance: false, showDuration: false, showItems: true };
    expect(getExtraFieldShape("Drills")).toEqual(itemized);
    expect(getExtraFieldShape("Mobility")).toEqual(itemized);
    expect(getExtraFieldShape("Plyos")).toEqual(itemized);
    expect(getExtraFieldShape("Strength")).toEqual(itemized);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(getExtraFieldShape("  strides  ")).toEqual(getExtraFieldShape("Strides"));
    expect(getExtraFieldShape("DRILLS")).toEqual(getExtraFieldShape("Drills"));
  });

  it("defaults a free-typed kind outside the suggested list to no structured fields -- most (mental techniques, self-care, hips, core) only need a note", () => {
    expect(getExtraFieldShape("Mental Techniques")).toEqual({
      showCount: false,
      showDistance: false,
      showDuration: false,
      showItems: false,
    });
  });
});

describe("isSuggestedExtraKind", () => {
  it("recognizes a suggested kind case- and whitespace-insensitively", () => {
    expect(isSuggestedExtraKind("Strides")).toBe(true);
    expect(isSuggestedExtraKind("  drills  ")).toBe(true);
  });

  it("does not recognize a free-typed kind", () => {
    expect(isSuggestedExtraKind("Hill Sprints")).toBe(false);
  });
});

describe("ALL_FIELDS_SHAPE", () => {
  it("shows every structured field -- used when a coach explicitly expands an unrecognized kind's detail", () => {
    expect(ALL_FIELDS_SHAPE).toEqual({ showCount: true, showDistance: true, showDuration: true, showItems: true });
  });
});

describe("emptyExtra", () => {
  it("defaults every field to empty/null", () => {
    expect(emptyExtra()).toEqual({ kind: "", overview: null, count: null, distanceM: null, durationS: null, items: [] });
  });

  it("accepts a starting kind", () => {
    expect(emptyExtra("Strides").kind).toBe("Strides");
  });
});
