// Conditions-adjusted actuals: composes the environmental engine's own
// recorded-run effort model (src/lib/environmental/recorded-run-effort.ts)
// for one Strava-matched completed workout, and derives a plain-language
// per-factor breakdown from it. Pure -- no Supabase, no Strava client, no
// network. The Supabase/Strava-touching orchestration that calls this
// lives in completion-conditions-service.ts; this file only composes
// already-fetched GPS/weather data and runs the existing, UNMODIFIED
// engine (computeRecordedRunEffort) against it.
//
// WHY A SEPARATE PER-FACTOR BREAKDOWN, RATHER THAN THE ENGINE'S OWN
// EngineResult (combine.ts): recorded-run-effort.ts undoes heat/humidity,
// wind, and grade as one per-stretch chain (see its own module comment on
// undo order) -- it was never built to report each factor's own
// contribution separately, and its private undo helpers aren't exported.
// Rather than touch that file to expose them (explicitly out of scope),
// this module isolates Wind and Grade by re-running the SAME public,
// unmodified computeRecordedRunEffort with one input neutralized at a
// time (zero wind speed; a flattened elevation profile) and comparing
// the resulting total time against the real, fully-corrected total.
// Heat & humidity's own contribution is then the exact remainder (total
// adjustment minus Wind's and Grade's own isolated contributions) --
// never a guessed "neutral temperature," which the model's own data
// (heat-humidity-model.ts) has no single clean value for. This is exact
// by construction for Wind and Grade, and exact-as-a-remainder (which
// may absorb a small interaction term) for Heat & humidity -- consistent
// with this codebase's existing discipline of showing a defensible
// estimate rather than false precision (types.ts's own confidence-range
// convention).

import type { ParsedRoute, RoutePoint } from "@/lib/route-import/types";
import { computeRecordedRunEffort, type RecordedRunEffortOptions, type RecordedStretch } from "@/lib/environmental/recorded-run-effort";
import type { WeatherConditions } from "@/lib/environmental/fetch-weather-conditions";

const MILE_METERS = 1609.344;

export type ConditionsFactorKey = "heat_humidity" | "wind" | "grade";

export type ConditionsFactorBreakdown = {
  factor: ConditionsFactorKey;
  /** Plain-language label, matching the Environmental Calculator's own voice (e.g. heat-engine.ts's "Heat"). */
  label: string;
  /** Seconds/mile this factor cost (positive) or saved (negative), averaged over the whole run. */
  secPerMi: number;
};

export type WeatherReading = { elapsedSeconds: number; conditions: WeatherConditions };

export type ConditionsBreakdownResult = {
  distanceM: number;
  actualTimeS: number;
  idealTimeS: number;
  actualPaceSPerMi: number;
  idealPaceSPerMi: number;
  /** Largest-contribution first -- what "top contributing factors" (the task's own display requirement) actually shows. */
  factors: ConditionsFactorBreakdown[];
};

/**
 * One source activity's own raw summary, for composing a combined
 * multi-segment session into one continuous route (see composeRoutes
 * below) -- startTimeIso is each activity's own absolute start, used to
 * offset its points onto one shared elapsed-seconds timeline anchored at
 * the earliest activity.
 */
export type ActivityRoute = { route: ParsedRoute; startTimeIso: string };

/**
 * Composes 1+ Strava activities (already fetched, already in start-time
 * order) into the single continuous ParsedRoute computeRecordedRunEffort
 * expects. A single activity passes through unchanged. For 2+ (a
 * combined multi-segment session -- see completed_workouts.
 * strava_activity_ids), each subsequent activity's points are offset by
 * its own start time minus the first activity's start time, so every
 * point shares one real elapsed-seconds timeline. A real gap between
 * segments (the athlete stopped the watch, walked to the start line,
 * started again) reads as a near-zero-speed stretch once resampled --
 * exactly the same "stop" detection computeRecordedRunEffort already
 * applies to an in-activity pause (a stoplight, a water stop), not a
 * special case this function needs to handle itself.
 */
export function composeRoutes(activities: ActivityRoute[]): ParsedRoute {
  if (activities.length === 0) throw new Error("composeRoutes requires at least one activity.");
  if (activities.length === 1) return activities[0].route;

  const sorted = [...activities].sort((a, b) => a.startTimeIso.localeCompare(b.startTimeIso));
  const firstStartMs = new Date(sorted[0].startTimeIso).getTime();

  const points: RoutePoint[] = [];
  for (const { route, startTimeIso } of sorted) {
    const offsetSeconds = (new Date(startTimeIso).getTime() - firstStartMs) / 1000;
    for (const point of route.points) {
      points.push({
        ...point,
        elapsedSeconds: point.elapsedSeconds !== null ? point.elapsedSeconds + offsetSeconds : null,
      });
    }
  }

  const totalMovingTimeS = sorted.reduce((sum, { route }) => (route.movingTimeS != null ? sum + route.movingTimeS : sum), 0);

  return {
    points,
    source: "strava",
    startTimeIso: sorted[0].startTimeIso,
    movingTimeS: sorted.every(({ route }) => route.movingTimeS != null) ? totalMovingTimeS : null,
  };
}

