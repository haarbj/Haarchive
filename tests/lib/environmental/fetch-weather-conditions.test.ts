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
    await expect(fetchConditionsAtTime(0, 0, "2099-01-01T00:00")).rejects.toThrow(/out of allowed range/);
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
    await expect(fetchConditionsWindow(0, 0, "2099-01-01T00:00", 3600)).rejects.toThrow(/out of allowed range/);
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
