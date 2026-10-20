import { describe, expect, it } from "vitest";

import {
  composeRoutes,
  buildWeatherReadings,
  computeConditionsBreakdown,
  type ActivityRoute,
} from "@/lib/private-coaching/completed-workout-conditions";
import { computeRecordedRunEffort } from "@/lib/environmental/recorded-run-effort";
import type { ParsedRoute, RoutePoint } from "@/lib/route-import/types";
import type { WeatherConditions } from "@/lib/environmental/fetch-weather-conditions";

const EARTH_RADIUS_M = 6371000;
const MILE_METERS = 1609.344;
const PACE_S_PER_M = (8 * 60) / MILE_METERS; // 8:00/mi, matching recorded-run-effort.test.ts's own fixture pace

// Same synthetic-route builder pattern as recorded-run-effort.test.ts --
// a flat or sloped route along the equator, constant real pace, real
// elapsed-time stamps.
function buildRoute(profile: { distanceM: number; elevationM: number }[], paceSPerM: number, stepM = 10): ParsedRoute {
  const totalDistanceM = profile[profile.length - 1].distanceM;
  const points: RoutePoint[] = [];
  function elevationAt(distanceM: number): number {
    for (let i = 0; i < profile.length - 1; i++) {
      const a = profile[i];
      const b = profile[i + 1];
      if (distanceM >= a.distanceM && distanceM <= b.distanceM) {
        const t = (distanceM - a.distanceM) / (b.distanceM - a.distanceM);
        return a.elevationM + (b.elevationM - a.elevationM) * t;
      }
    }
    return profile[profile.length - 1].elevationM;
  }
  for (let d = 0; d <= totalDistanceM; d += stepM) {
    const lonDeg = (d / EARTH_RADIUS_M) * (180 / Math.PI);
    points.push({ lat: 0, lon: lonDeg, elevationM: elevationAt(d), elapsedSeconds: d * paceSPerM });
  }
  return { points, source: "strava", startTimeIso: "2026-07-20T07:00:00Z", movingTimeS: totalDistanceM * paceSPerM };
}

const HOT_WINDY: WeatherConditions = {
  tempC: 29,
  relativeHumidityPct: 60,
  dewPointC: 20,
  cloudCoverPct: 10,
  pressureHPa: 1010,
  windSpeedMS: 6,
  windFromBearingDeg: 90, // headwind for a due-east runner
  windGustsMS: 8,
  elevationM: 100,
  source: "forecast",
};

const CALM_COOL: WeatherConditions = {
  ...HOT_WINDY,
  tempC: 10,
  relativeHumidityPct: 30,
  windSpeedMS: 0,
};

describe("buildWeatherReadings", () => {
  it("a single reading anchors at elapsedSeconds 0", () => {
    expect(buildWeatherReadings([HOT_WINDY])).toEqual([{ elapsedSeconds: 0, conditions: HOT_WINDY }]);
  });

  it("multiple readings spread one hour apart, mirroring the Environmental Calculator's own approximation", () => {
    const result = buildWeatherReadings([HOT_WINDY, CALM_COOL]);
    expect(result.map((r) => r.elapsedSeconds)).toEqual([0, 3600]);
  });
});

describe("composeRoutes", () => {
  it("a single activity passes through unchanged", () => {
    const route = buildRoute([{ distanceM: 1000, elevationM: 0 }], PACE_S_PER_M);
    expect(composeRoutes([{ route, startTimeIso: route.startTimeIso! }])).toBe(route);
  });

  it("two activities compose onto one continuous elapsed-seconds timeline, in start-time order regardless of input order", () => {
    const firstRoute = buildRoute([{ distanceM: 500, elevationM: 0 }], PACE_S_PER_M);
    const secondRoute = buildRoute([{ distanceM: 500, elevationM: 0 }], PACE_S_PER_M);
    const firstDurationS = firstRoute.movingTimeS!;
    const gapS = 600; // a real 10-minute gap, as if the athlete paused the watch between segments
    const secondStart = new Date(new Date("2026-07-20T07:00:00Z").getTime() + (firstDurationS + gapS) * 1000).toISOString();

    const first: ActivityRoute = { route: { ...firstRoute, startTimeIso: "2026-07-20T07:00:00Z" }, startTimeIso: "2026-07-20T07:00:00Z" };
    const second: ActivityRoute = { route: { ...secondRoute, startTimeIso: secondStart }, startTimeIso: secondStart };

    const composed = composeRoutes([second, first]); // deliberately out of order
    expect(composed.startTimeIso).toBe("2026-07-20T07:00:00Z");
    expect(composed.points.length).toBe(first.route.points.length + second.route.points.length);
    expect(composed.movingTimeS).toBeCloseTo(firstDurationS + secondRoute.movingTimeS!, 0);

    // The first point of `second` should land at elapsedSeconds ~
    // firstDurationS + gapS, not 0 -- proving the offset was actually applied.
    const secondsFirstPoint = composed.points[first.route.points.length];
    expect(secondsFirstPoint.elapsedSeconds).toBeCloseTo(firstDurationS + gapS, 0);
  });

  it("movingTimeS is null if any source activity's own is null", () => {
    const a: ActivityRoute = { route: { ...buildRoute([{ distanceM: 500, elevationM: 0 }], PACE_S_PER_M), movingTimeS: null }, startTimeIso: "2026-07-20T07:00:00Z" };
    const b: ActivityRoute = { route: buildRoute([{ distanceM: 500, elevationM: 0 }], PACE_S_PER_M), startTimeIso: "2026-07-20T08:00:00Z" };
    expect(composeRoutes([a, b]).movingTimeS).toBeNull();
  });

  it("throws on an empty list", () => {
    expect(() => composeRoutes([])).toThrow();
  });
});

