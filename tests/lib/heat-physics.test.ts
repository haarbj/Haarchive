import { describe, expect, it } from "vitest";

import {
  cToF,
  estimateWBGT,
  HEAT_HUMIDITY_AMPLIFY_F,
  HEAT_IMPAIR_START_F,
  heatGuidance,
  heatZoneFor,
} from "@/lib/heat-physics";

describe("estimateWBGT", () => {
  it("increases with both temperature and humidity", () => {
    expect(estimateWBGT(30, 80)).toBeGreaterThan(estimateWBGT(20, 80));
    expect(estimateWBGT(30, 80)).toBeGreaterThan(estimateWBGT(30, 30));
  });
});

describe("cToF", () => {
  it("converts known reference points", () => {
    expect(cToF(0)).toBe(32);
    expect(cToF(100)).toBe(212);
  });
});

describe("heatZoneFor", () => {
  it("classifies cold, under 35°F, separately from the ideal band", () => {
    expect(heatZoneFor(cToFInverse(20)).name).toBe("cold");
  });

  it("classifies the 35-55°F ideal band as green", () => {
    expect(heatZoneFor(cToFInverse(40)).name).toBe("green");
    expect(heatZoneFor(cToFInverse(50)).name).toBe("green");
  });

  it("classifies into the correct marathon-performance-calibrated flag zone", () => {
    expect(heatZoneFor(10).name).toBe("green");
    expect(heatZoneFor(20).name).toBe("yellow");
    expect(heatZoneFor(25).name).toBe("red");
    expect(heatZoneFor(30).name).toBe("black");
  });

  it("treats the boundary itself as the next zone up (exclusive upper bound)", () => {
    expect(heatZoneFor(18).name).toBe("yellow");
  });

  it("puts 60°F and above (the heat-impairment start) at or past the yellow zone", () => {
    const wbgtAt60F = cToFInverse(HEAT_IMPAIR_START_F);
    expect(["yellow", "red", "black"]).toContain(heatZoneFor(wbgtAt60F).name);
  });

  it("puts 70°F and above (where humidity's amplifying effect is strongest) in yellow or hotter", () => {
    const wbgtAt70F = cToFInverse(HEAT_HUMIDITY_AMPLIFY_F);
    expect(["yellow", "red", "black"]).toContain(heatZoneFor(wbgtAt70F).name);
  });

  it("puts 80°F and above in the black flag zone", () => {
    expect(heatZoneFor(cToFInverse(80)).name).toBe("black");
  });
});

describe("heatGuidance", () => {
  it("returns distinct guidance for each zone", () => {
    const titles = new Set(
      [
        heatGuidance(cToFInverse(20), "cold"),
        heatGuidance(8, "green"),
        heatGuidance(20, "yellow"),
        heatGuidance(25, "red"),
        heatGuidance(30, "black"),
      ].map((g) => g.title),
    );
    expect(titles.size).toBe(5);
  });

  it("gives the cold zone a gear note instead of a heat warning", () => {
    const guidance = heatGuidance(cToFInverse(20), "cold");
    expect(guidance.sub.toLowerCase()).toContain("gear");
    expect(guidance.raceTip).toBeUndefined();
  });

  it("does not flag the ideal 35-55°F band as impaired", () => {
    const guidance = heatGuidance(cToFInverse(45), "green");
    expect(guidance.title.toLowerCase()).toContain("ideal");
    expect(guidance.raceTip).toBeUndefined();
  });

  it("only starts surfacing heat-impairment guidance once past 60°F", () => {
    const belowImpair = heatGuidance(cToFInverse(57), "yellow");
    expect(belowImpair.title.toLowerCase()).not.toContain("cost");
    expect(belowImpair.raceTip).toBeUndefined();

    const aboveImpair = heatGuidance(cToFInverse(65), "yellow");
    expect(aboveImpair.sub).toContain("60°F");
    expect(aboveImpair.raceTip).toBeDefined();
  });

  it("surfaces a conservative, effort-over-pace race tip in the hot zones", () => {
    const yellowHot = heatGuidance(cToFInverse(65), "yellow");
    const red = heatGuidance(cToFInverse(75), "red");
    expect(yellowHot.raceTip).toMatch(/effort/i);
    expect(yellowHot.raceTip).toMatch(/5-8 miles/i);
    expect(red.raceTip).toMatch(/effort/i);
  });

  it("gives drink-to-thirst hydration guidance, not a fixed schedule, once heat matters", () => {
    const guidance = heatGuidance(cToFInverse(65), "yellow");
    expect(guidance.sub.toLowerCase()).toContain("thirst");
  });

  it("softens the heat-zone guidance when the runner is heat-acclimated", () => {
    const unacclimated = heatGuidance(cToFInverse(75), "red", false);
    const acclimated = heatGuidance(cToFInverse(75), "red", true);
    expect(unacclimated.sub).not.toBe(acclimated.sub);
    expect(acclimated.sub.toLowerCase()).toContain("acclimat");
  });

  it("does not change cold or ideal-band guidance based on acclimation", () => {
    const unacclimated = heatGuidance(cToFInverse(45), "green", false);
    const acclimated = heatGuidance(cToFInverse(45), "green", true);
    expect(unacclimated.sub).toBe(acclimated.sub);
  });
});

// Test-only helper: the inverse of cToF, so test cases can be expressed in
// the °F terms the guidance is actually calibrated to rather than
// hand-converted Celsius magic numbers.
function cToFInverse(f: number): number {
  return ((f - 32) * 5) / 9;
}
