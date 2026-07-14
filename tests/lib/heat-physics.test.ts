import { describe, expect, it } from "vitest";

import { cToF, estimateWBGT, heatGuidance, heatZoneFor } from "@/lib/heat-physics";

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
  it("classifies into the correct ACSM-aligned flag zone", () => {
    expect(heatZoneFor(10).name).toBe("green");
    expect(heatZoneFor(20).name).toBe("yellow");
    expect(heatZoneFor(25).name).toBe("red");
    expect(heatZoneFor(30).name).toBe("black");
  });

  it("treats the boundary itself as the next zone up (exclusive upper bound)", () => {
    expect(heatZoneFor(18).name).toBe("yellow");
  });
});

describe("heatGuidance", () => {
  it("returns distinct guidance for each zone", () => {
    const titles = new Set(
      [
        heatGuidance(8, "green"),
        heatGuidance(20, "yellow"),
        heatGuidance(25, "red"),
        heatGuidance(30, "black"),
      ].map((g) => g.title),
    );
    expect(titles.size).toBe(4);
  });
});
