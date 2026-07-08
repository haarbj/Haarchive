import { describe, expect, it } from "vitest";
import { addDays, dayOfWeek, diffDays } from "@/lib/coaching-engine/date-utils";

describe("addDays", () => {
  it("adds days within a month", () => {
    expect(addDays("2026-03-01", 5)).toBe("2026-03-06");
  });

  it("rolls over a month boundary", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
  });

  it("rolls over a year boundary", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("handles a leap-year February correctly", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("supports zero and negative offsets", () => {
    expect(addDays("2026-06-15", 0)).toBe("2026-06-15");
    expect(addDays("2026-06-15", -1)).toBe("2026-06-14");
  });
});

describe("diffDays", () => {
  it("computes a simple forward difference", () => {
    expect(diffDays("2026-03-01", "2026-03-10")).toBe(9);
  });

  it("is zero for the same date", () => {
    expect(diffDays("2026-03-01", "2026-03-01")).toBe(0);
  });

  it("is negative when the second date is earlier", () => {
    expect(diffDays("2026-03-10", "2026-03-01")).toBe(-9);
  });

  it("is the exact inverse of addDays", () => {
    const start = "2026-05-01";
    const end = addDays(start, 47);
    expect(diffDays(start, end)).toBe(47);
  });
});

describe("dayOfWeek", () => {
  it("matches known weekdays", () => {
    // 2026-07-08 is a Wednesday.
    expect(dayOfWeek("2026-07-08")).toBe(3);
    // 2026-07-12 is a Sunday.
    expect(dayOfWeek("2026-07-12")).toBe(0);
  });

  it("is stable across a 7-day step", () => {
    const d1 = "2026-04-01";
    const d2 = addDays(d1, 7);
    expect(dayOfWeek(d1)).toBe(dayOfWeek(d2));
  });
});
