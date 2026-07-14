import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchConditionsAtTime, fetchCurrentConditions } from "@/lib/environmental/fetch-weather-conditions";

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
    });
  });

  it("throws when the request fails", async () => {
    mockResponse(false, {});
    await expect(fetchCurrentConditions(0, 0)).rejects.toThrow(/weather lookup failed/i);
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
    });

    const result = await fetchConditionsAtTime(36.16, -86.78, "2026-07-20T07:10");
    expect(result.tempC).toBe(22);
    expect(result.relativeHumidityPct).toBe(55);
    expect(result.dewPointC).toBe(12);
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
