import { describe, expect, it } from "vitest";

import { computeMileCosts } from "@/lib/marathon-pacing/mile-cost-model";
import { heatEngine } from "@/lib/environmental/heat-engine";
import { humidityEngine } from "@/lib/environmental/humidity-engine";
import type { CourseAnalysis } from "@/lib/marathon-pacing/course-analysis";
import type { WeatherConditions } from "@/lib/environmental/fetch-weather-conditions";

const METERS_PER_MILE = 1609.344;

function buildCourse(overrides: Partial<CourseAnalysis>): CourseAnalysis {
  return {
    totalDistanceM: METERS_PER_MILE * (overrides.perMileGrade?.length ?? 1),
    totalClimbM: 0,
    totalDescentM: 0,
    avgGrade: 0,
    gradeHistogram: [],
    climbs: [],
    descents: [],
    longestClimb: null,
    steepestClimb: null,
    longestDescent: null,
    steepestDescent: null,
    rollingIndex: 0,
    downhillSeverityScore: 0,
    perMileGrade: [0],
    perMileHeadingDeg: [null],
    ...overrides,
  };
}

const GOAL_SPEED_MS = 1609.344 / (8 * 60); // 8:00/mi

function calmWeather(overrides: Partial<WeatherConditions> = {}): WeatherConditions {
  return {
    tempC: 15,
    relativeHumidityPct: 40,
    dewPointC: 5,
    cloudCoverPct: 20,
    pressureHPa: 1013,
    windSpeedMS: 0,
    windFromBearingDeg: 0,
    windGustsMS: 0,
    ...overrides,
  };
}

describe("computeMileCosts", () => {
  it("costs a flat course at zero, with no weather input, for every mile", () => {
    const course = buildCourse({ perMileGrade: [0, 0, 0], perMileHeadingDeg: [null, null, null] });
    const costs = computeMileCosts(course, { goalSpeedMS: GOAL_SPEED_MS });

    for (const mile of costs) {
      expect(mile.terrainSeconds).toBe(0);
      expect(mile.heatSeconds).toBe(0);
      expect(mile.humiditySeconds).toBe(0);
      expect(mile.windSeconds).toBe(0);
      expect(mile.totalSeconds).toBe(0);
    }
  });

  it("costs uphill miles positively and downhill miles negatively, asymmetrically", () => {
    const course = buildCourse({ perMileGrade: [0.06, -0.06], perMileHeadingDeg: [null, null] });
    const costs = computeMileCosts(course, { goalSpeedMS: GOAL_SPEED_MS });

    expect(costs[0].terrainSeconds).toBeGreaterThan(0);
    expect(costs[1].terrainSeconds).toBeLessThan(0);
    // Minetti's cost curve is asymmetric: a 6% climb costs more than a 6%
    // descent saves, so the uphill mile's magnitude should exceed the
    // downhill mile's.
    expect(costs[0].terrainSeconds).toBeGreaterThan(Math.abs(costs[1].terrainSeconds));
  });

  it("totalSeconds is always the sum of its own components", () => {
    const course = buildCourse({ perMileGrade: [0.03, -0.02, 0.01], perMileHeadingDeg: [0, 90, 180] });
    const costs = computeMileCosts(course, {
      goalSpeedMS: GOAL_SPEED_MS,
      weatherConditions: calmWeather({ tempC: 28, relativeHumidityPct: 70, windSpeedMS: 4 }),
    });

    for (const mile of costs) {
      expect(mile.totalSeconds).toBeCloseTo(mile.terrainSeconds + mile.heatSeconds + mile.humiditySeconds + mile.windSeconds, 9);
    }
  });

  it("apportions the whole-race heat/humidity totals across equal-length miles by time share, summing back exactly", () => {
    const mileCount = 4;
    const course = buildCourse({
      perMileGrade: new Array(mileCount).fill(0),
      perMileHeadingDeg: new Array(mileCount).fill(null),
    });
    const weatherConditions = calmWeather({ tempC: 30, relativeHumidityPct: 80 });
    const costs = computeMileCosts(course, { goalSpeedMS: GOAL_SPEED_MS, weatherConditions });

    const totalRaceSeconds = course.totalDistanceM / GOAL_SPEED_MS;
    const raceContext = { distanceMeters: course.totalDistanceM, actualTimeSeconds: totalRaceSeconds, paceMS: GOAL_SPEED_MS };
    const expectedHeatTotal = heatEngine.compute({ tempC: weatherConditions.tempC }, raceContext).adjustmentSeconds;
    const expectedHumidityTotal = humidityEngine.compute(
      { tempC: weatherConditions.tempC, relativeHumidityPct: weatherConditions.relativeHumidityPct },
      raceContext,
    ).adjustmentSeconds;

    const summedHeat = costs.reduce((sum, m) => sum + m.heatSeconds, 0);
    const summedHumidity = costs.reduce((sum, m) => sum + m.humiditySeconds, 0);
    expect(summedHeat).toBeCloseTo(expectedHeatTotal, 6);
    expect(summedHumidity).toBeCloseTo(expectedHumidityTotal, 6);

    // Equal-length miles under uniform (non-time-varying) conditions get an equal share.
    for (const mile of costs) {
      expect(mile.heatSeconds).toBeCloseTo(expectedHeatTotal / mileCount, 6);
    }
  });

  it("costs a headwind mile positively and the identical tailwind mile negatively", () => {
    const course = buildCourse({ perMileGrade: [0, 0], perMileHeadingDeg: [0, 0] }); // both miles head due north
    const headwind = computeMileCosts(course, {
      goalSpeedMS: GOAL_SPEED_MS,
      weatherConditions: calmWeather({ windSpeedMS: 6, windFromBearingDeg: 0 }), // wind from the north = headwind
    });
    const tailwind = computeMileCosts(course, {
      goalSpeedMS: GOAL_SPEED_MS,
      weatherConditions: calmWeather({ windSpeedMS: 6, windFromBearingDeg: 180 }), // wind from the south = tailwind
    });

    expect(headwind[0].windSeconds).toBeGreaterThan(0);
    expect(tailwind[0].windSeconds).toBeLessThan(0);
  });

  it("treats a mile with no known heading as having zero wind cost, even in strong wind", () => {
    const course = buildCourse({ perMileGrade: [0], perMileHeadingDeg: [null] });
    const costs = computeMileCosts(course, {
      goalSpeedMS: GOAL_SPEED_MS,
      weatherConditions: calmWeather({ windSpeedMS: 8, windFromBearingDeg: 0 }),
    });
    expect(costs[0].windSeconds).toBe(0);
  });
});
