import { describe, expect, it } from "vitest";

import { computeAcwr } from "@/lib/acwr";

const NOW = new Date("2026-06-28T12:00:00Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("computeAcwr", () => {
  it("returns a null ratio with no training history", () => {
    const result = computeAcwr([], NOW);
    expect(result.ratio).toBeNull();
    expect(result.zone).toBeNull();
  });

  it("lands in the sweet spot for steady, consistent mileage", () => {
    const workouts = Array.from({ length: 28 }, (_, i) => ({ completedAt: daysAgo(i), distanceM: 8000 }));
    const result = computeAcwr(workouts, NOW);
    expect(result.ratio).not.toBeNull();
    expect(result.ratio!).toBeGreaterThan(0.8);
    expect(result.ratio!).toBeLessThan(1.3);
    expect(result.zone).toBe("sweet-spot");
  });

  it("flags high risk after a sharp recent mileage spike", () => {
    const steadyPast = Array.from({ length: 21 }, (_, i) => ({ completedAt: daysAgo(i + 7), distanceM: 3000 }));
    const recentSpike = Array.from({ length: 7 }, (_, i) => ({ completedAt: daysAgo(i), distanceM: 12000 }));
    const result = computeAcwr([...steadyPast, ...recentSpike], NOW);
    expect(result.ratio).not.toBeNull();
    expect(result.ratio!).toBeGreaterThan(1.5);
    expect(result.zone).toBe("high-risk");
  });

  it("flags undertrained after a sharp recent drop in mileage", () => {
    const steadyPast = Array.from({ length: 21 }, (_, i) => ({ completedAt: daysAgo(i + 7), distanceM: 10000 }));
    const recentDrop = Array.from({ length: 7 }, (_, i) => ({ completedAt: daysAgo(i), distanceM: 1000 }));
    const result = computeAcwr([...steadyPast, ...recentDrop], NOW);
    expect(result.ratio).not.toBeNull();
    expect(result.ratio!).toBeLessThan(0.8);
    expect(result.zone).toBe("undertrained");
  });

  it("ignores workouts outside the 28-day chronic window", () => {
    const withinWindow = [{ completedAt: daysAgo(5), distanceM: 8000 }];
    const wayInThePast = [{ completedAt: daysAgo(200), distanceM: 999999 }];
    const result = computeAcwr([...withinWindow, ...wayInThePast], NOW);
    expect(result.chronicDailyAvgM).toBeCloseTo(8000 / 28, 5);
  });

  it("ignores future-dated workouts", () => {
    const future = [{ completedAt: daysAgo(-5), distanceM: 999999 }];
    const result = computeAcwr(future, NOW);
    expect(result.ratio).toBeNull();
  });
});
