import { describe, expect, it } from "vitest";

import { weeksUntilGoalRace, formatGoalRaceContext } from "@/lib/private-coaching/goal-race";

describe("weeksUntilGoalRace", () => {
  it("returns none when there's no goal race date", () => {
    expect(weeksUntilGoalRace("2026-08-24", null)).toEqual({ kind: "none" });
  });

  it("returns upcoming with the whole-week count for a race several weeks out", () => {
    // Race on 2026-10-11 (a Sunday) normalizes to its own week's Monday
    // 2026-10-05 -- 6 whole weeks after 2026-08-24.
    expect(weeksUntilGoalRace("2026-08-24", "2026-10-11")).toEqual({ kind: "upcoming", weeks: 6 });
  });

  it("is race-week regardless of which weekday the race falls on within the selected week", () => {
    // Selected week: Mon 2026-08-24 - Sun 2026-08-30.
    expect(weeksUntilGoalRace("2026-08-24", "2026-08-24")).toEqual({ kind: "race-week" }); // race on the Monday
    expect(weeksUntilGoalRace("2026-08-24", "2026-08-27")).toEqual({ kind: "race-week" }); // race mid-week
    expect(weeksUntilGoalRace("2026-08-24", "2026-08-30")).toEqual({ kind: "race-week" }); // race on the Sunday
  });

  it("returns past with the number of weeks since a race that already happened", () => {
    // Race week started 2026-08-10, selected week is 2026-08-24 -- 2 weeks later.
    expect(weeksUntilGoalRace("2026-08-24", "2026-08-14")).toEqual({ kind: "past", weeksSince: 2 });
  });

  it("is exact on a Monday-to-Monday boundary in both directions", () => {
    expect(weeksUntilGoalRace("2026-08-24", "2026-08-31")).toEqual({ kind: "upcoming", weeks: 1 });
    expect(weeksUntilGoalRace("2026-08-31", "2026-08-24")).toEqual({ kind: "past", weeksSince: 1 });
  });
});

describe("formatGoalRaceContext", () => {
  it("formats each state with the race name", () => {
    expect(formatGoalRaceContext({ kind: "none" }, "Chicago Marathon")).toBe("No goal race set");
    expect(formatGoalRaceContext({ kind: "race-week" }, "Chicago Marathon")).toBe("This is race week");
    expect(formatGoalRaceContext({ kind: "upcoming", weeks: 14 }, "Chicago Marathon")).toBe("14 weeks to Chicago Marathon");
    expect(formatGoalRaceContext({ kind: "upcoming", weeks: 1 }, "Chicago Marathon")).toBe("1 week to Chicago Marathon");
    expect(formatGoalRaceContext({ kind: "past", weeksSince: 1 }, "Chicago Marathon")).toBe("1 week since Chicago Marathon");
    expect(formatGoalRaceContext({ kind: "past", weeksSince: 3 }, "Chicago Marathon")).toBe("3 weeks since Chicago Marathon");
  });

  it("falls back to a generic label when no race name is available", () => {
    expect(formatGoalRaceContext({ kind: "upcoming", weeks: 2 }, null)).toBe("2 weeks to goal race");
  });
});
