import { describe, expect, it } from "vitest";

import { buildPerformanceTrend, parseIsoDateLocal } from "@/lib/performance-trend";

describe("parseIsoDateLocal", () => {
  it("parses an ISO date string into a local calendar date, not UTC midnight", () => {
    const date = parseIsoDateLocal("2026-03-05");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(5);
  });
});

describe("buildPerformanceTrend", () => {
  it("sorts races chronologically regardless of input order", () => {
    const trend = buildPerformanceTrend([
      { id: "b", raceName: "Later 10K", raceDate: "2026-06-01", distanceM: 10000, finishTimeS: 2400 },
      { id: "a", raceName: "Earlier 5K", raceDate: "2026-01-01", distanceM: 5000, finishTimeS: 1200 },
    ]);
    expect(trend.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("projects every race onto the target distance so they're comparable", () => {
    const trend = buildPerformanceTrend([{ id: "a", raceName: "10K", raceDate: "2026-01-01", distanceM: 10000, finishTimeS: 2400 }], 5000);
    expect(trend[0].equivalentSeconds).toBeLessThan(2400);
    expect(trend[0].equivalentSeconds).toBeGreaterThan(1100);
  });

  it("returns an equivalent time equal to the actual time when already at the target distance", () => {
    const trend = buildPerformanceTrend([{ id: "a", raceName: "5K", raceDate: "2026-01-01", distanceM: 5000, finishTimeS: 1200 }], 5000);
    expect(trend[0].equivalentSeconds).toBeCloseTo(1200, 5);
  });
});
