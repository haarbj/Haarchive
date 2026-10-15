import { describe, expect, it } from "vitest";

import {
  addDays,
  daysBetween,
  monthGridDates,
  mostRecentCompletedMonday,
  mostRecentMonday,
  shiftMonth,
  shiftWeek,
  weekDates,
} from "@/lib/week";

describe("mostRecentCompletedMonday", () => {
  it("is exactly 7 days before mostRecentMonday for the same date", () => {
    const date = new Date("2026-08-26T12:00:00Z"); // a Wednesday
    const current = mostRecentMonday(date);
    const completed = mostRecentCompletedMonday(date);
    const diffDays = (new Date(`${current}T00:00:00Z`).getTime() - new Date(`${completed}T00:00:00Z`).getTime()) / 86400000;
    expect(diffDays).toBe(7);
  });

  it("on a Monday, returns last week's Monday, not today", () => {
    // 2026-08-24 is a Monday.
    expect(mostRecentMonday(new Date("2026-08-24T09:00:00Z"))).toBe("2026-08-24");
    expect(mostRecentCompletedMonday(new Date("2026-08-24T09:00:00Z"))).toBe("2026-08-17");
  });

  it("on a Sunday, returns the Monday of the week that just ended, not the current in-progress week", () => {
    // 2026-08-30 is a Sunday, part of the week starting 2026-08-24.
    expect(mostRecentMonday(new Date("2026-08-30T09:00:00Z"))).toBe("2026-08-24");
    expect(mostRecentCompletedMonday(new Date("2026-08-30T09:00:00Z"))).toBe("2026-08-17");
  });

  it("crosses a month boundary correctly", () => {
    // 2026-09-02 is a Wednesday; the current week starts Monday 2026-08-31.
    expect(mostRecentMonday(new Date("2026-09-02T09:00:00Z"))).toBe("2026-08-31");
    expect(mostRecentCompletedMonday(new Date("2026-09-02T09:00:00Z"))).toBe("2026-08-24");
  });
});

describe("weekDates", () => {
  it("returns the 7 ISO dates Mon-Sun for a given Monday", () => {
    expect(weekDates("2026-08-24")).toEqual([
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
    ]);
  });

  it("crosses a month boundary correctly", () => {
    expect(weekDates("2026-08-31")).toEqual([
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
    ]);
  });
});

describe("shiftWeek", () => {
  it("moves forward by whole weeks", () => {
    expect(shiftWeek("2026-08-24", 1)).toBe("2026-08-31");
    expect(shiftWeek("2026-08-24", 2)).toBe("2026-09-07");
  });

  it("moves backward by whole weeks", () => {
    expect(shiftWeek("2026-08-24", -1)).toBe("2026-08-17");
  });

  it("is a no-op for delta 0", () => {
    expect(shiftWeek("2026-08-24", 0)).toBe("2026-08-24");
  });
});

describe("addDays", () => {
  it("adds forward across a month boundary", () => {
    expect(addDays("2026-08-28", 5)).toBe("2026-09-02");
  });

  it("subtracts for a negative count", () => {
    expect(addDays("2026-08-24", -3)).toBe("2026-08-21");
  });

  it("is a no-op for 0 days", () => {
    expect(addDays("2026-08-24", 0)).toBe("2026-08-24");
  });
});

describe("monthGridDates", () => {
  it("includes the correct leading/trailing adjacent-month days for a month starting mid-week", () => {
    // Aug 2026: Aug 1 is a Saturday, Aug 31 is a Monday -- the grid should
    // start on the Monday of the week containing Aug 1 (Jul 27) and end on
    // the Sunday of the week containing Aug 31 (Sep 6).
    const dates = monthGridDates("2026-08");
    expect(dates[0]).toBe("2026-07-27");
    expect(dates[dates.length - 1]).toBe("2026-09-06");
    expect(dates).toContain("2026-08-01");
    expect(dates).toContain("2026-08-31");
    expect(dates.length).toBe(42); // 6 full Monday-start weeks
  });

  it("is always a whole number of 7-day weeks starting on a Monday and ending on a Sunday", () => {
    for (const month of ["2026-02", "2026-08", "2027-01", "2028-02"]) {
      const dates = monthGridDates(month);
      expect(dates.length % 7).toBe(0);
      expect(new Date(`${dates[0]}T00:00:00Z`).getUTCDay()).toBe(1); // Monday
      expect(new Date(`${dates[dates.length - 1]}T00:00:00Z`).getUTCDay()).toBe(0); // Sunday
    }
  });

  it("includes Feb 29 in a leap year", () => {
    expect(monthGridDates("2028-02")).toContain("2028-02-29");
  });

  it("does not include Feb 29 in a non-leap year", () => {
    expect(monthGridDates("2026-02")).not.toContain("2026-02-29");
  });
});

describe("shiftMonth", () => {
  it("moves forward across a year boundary", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("moves backward across a year boundary", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("moves within a year", () => {
    expect(shiftMonth("2026-08", 1)).toBe("2026-09");
  });

  it("is a no-op for delta 0", () => {
    expect(shiftMonth("2026-08", 0)).toBe("2026-08");
  });
});

describe("daysBetween", () => {
  it("is positive when b is after a", () => {
    expect(daysBetween("2026-08-24", "2026-08-31")).toBe(7);
  });

  it("is negative when b is before a", () => {
    expect(daysBetween("2026-08-31", "2026-08-24")).toBe(-7);
  });

  it("round-trips with addDays -- shifting a by the result lands exactly on b", () => {
    const a = "2026-08-24";
    const b = "2026-09-14";
    expect(addDays(a, daysBetween(a, b))).toBe(b);
  });
});
