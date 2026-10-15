import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchConditionsAtTime,
  fetchConditionsWindow,
  fetchCurrentConditions,
  summarizeWeatherWindow,
  type WeatherConditions,
} from "@/lib/environmental/fetch-weather-conditions";

function mockResponse(ok: boolean, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      json: () => Promise.resolve(body),
    }),
  );
}

// A handful of tests below need a date that's reliably WITHIN the real
// forecast horizon (so they exercise the direct forecast-error path, not
// the climatology fallback added for dates beyond it) -- a hardcoded
// future date like "2099-01-01" would silently drift from "intended: near
// future" to "actually: beyond the horizon" the moment real time catches
// up with -- no, overshoots -- it, which is exactly the scenario this
// module's own climatology branch exists for. +1 day from the real "now"
// is never beyond the horizon, so it stays a direct-forecast-path test
// no matter when this suite runs.
function tomorrowDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysFromNowDateString(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchCurrentConditions", () => {
  it("maps every current-block field to its typed name", async () => {
    mockResponse(true, {
      current: {
        temperature_2m: 22,
        relative_humidity_2m: 55,
        dew_point_2m: 12,
        cloud_cover: 40,
        surface_pressure: 1013,
        wind_speed_10m: 4,
        wind_direction_10m: 270,
        wind_gusts_10m: 8,
      },
      elevation: 178,
    });

    const result = await fetchCurrentConditions(36.16, -86.78);
    expect(result).toEqual({
      tempC: 22,
      relativeHumidityPct: 55,
      dewPointC: 12,
      cloudCoverPct: 40,
      pressureHPa: 1013,
      windSpeedMS: 4,
      windFromBearingDeg: 270,
      windGustsMS: 8,
      elevationM: 178,
      source: "forecast",
    });
  });

  it("throws when the request fails", async () => {
    mockResponse(false, {});
    await expect(fetchCurrentConditions(0, 0)).rejects.toThrow(/weather lookup failed/i);
  });

  it("returns a null elevation when the response omits it", async () => {
    mockResponse(true, {
      current: {
        temperature_2m: 22,
        relative_humidity_2m: 55,
        dew_point_2m: 12,
        cloud_cover: 40,
        surface_pressure: 1013,
        wind_speed_10m: 4,
        wind_direction_10m: 270,
        wind_gusts_10m: 8,
      },
    });

    const result = await fetchCurrentConditions(36.16, -86.78);
    expect(result.elevationM).toBeNull();
  });
});

describe("fetchConditionsAtTime", () => {
  it("picks the hourly entry closest to the requested naive local time, across every field", async () => {
    mockResponse(true, {
      hourly: {
        time: ["2026-07-20T06:00", "2026-07-20T07:00", "2026-07-20T08:00"],
        temperature_2m: [18, 22, 26],
        relative_humidity_2m: [70, 55, 40],
        dew_point_2m: [10, 12, 14],
        cloud_cover: [80, 40, 10],
        surface_pressure: [1015, 1013, 1011],
        wind_speed_10m: [1, 5, 9],
        wind_direction_10m: [10, 50, 90],
        wind_gusts_10m: [2, 6, 10],
      },
      elevation: 1609,
    });

    const result = await fetchConditionsAtTime(36.16, -86.78, "2026-07-20T07:10");
    expect(result.tempC).toBe(22);
    expect(result.relativeHumidityPct).toBe(55);
    expect(result.dewPointC).toBe(12);
    expect(result.elevationM).toBe(1609);
    expect(result.cloudCoverPct).toBe(40);
    expect(result.pressureHPa).toBe(1013);
    expect(result.windSpeedMS).toBe(5);
    expect(result.windFromBearingDeg).toBe(50);
    expect(result.windGustsMS).toBe(6);
  });

  it("throws a descriptive error when the API returns an error response", async () => {
    mockResponse(false, { error: true, reason: "Parameter 'start_date' is out of allowed range" });
    await expect(fetchConditionsAtTime(0, 0, `${tomorrowDateString()}T00:00`)).rejects.toThrow(/out of allowed range/);
  });

  it("throws when there is no hourly data at all", async () => {
    mockResponse(true, {
      hourly: {
        time: [],
        temperature_2m: [],
        relative_humidity_2m: [],
        dew_point_2m: [],
        cloud_cover: [],
        surface_pressure: [],
        wind_speed_10m: [],
        wind_direction_10m: [],
        wind_gusts_10m: [],
      },
    });
    await expect(fetchConditionsAtTime(0, 0, "2026-01-01T00:00")).rejects.toThrow(/no weather data/i);
  });
});

