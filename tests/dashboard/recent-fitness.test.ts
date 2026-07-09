import { describe, expect, it } from "vitest";
import { equivalentPerformances } from "@/app/(app)/dashboard/recent-fitness";

describe("equivalentPerformances", () => {
  it("predicts equivalent times at the standard reference distances", () => {
    const result = equivalentPerformances({ distanceKey: "5k", timeInput: "20:00" });
    expect(result.map((r) => r.label)).toEqual(["10K", "Half", "Marathon"]);
    expect(result[0].seconds).toBeGreaterThan(1200);
  });

  it("excludes the entered distance from its own equivalent list", () => {
    const result = equivalentPerformances({ distanceKey: "10k", timeInput: "40:00" });
    expect(result.map((r) => r.label)).not.toContain("10K");
  });

  it("caps results at maxResults", () => {
    const result = equivalentPerformances({ distanceKey: "1500m", timeInput: "5:00" }, 2);
    expect(result).toHaveLength(2);
  });

  it("returns an empty array for malformed or missing input", () => {
    expect(equivalentPerformances(null)).toEqual([]);
    expect(equivalentPerformances({})).toEqual([]);
    expect(equivalentPerformances({ distanceKey: "5k" })).toEqual([]);
    expect(equivalentPerformances({ distanceKey: "not-a-real-key", timeInput: "20:00" })).toEqual([]);
    expect(equivalentPerformances({ distanceKey: "5k", timeInput: "garbage" })).toEqual([]);
  });
});
