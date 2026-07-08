import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "@/lib/format";

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

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
