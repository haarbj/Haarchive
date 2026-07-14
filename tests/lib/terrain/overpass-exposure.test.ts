import { describe, expect, it } from "vitest";

import { scoreFromOverpassElements } from "@/lib/terrain/overpass-exposure";

describe("scoreFromOverpassElements", () => {
  it("returns a low score (sheltered) for a dense cluster of buildings", () => {
    const elements = Array.from({ length: 20 }, () => ({ tags: { building: "yes" } }));
    expect(scoreFromOverpassElements(elements)).toBeLessThan(30);
  });

  it("returns a high score (exposed) for open farmland with no buildings", () => {
    const elements = Array.from({ length: 10 }, () => ({ tags: { landuse: "farmland" } }));
    expect(scoreFromOverpassElements(elements)).toBeGreaterThan(60);
  });

  it("returns a high score when a coastline is nearby, regardless of other tags", () => {
    const elements = [{ tags: { natural: "coastline" } }];
    expect(scoreFromOverpassElements(elements)).toBeGreaterThanOrEqual(85);
  });

  it("returns a mid-range score for an empty or ambiguous result", () => {
    expect(scoreFromOverpassElements([])).toBe(50);
  });

  it("stays within 0-100 bounds regardless of input volume", () => {
    const manyBuildings = Array.from({ length: 500 }, () => ({ tags: { building: "yes" } }));
    const manyOpen = Array.from({ length: 500 }, () => ({ tags: { landuse: "meadow" } }));
    expect(scoreFromOverpassElements(manyBuildings)).toBeGreaterThanOrEqual(0);
    expect(scoreFromOverpassElements(manyOpen)).toBeLessThanOrEqual(100);
  });
});
