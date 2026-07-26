// Combines real per-mile terrain cost with the site's existing heat,
// humidity, and wind adjustment engines into one "how many seconds does
// this specific mile cost, relative to goal pace on a flat, windless,
// temperate course" answer.
//
// Terrain uses grade-pace-physics.ts (the real Minetti et al. 2002
// polynomial) against each mile's own actual grade from course-analysis.ts
// -- not the standalone Environmental Performance Calculator's
// elevation-engine.ts, which (by its own documentation) only has a total
// gain/loss figure to work with and has to assume a single representative
// grade. A real per-mile grade is exactly the upgrade that engine's own
// comments anticipate once route data was available.
//
// Heat and humidity are duration-driven, not location-driven -- ambient
// temperature doesn't meaningfully vary mile to mile on a single race day,
// but heat-model.ts's duration-scaling curve means the effect compounds
// over the length of the whole effort. Recomputing the heat/humidity
// engines independently per mile (with a mile-sized duration) would
// incorrectly re-trigger their MIN_DURATION_SCALE clamp on every mile and
// badly understate the total. Instead, this computes each engine's total
// ONCE for the whole race, then apportions that total across miles by time
// share, so the miles' shares always sum back to the exact same
// already-validated whole-race number.
//
// Wind, by contrast, genuinely is local -- a mile's own heading relative to
// the wind changes its cost mile to mile -- so it's computed fresh per mile
// using that mile's real average heading, following the same
// paceModeEquivalentSpeedMS pattern wind-engine.ts already uses.

import { flatPowerWPerKg, gradeAddedCostJPerKgM } from "@/lib/grade-pace-physics";
import { heatEngine } from "@/lib/environmental/heat-engine";
import { humidityEngine } from "@/lib/environmental/humidity-engine";
import type { WeatherConditions } from "@/lib/environmental/fetch-weather-conditions";
import {
  paceModeEquivalentSpeedMS,
  relativeAngleFromTrueBearing,
  windAtChestHeightMS,
  windForwardLateral,
  type WindProfile,
} from "@/lib/wind-physics";
import type { CourseAnalysis } from "@/lib/marathon-pacing/course-analysis";

const METERS_PER_MILE = 1609.344;
const DEFAULT_WEIGHT_KG = 70; // used only for wind's drag-force physics when the runner hasn't supplied their own weight
const DEFAULT_WIND_PROFILE: WindProfile = "suburban";

export type MileCost = {
  mile: number;
  grade: number;
  headingDeg: number | null;
  terrainSeconds: number;
  heatSeconds: number;
  humiditySeconds: number;
  windSeconds: number;
  totalSeconds: number;
};

export type MileCostModelInput = {
  /** The runner's goal speed on flat, calm, temperate ground -- what every mile's cost is measured relative to. */
  goalSpeedMS: number;
  weatherConditions?: WeatherConditions;
  weightKg?: number;
  windProfile?: WindProfile;
};

function terrainSecondsForMile(grade: number, mileDistanceM: number, averagePowerWPerKg: number): number {
  const addedEnergyJPerKg = gradeAddedCostJPerKgM(grade) * mileDistanceM;
  return addedEnergyJPerKg / averagePowerWPerKg;
}

function windSecondsForMile(
  headingDeg: number | null,
  mileDistanceM: number,
  goalSpeedMS: number,
  weatherConditions: WeatherConditions | undefined,
  weightKg: number,
  windProfile: WindProfile,
): number {
  if (!weatherConditions || headingDeg === null || weatherConditions.windSpeedMS <= 0) return 0;

  const chestWindMS = windAtChestHeightMS(weatherConditions.windSpeedMS, windProfile);
  const relativeAngleDeg = relativeAngleFromTrueBearing(weatherConditions.windFromBearingDeg, headingDeg);
  const { forward, lateral } = windForwardLateral(chestWindMS, relativeAngleDeg);

  const equivalentSpeedMS = paceModeEquivalentSpeedMS(goalSpeedMS, forward, lateral, weightKg);
  if (equivalentSpeedMS === null || equivalentSpeedMS <= 0) return 0;

  const idealTimeSeconds = mileDistanceM / equivalentSpeedMS;
  const actualTimeSeconds = mileDistanceM / goalSpeedMS;
  return actualTimeSeconds - idealTimeSeconds;
}

export function computeMileCosts(course: CourseAnalysis, input: MileCostModelInput): MileCost[] {
  const { goalSpeedMS } = input;
  const weightKg = input.weightKg ?? DEFAULT_WEIGHT_KG;
  const windProfile = input.windProfile ?? DEFAULT_WIND_PROFILE;
  const averagePowerWPerKg = flatPowerWPerKg(goalSpeedMS);

  const totalRaceSeconds = course.totalDistanceM / goalSpeedMS;
  const raceContext = { distanceMeters: course.totalDistanceM, actualTimeSeconds: totalRaceSeconds, paceMS: goalSpeedMS };

  let totalHeatSeconds = 0;
  let totalHumiditySeconds = 0;
  if (input.weatherConditions) {
    const { tempC, relativeHumidityPct } = input.weatherConditions;
    if (heatEngine.isApplicable({ tempC })) {
      totalHeatSeconds = heatEngine.compute({ tempC }, raceContext).adjustmentSeconds;
    }
    if (humidityEngine.isApplicable({ tempC, relativeHumidityPct })) {
      totalHumiditySeconds = humidityEngine.compute({ tempC, relativeHumidityPct }, raceContext).adjustmentSeconds;
    }
  }

  return course.perMileGrade.map((grade, i) => {
    const mileDistanceM = METERS_PER_MILE; // full miles only, matching perMileGrade's own scope
    const mileTimeShare = mileDistanceM / course.totalDistanceM; // matches how the whole-race total was itself computed, so shares sum back exactly

    const terrainSeconds = terrainSecondsForMile(grade, mileDistanceM, averagePowerWPerKg);
    const heatSeconds = totalHeatSeconds * mileTimeShare;
    const humiditySeconds = totalHumiditySeconds * mileTimeShare;
    const headingDeg = course.perMileHeadingDeg[i];
    const windSeconds = windSecondsForMile(headingDeg, mileDistanceM, goalSpeedMS, input.weatherConditions, weightKg, windProfile);

    return {
      mile: i + 1,
      grade,
      headingDeg,
      terrainSeconds,
      heatSeconds,
      humiditySeconds,
      windSeconds,
      totalSeconds: terrainSeconds + heatSeconds + humiditySeconds + windSeconds,
    };
  });
}