function hourlyFixture() {
  return {
    hourly: {
      time: [
        "2026-07-20T05:00",
        "2026-07-20T06:00",
        "2026-07-20T07:00",
        "2026-07-20T08:00",
        "2026-07-20T09:00",
        "2026-07-20T10:00",
      ],
      temperature_2m: [15, 17, 20, 22, 24, 26],
      relative_humidity_2m: [80, 75, 65, 57, 50, 45],
      dew_point_2m: [10, 11, 12, 12, 13, 13],
      cloud_cover: [90, 70, 40, 10, 5, 0],
      surface_pressure: [1012, 1012, 1013, 1013, 1014, 1014],
      wind_speed_10m: [1, 2, 3, 4, 5, 6],
      wind_direction_10m: [350, 0, 10, 20, 30, 40],
      wind_gusts_10m: [3, 4, 6, 8, 9, 12],
    },
    elevation: 250,
  };
}

describe("fetchConditionsWindow", () => {
  it("includes every hour a run's real window actually touches, and no more", async () => {
    mockResponse(true, hourlyFixture());
    // A 90-minute run from 7:15 to 8:45 touches the 7:00 and 8:00 readings only.
    const points = await fetchConditionsWindow(36.16, -86.78, "2026-07-20T07:15", 90 * 60);
    expect(points.map((p) => p.tempC)).toEqual([20, 22]);
  });

  it("returns a single point for a short run entirely within one hour", async () => {
    mockResponse(true, hourlyFixture());
    const points = await fetchConditionsWindow(36.16, -86.78, "2026-07-20T07:05", 20 * 60);
    expect(points).toHaveLength(1);
    expect(points[0].tempC).toBe(20);
  });

  it("carries elevation through onto every point", async () => {
    mockResponse(true, hourlyFixture());
    const points = await fetchConditionsWindow(36.16, -86.78, "2026-07-20T07:15", 90 * 60);
    for (const p of points) expect(p.elevationM).toBe(250);
  });

  it("throws a descriptive error when the API returns an error response", async () => {
    mockResponse(false, { error: true, reason: "Parameter 'start_date' is out of allowed range" });
    await expect(fetchConditionsWindow(0, 0, `${tomorrowDateString()}T00:00`, 3600)).rejects.toThrow(/out of allowed range/);
  });
});

// Racing against a date beyond Open-Meteo's real forecast horizon
// (verified live against the API: a request more than 15 days out
// returns HTTP 400, "start_date is out of allowed range") previously had
// no graceful answer -- the most common real case (planning a marathon
// months out) would surface that raw API error directly. These tests
// cover the climatology fallback added for exactly that gap.
function climatologyHourlyFixture(tempC: number, windDirectionDeg: number) {
  return {
    hourly: {
      time: ["2025-01-01T00:00", "2025-01-01T01:00"],
      temperature_2m: [tempC, tempC],
      relative_humidity_2m: [50, 50],
      dew_point_2m: [0, 0],
      cloud_cover: [0, 0],
      surface_pressure: [1013, 1013],
      wind_speed_10m: [2, 2],
      wind_direction_10m: [windDirectionDeg, windDirectionDeg],
      wind_gusts_10m: [4, 4],
    },
    elevation: 100,
  };
}

