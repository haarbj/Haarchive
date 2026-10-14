import { describe, expect, it } from "vitest";

import { computeAttentionFlags, isHighRpe, type AthleteAttentionInput } from "@/lib/private-coaching/attention";

function input(overrides: Partial<AthleteAttentionInput> = {}): AthleteAttentionInput {
  return {
    missedWorkoutCount: 0,
    recentPainReportCount: 0,
    highRpeCount: 0,
    unreadMessageCount: 0,
    hasCurrentWeekCheckin: true,
    daysSinceRelationshipStarted: 30,
    ...overrides,
  };
}

describe("computeAttentionFlags", () => {
  it("returns nothing for an athlete with no signals", () => {
    expect(computeAttentionFlags(input())).toEqual([]);
  });

  it("flags a pain report as high severity", () => {
    const flags = computeAttentionFlags(input({ recentPainReportCount: 1 }));
    expect(flags).toEqual([{ reason: "pain_reported", detail: "Pain reported", severity: "high" }]);
  });

  it("pluralizes multiple pain reports", () => {
    const flags = computeAttentionFlags(input({ recentPainReportCount: 3 }));
    expect(flags[0].detail).toBe("Pain reported 3 times");
  });

  it("flags a single missed workout as medium severity", () => {
    const flags = computeAttentionFlags(input({ missedWorkoutCount: 1 }));
    expect(flags).toEqual([{ reason: "missed_workout", detail: "1 missed workout", severity: "medium" }]);
  });

  it("escalates 2+ missed workouts to high severity", () => {
    const flags = computeAttentionFlags(input({ missedWorkoutCount: 2 }));
    expect(flags[0].severity).toBe("high");
    expect(flags[0].detail).toBe("2 missed workouts");
  });

  it("flags unusual RPE as medium severity", () => {
    const flags = computeAttentionFlags(input({ highRpeCount: 1 }));
    expect(flags).toEqual([{ reason: "unusual_rpe", detail: "RPE 9+ on a recent workout", severity: "medium" }]);
  });

  it("flags unread messages as medium severity", () => {
    const flags = computeAttentionFlags(input({ unreadMessageCount: 2 }));
    expect(flags).toEqual([{ reason: "unread_message", detail: "2 unread messages", severity: "medium" }]);
  });

  it("flags a missing check-in only after the grace period", () => {
    expect(computeAttentionFlags(input({ hasCurrentWeekCheckin: false, daysSinceRelationshipStarted: 3 }))).toEqual([]);
    expect(computeAttentionFlags(input({ hasCurrentWeekCheckin: false, daysSinceRelationshipStarted: 10 }))).toEqual([
      { reason: "missing_checkin", detail: "No check-in this week", severity: "medium" },
    ]);
  });

  it("does not flag a missing check-in when one exists", () => {
    expect(computeAttentionFlags(input({ hasCurrentWeekCheckin: true, daysSinceRelationshipStarted: 100 }))).toEqual([]);
  });

  it("sorts high severity before medium, preserving relative order within each", () => {
    const flags = computeAttentionFlags(
      input({
        unreadMessageCount: 1, // medium
        missedWorkoutCount: 1, // medium
        recentPainReportCount: 1, // high
      }),
    );
    expect(flags.map((f) => f.reason)).toEqual(["pain_reported", "missed_workout", "unread_message"]);
  });

  it("combines every signal at once without dropping any", () => {
    const flags = computeAttentionFlags(
      input({
        missedWorkoutCount: 3,
        recentPainReportCount: 1,
        highRpeCount: 2,
        unreadMessageCount: 1,
        hasCurrentWeekCheckin: false,
        daysSinceRelationshipStarted: 30,
      }),
    );
    expect(flags).toHaveLength(5);
    expect(flags.map((f) => f.reason)).toContain("pain_reported");
    expect(flags.map((f) => f.reason)).toContain("missing_checkin");
  });
});

describe("isHighRpe", () => {
  it("returns false for null", () => {
    expect(isHighRpe(null)).toBe(false);
  });

  it("returns false below the threshold", () => {
    expect(isHighRpe(8)).toBe(false);
  });

  it("returns true at and above the threshold", () => {
    expect(isHighRpe(9)).toBe(true);
    expect(isHighRpe(10)).toBe(true);
  });
});
