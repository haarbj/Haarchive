import { afterEach, describe, expect, it, vi } from "vitest";

import { addSecondsToNaiveDateTime, fetchWindAtTime } from "@/lib/weather-wind";

function mockHourlyResponse(ok: boolean, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      json: () => Promise.resolve(body),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWindAtTime", () => {
  it("picks the hourly entry closest to the requested naive local time", async () => {
    mockHourlyResponse(true, {
      hourly: {
        time: ["2026-07-20T06:00", "2026-07-20T07:00", "2026-07-20T08:00"],
        wind_speed_10m: [1, 5, 9],
        wind_direction_10m: [10, 50, 90],
        wind_gusts_10m: [2, 6, 10],
      },
    });

    const result = await fetchWindAtTime(36.16, -86.78, "2026-07-20T07:10");
    expect(result.speedMS).toBe(5);
    expect(result.fromBearingDeg).toBe(50);
    expect(result.gustsMS).toBe(6);
  });

  it("is not thrown off by the requested time being formatted with no timezone", async () => {
    // Regression check: this must never route through `new Date(...)` on
    // the raw strings, which would silently reinterpret them in the
    // *browser's* timezone instead of treating both sides as the same
    // naive wall-clock reading.
    mockHourlyResponse(true, {
      hourly: {
        time: ["2026-01-01T23:00", "2026-01-02T00:00", "2026-01-02T01:00"],
        wind_speed_10m: [3, 4, 5],
        wind_direction_10m: [100, 110, 120],
        wind_gusts_10m: [4, 5, 6],
      },
    });

    const result = await fetchWindAtTime(0, 0, "2026-01-02T00:05");
    expect(result.speedMS).toBe(4);
  });

  it("throws a descriptive error when the API returns an error response", async () => {
    mockHourlyResponse(false, { error: true, reason: "Parameter 'start_date' is out of allowed range" });
    await expect(fetchWindAtTime(0, 0, "2099-01-01T00:00")).rejects.toThrow(/out of allowed range/);
  });

  it("throws when there is no hourly data at all", async () => {
    mockHourlyResponse(true, { hourly: { time: [], wind_speed_10m: [], wind_direction_10m: [], wind_gusts_10m: [] } });
    await expect(fetchWindAtTime(0, 0, "2026-01-01T00:00")).rejects.toThrow(/no wind data/i);
  });
});

describe("addSecondsToNaiveDateTime", () => {
  it("adds a duration within the same day", () => {
    expect(addSecondsToNaiveDateTime("2026-07-20T07:15", 90 * 60)).toBe("2026-07-20T08:45");
  });

  it("rolls over into the next day", () => {
    expect(addSecondsToNaiveDateTime("2026-07-20T23:30", 90 * 60)).toBe("2026-07-21T01:00");
  });

  it("rolls over across a month boundary", () => {
    expect(addSecondsToNaiveDateTime("2026-01-31T23:00", 2 * 3600)).toBe("2026-02-01T01:00");
  });

  it("never routes through the browser's own timezone (stays a pure naive-digit calculation)", () => {
    // If this ever regressed to using `new Date(localDateTime)` directly,
    // the result would depend on process.env.TZ -- it must not.
    const result = addSecondsToNaiveDateTime("2026-06-15T12:00", 3600);
    expect(result).toBe("2026-06-15T13:00");
  });

  it("returns zero-padded hours/minutes", () => {
    expect(addSecondsToNaiveDateTime("2026-03-05T09:05", 60)).toBe("2026-03-05T09:06");
  });
});