function mockSequentialResponses(responses: { ok: boolean; body: unknown }[]) {
  const fn = vi.fn();
  for (const { ok, body } of responses) {
    fn.mockResolvedValueOnce({ ok, json: () => Promise.resolve(body) });
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("fetchConditionsAtTime -- climatology fallback beyond the forecast horizon", () => {
  it("averages the most recent 3 years' same-calendar-date archive data when the date is beyond the forecast window", async () => {
    const mock = mockSequentialResponses([
      { ok: true, body: climatologyHourlyFixture(10, 350) },
      { ok: true, body: climatologyHourlyFixture(20, 0) },
      { ok: true, body: climatologyHourlyFixture(30, 10) },
    ]);

    const farFutureDate = daysFromNowDateString(45);
    const result = await fetchConditionsAtTime(36.16, -86.78, `${farFutureDate}T00:00`);

    expect(result.tempC).toBe(20); // (10 + 20 + 30) / 3
    expect(result.source).toBe("climatology");
    expect(result.elevationM).toBe(100);
    // Every call should hit the archive endpoint (a real historical lookup
    // for an earlier year), never the forecast endpoint, for a date this
    // far out.
    for (const call of mock.mock.calls) {
      expect(String(call[0])).toContain("archive-api.open-meteo.com");
    }
  });

  it("degrades to fewer years rather than failing outright when some years are unreachable", async () => {
    mockSequentialResponses([
      { ok: true, body: climatologyHourlyFixture(10, 0) },
      { ok: false, body: { error: true, reason: "temporary failure" } },
      { ok: true, body: climatologyHourlyFixture(30, 0) },
    ]);

    const farFutureDate = daysFromNowDateString(45);
    const result = await fetchConditionsAtTime(36.16, -86.78, `${farFutureDate}T00:00`);

    expect(result.tempC).toBe(20); // (10 + 30) / 2 -- the failed middle year is simply skipped
    expect(result.source).toBe("climatology");
  });

  it("throws a descriptive error when every candidate year fails", async () => {
    mockResponse(false, { error: true, reason: "temporary failure" });
    const farFutureDate = daysFromNowDateString(45);
    await expect(fetchConditionsAtTime(36.16, -86.78, `${farFutureDate}T00:00`)).rejects.toThrow(/no historical weather data/i);
  });

  it("marks a past date's result as 'archive' and a near-future date's result as 'forecast'", async () => {
    mockResponse(true, hourlyFixture());
    const pastResult = await fetchConditionsAtTime(36.16, -86.78, "2020-01-01T07:00");
    expect(pastResult.source).toBe("archive");

    const nearFutureResult = await fetchConditionsAtTime(36.16, -86.78, `${tomorrowDateString()}T07:00`);
    expect(nearFutureResult.source).toBe("forecast");
  });
});

describe("summarizeWeatherWindow", () => {
  const points: WeatherConditions[] = [
    {
      tempC: 20,
      relativeHumidityPct: 65,
      dewPointC: 12,
      cloudCoverPct: 40,
      pressureHPa: 1013,
      windSpeedMS: 3,
      windFromBearingDeg: 350,
      windGustsMS: 6,
      elevationM: 250,
      source: "forecast",
    },
    {
      tempC: 22,
      relativeHumidityPct: 57,
      dewPointC: 12,
      cloudCoverPct: 10,
      pressureHPa: 1013,
      windSpeedMS: 4,
      windFromBearingDeg: 10,
      windGustsMS: 8,
      elevationM: 250,
      source: "forecast",
    },
  ];

  it("returns the plain average for a straightforward field like temperature", () => {
    expect(summarizeWeatherWindow(points).tempC).toBe(21);
  });

  it("returns the single point unchanged when there's only one (no fabricated averaging of a single observation)", () => {
    expect(summarizeWeatherWindow([points[0]])).toEqual(points[0]);
  });

  it("uses a circular mean for wind bearing, not a naive average that would be wrong near 0/360", () => {
    // Naive average of 350 and 10 would be 180 (due south) -- completely
    // wrong. The real circular mean is 0 (due north), splitting the
    // difference the short way around the compass.
    expect(summarizeWeatherWindow(points).windFromBearingDeg).toBeCloseTo(0, 0);
  });

  it("uses the peak, not the average, for gusts", () => {
    expect(summarizeWeatherWindow(points).windGustsMS).toBe(8);
  });
});