describe("computeConditionsBreakdown", () => {
  it("a flat, calm, cool run has no meaningful adjustment", () => {
    const route = buildRoute([{ distanceM: 5000, elevationM: 0 }], PACE_S_PER_M);
    const readings = buildWeatherReadings([CALM_COOL]);
    const result = computeConditionsBreakdown(route, readings);
    expect(result.idealPaceSPerMi).toBeCloseTo(result.actualPaceSPerMi, 0);
    for (const factor of result.factors) expect(Math.abs(factor.secPerMi)).toBeLessThan(2);
  });

  it("a hot, windy run produces a real ideal-equivalent faster than the actual pace", () => {
    const route = buildRoute([{ distanceM: 5000, elevationM: 0 }], PACE_S_PER_M); // due east, 5 s/m actual
    const readings = buildWeatherReadings([HOT_WINDY]);
    const result = computeConditionsBreakdown(route, readings);
    expect(result.idealPaceSPerMi).toBeLessThan(result.actualPaceSPerMi);
  });

  it("wind's own isolated contribution matches a direct ablation comparison -- composition correctness, not a re-derived number", () => {
    const route = buildRoute([{ distanceM: 5000, elevationM: 0 }], PACE_S_PER_M);
    const readings = buildWeatherReadings([HOT_WINDY]);
    const result = computeConditionsBreakdown(route, readings);

    const full = computeRecordedRunEffort(route, readings);
    const noWindReadings = readings.map((r) => ({ ...r, conditions: { ...r.conditions, windSpeedMS: 0 } }));
    const noWind = computeRecordedRunEffort(route, noWindReadings);

    const idealTime = (stretches: ReturnType<typeof computeRecordedRunEffort>) =>
      stretches.reduce((sum, s) => sum + (s.isStop || s.effortSpeedMS == null ? s.elapsedSeconds : s.distanceM / s.effortSpeedMS), 0);

    const expectedWindS = idealTime(noWind) - idealTime(full);
    const windFactor = result.factors.find((f) => f.factor === "wind")!;
    const distanceMi = result.distanceM / MILE_METERS;
    expect(windFactor.secPerMi).toBeCloseTo(expectedWindS / distanceMi, 3);
  });

  it("a hilly route produces a real, nonzero grade contribution", () => {
    const route = buildRoute(
      [
        { distanceM: 0, elevationM: 0 },
        { distanceM: 2500, elevationM: 100 },
        { distanceM: 5000, elevationM: 0 },
      ],
      PACE_S_PER_M,
    );
    const readings = buildWeatherReadings([CALM_COOL]);
    const result = computeConditionsBreakdown(route, readings);
    const gradeFactor = result.factors.find((f) => f.factor === "grade")!;
    expect(Math.abs(gradeFactor.secPerMi)).toBeGreaterThan(0.5);
  });

  it("factors are sorted largest-magnitude first", () => {
    const route = buildRoute([{ distanceM: 5000, elevationM: 0 }], PACE_S_PER_M);
    const readings = buildWeatherReadings([HOT_WINDY]);
    const result = computeConditionsBreakdown(route, readings);
    const mags = result.factors.map((f) => Math.abs(f.secPerMi));
    expect(mags).toEqual([...mags].sort((a, b) => b - a));
  });

  it("the three factors sum exactly to the real total adjustment -- heat & humidity is the exact remainder", () => {
    const route = buildRoute(
      [
        { distanceM: 0, elevationM: 0 },
        { distanceM: 2500, elevationM: 80 },
        { distanceM: 5000, elevationM: 0 },
      ],
      5,
    );
    const readings = buildWeatherReadings([HOT_WINDY]);
    const result = computeConditionsBreakdown(route, readings);
    const totalAdjustmentSecPerMi = (result.actualPaceSPerMi - result.idealPaceSPerMi);
    const summedFactors = result.factors.reduce((sum, f) => sum + f.secPerMi, 0);
    expect(summedFactors).toBeCloseTo(totalAdjustmentSecPerMi, 3);
  });
});
