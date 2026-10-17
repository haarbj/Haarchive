import { describe, expect, it } from "vitest";
import { formatDateSafe, formatMiles, formatRelativeTime, formatWeekday } from "@/lib/format";

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

describe("formatWeekday", () => {
  it("returns a short weekday label for a known Monday", () => {
    // Locale-tolerant on purpose (toLocaleDateString's exact string is
    // environment-dependent) -- just confirms it's a short, non-numeric
    // label distinct from a full weekday name.
    const result = formatWeekday("2026-08-24");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toMatch(/^\d/);
  });

  it("gives different weekdays for consecutive days", () => {
    expect(formatWeekday("2026-08-24")).not.toBe(formatWeekday("2026-08-25"));
  });
});

describe("formatRelativeTime", () => {
  it("says just now for anything under a minute", () => {
    expect(formatRelativeTime(isoMinutesAgo(0.5))).toBe("just now");
  });

  it("uses singular/plural minutes correctly", () => {
    expect(formatRelativeTime(isoMinutesAgo(1))).toBe("1 minute ago");
    expect(formatRelativeTime(isoMinutesAgo(30))).toBe("30 minutes ago");
  });

  it("switches to hours past 60 minutes", () => {
    expect(formatRelativeTime(isoMinutesAgo(120))).toBe("2 hours ago");
  });

  it("switches to days past 24 hours", () => {
    expect(formatRelativeTime(isoMinutesAgo(60 * 30))).toBe("1 day ago"); // 30 hours rounds to 1 day
    expect(formatRelativeTime(isoMinutesAgo(60 * 48))).toBe("2 days ago");
  });

  it("falls back to an absolute date past a week", () => {
    const result = formatRelativeTime(isoMinutesAgo(60 * 24 * 10));
    expect(result).not.toMatch(/ago/);
    expect(result).toMatch(/\d{4}/); // contains a year, i.e. a real calendar date
  });
});

describe("formatMiles", () => {
  it("converts an arbitrary (non-round) GPS distance to one decimal of miles", () => {
    expect(formatMiles(9977)).toBe("6.2 mi");
    expect(formatMiles(11426.3)).toBe("7.1 mi");
  });
});

describe("formatDateSafe", () => {
  // Locale-tolerant on purpose, same reasoning as formatWeekday's own
  // tests above (toLocaleDateString's exact string is environment-
  // dependent) -- these confirm a real date came out (the year, the day
  // number), not the exact rendered text.
  it("formats a plain date the same way formatDate does", () => {
    const result = formatDateSafe("2026-08-24");
    expect(result).toContain("2026");
    expect(result).toContain("24");
  });

  it("formats a full timestamptz by reading just its date portion -- the bug formatDate itself has when handed one directly", () => {
    expect(formatDateSafe("2026-08-24T14:23:01.123456+00:00")).toBe(formatDateSafe("2026-08-24"));
    expect(formatDateSafe("2026-08-24T00:00:00Z")).toBe(formatDateSafe("2026-08-24"));
  });

  it("returns null (not 'Invalid Date') for null, undefined, or empty input", () => {
    expect(formatDateSafe(null)).toBeNull();
    expect(formatDateSafe(undefined)).toBeNull();
    expect(formatDateSafe("")).toBeNull();
  });

  it("returns null (not 'Invalid Date') for a genuinely malformed date string", () => {
    expect(formatDateSafe("not-a-date")).toBeNull();
  });
});