/**
 * Mirrors environmental-calculator.tsx's own established approximation
 * exactly (recordedEffortByMile's own comment): Open-Meteo's hourly
 * conditions window doesn't carry each reading's own elapsed-seconds-
 * into-the-run offset, so a single reading is "at the start," and
 * multiple readings are spread evenly an hour apart -- the same stand-in
 * this codebase already uses elsewhere, not a new approximation.
 */
export function buildWeatherReadings(points: WeatherConditions[]): WeatherReading[] {
  return points.length === 1
    ? [{ elapsedSeconds: 0, conditions: points[0] }]
    : points.map((conditions, i) => ({ elapsedSeconds: i * 3600, conditions }));
}

function totalTimes(stretches: RecordedStretch[]): { actualTimeS: number; idealTimeS: number; distanceM: number } {
  let actualTimeS = 0;
  let idealTimeS = 0;
  let distanceM = 0;
  for (const s of stretches) {
    actualTimeS += s.elapsedSeconds;
    distanceM += s.distanceM;
    idealTimeS += s.isStop || s.effortSpeedMS == null ? s.elapsedSeconds : s.distanceM / s.effortSpeedMS;
  }
  return { actualTimeS, idealTimeS, distanceM };
}

function withZeroWind(readings: WeatherReading[]): WeatherReading[] {
  return readings.map((r) => ({ ...r, conditions: { ...r.conditions, windSpeedMS: 0 } }));
}

/** A route with every point's elevation collapsed to its first known value -- grade is ~0 everywhere, so equivalentFlatSpeedForGradeMS becomes a no-op. */
function withFlattenedElevation(route: ParsedRoute): ParsedRoute {
  const firstKnown = route.points.find((p) => p.elevationM !== null)?.elevationM ?? 0;
  return { ...route, points: route.points.map((p) => ({ ...p, elevationM: p.elevationM !== null ? firstKnown : null })) };
}

/**
 * The main entry point: runs computeRecordedRunEffort on the real route
 * and conditions (the headline actual-vs-ideal pace/time), then twice
 * more with wind and grade each neutralized in turn to isolate their own
 * contributions, attributing the remainder to heat & humidity. See this
 * module's own header comment for why this ablation approach (not the
 * engine's own private undo steps) is what produces the breakdown.
 */
export function computeConditionsBreakdown(
  route: ParsedRoute,
  weatherReadings: WeatherReading[],
  options: RecordedRunEffortOptions = {},
): ConditionsBreakdownResult {
  const full = totalTimes(computeRecordedRunEffort(route, weatherReadings, options));
  const noWind = totalTimes(computeRecordedRunEffort(route, withZeroWind(weatherReadings), options));
  const noGrade = totalTimes(computeRecordedRunEffort(withFlattenedElevation(route), weatherReadings, options));

  const totalAdjustmentS = full.actualTimeS - full.idealTimeS;
  const windS = noWind.idealTimeS - full.idealTimeS;
  const gradeS = noGrade.idealTimeS - full.idealTimeS;
  const heatHumidityS = totalAdjustmentS - windS - gradeS;

  const distanceMi = full.distanceM / MILE_METERS;
  const toSecPerMi = (s: number) => (distanceMi > 0 ? s / distanceMi : 0);

  const unsorted: ConditionsFactorBreakdown[] = [
    { factor: "heat_humidity", label: "Heat & humidity", secPerMi: toSecPerMi(heatHumidityS) },
    { factor: "wind", label: "Wind", secPerMi: toSecPerMi(windS) },
    { factor: "grade", label: "Grade / hills", secPerMi: toSecPerMi(gradeS) },
  ];
  const factors = unsorted.sort((a, b) => Math.abs(b.secPerMi) - Math.abs(a.secPerMi));

  return {
    distanceM: full.distanceM,
    actualTimeS: full.actualTimeS,
    idealTimeS: full.idealTimeS,
    actualPaceSPerMi: distanceMi > 0 ? full.actualTimeS / distanceMi : 0,
    idealPaceSPerMi: distanceMi > 0 ? full.idealTimeS / distanceMi : 0,
    factors,
  };
}
