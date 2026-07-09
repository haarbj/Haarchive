import { describe, expect, it } from "vitest";
import { summarizeWeek } from "@/lib/coaching-engine/weekly-summary";

describe("summarizeWeek", () => {
  it("sums mileage, finds the longest run, and averages RPE", () => {
    const result = summarizeWeek(
      [
        { actualDistanceM: 8000, rpe: 4 },
        { actualDistanceM: 16000, rpe: 6 },
        { actualDistanceM: 5000, rpe: null },
      ],
      3,
    );
    expect(result.mileageM).toBe(29000);
    expect(result.longestRunM).toBe(16000);
    expect(result.avgRpe).toBe(5);
    expect(result.completedCount).toBe(3);
    expect(result.scheduledCount).toBe(3);
  });

  it("returns a null average RPE when nothing logged one", () => {
    const result = summarizeWeek([{ actualDistanceM: 5000, rpe: null }], 1);
    expect(result.avgRpe).toBeNull();
  });

  it("calls out excellent consistency at a high completion rate", () => {
    const result = summarizeWeek(
      [
        { actualDistanceM: 5000, rpe: 5 },
        { actualDistanceM: 5000, rpe: 5 },
        { actualDistanceM: 5000, rpe: 5 },
      ],
      3,
    );
    expect(result.summary).toMatch(/excellent consistency/i);
  });

  it("stays encouraging, not judgmental, when nothing was completed", () => {
    const result = summarizeWeek([], 4);
    expect(result.completedCount).toBe(0);
    expect(result.summary).not.toMatch(/fail|bad|disappointing/i);
  });

  it("handles a week with nothing scheduled at all", () => {
    const result = summarizeWeek([], 0);
    expect(result.summary).toMatch(/no workouts were scheduled/i);
  });
});
