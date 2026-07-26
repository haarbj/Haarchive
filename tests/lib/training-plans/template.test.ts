import { describe, expect, it } from "vitest";

import { hasDistancePlaceholder, renderDescription, scaleDistance, scaleForTargetPeak } from "@/lib/training-plans/template";

describe("scaleForTargetPeak", () => {
  it("returns 1 when the target equals the reference (no change)", () => {
    expect(scaleForTargetPeak(50, 50)).toBeCloseTo(1, 10);
  });

  it("scales down for a lower target and up for a higher one", () => {
    expect(scaleForTargetPeak(50, 25)).toBeCloseTo(0.5, 10);
    expect(scaleForTargetPeak(50, 100)).toBeCloseTo(2, 10);
  });

  it("preserves day-to-day proportions regardless of the unit the target is expressed in -- see template.ts's own comment", () => {
    // A reference plan peaking at 40 (reference) miles, with a day worth
    // 6 reference miles (15% of peak). Targeting a 60 km peak should scale
    // that same day to 15% of 60, i.e. 9.0 -- with no separate mi<->km
    // conversion constant needed anywhere.
    const scale = scaleForTargetPeak(40, 60);
    expect(scaleDistance(6, scale)).toBeCloseTo(9.0, 5);
  });
});

describe("scaleDistance", () => {
  it("multiplies the reference value by the scale factor", () => {
    expect(scaleDistance(8, 1.5)).toBeCloseTo(12, 10);
  });
});

describe("renderDescription", () => {
  it("rounds and substitutes multiplier placeholders, and substitutes the unit label", () => {
    const result = renderDescription("[[ 6 * multiplier|number:0 ]]-[[ 8 * multiplier|number:0 ]] [[ units ]] easy", 1.25, "mi");
    expect(result).toBe("8-10 mi easy");
  });

  it("substitutes the km label when km is selected", () => {
    const result = renderDescription("[[ 5 * multiplier|number:0 ]] [[ units ]] very easy", 1, "km");
    expect(result).toBe("5 km very easy");
  });

  it("leaves a description with no placeholders completely unchanged -- e.g. a %5K interval session", () => {
    const description = "7 × 3 min at 90–92% 5k with 1 min jog";
    expect(renderDescription(description, 1.4, "mi")).toBe(description);
  });

  it("rounds to the nearest whole number, matching the source data's own |number:0 filter", () => {
    const result = renderDescription("[[ 7 * multiplier|number:0 ]] [[ units ]]", 1.05, "mi");
    // 7 * 1.05 = 7.35 -> rounds to 7
    expect(result).toBe("7 mi");
  });
});

describe("hasDistancePlaceholder", () => {
  it("detects a mileage-based day", () => {
    expect(hasDistancePlaceholder("[[ 6 * multiplier|number:0 ]] [[ units ]] easy")).toBe(true);
  });

  it("returns false for a quality session or rest day", () => {
    expect(hasDistancePlaceholder("7 × 3 min at 90–92% 5k with 1 min jog")).toBe(false);
    expect(hasDistancePlaceholder("Rest")).toBe(false);
  });
});
