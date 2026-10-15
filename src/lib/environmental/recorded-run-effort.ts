// Turns a recorded run's own real GPS trace (lat/lon/elevation/elapsed-time
// per point, from a watch file -- see route-import/types.ts's RoutePoint)
// into a per-stretch "effort" view: what pace this stretch was truly run
// at once the day's grade, wind, and heat/humidity are undone. This is
// new -- nothing in this codebase previously recomputed a recorded run's
// actual splits into their flat/calm/cool equivalent at anything finer
// than the whole-activity level (combine.ts's equivalentIdealTime works
// on one number for the entire effort). A friend's open-source race-pace
// planner's "Recorded runs" mode does this stretch-by-stretch; this
// module brings the same idea to this codebase's own already-ported
// physics, not a new model of its own.
//
// Deliberately NOT a new physics model: every "undo" step below is the
// existing "pace mode" (actual speed -> ideal-equivalent speed) direction
// each engine's own module already exposes and already tests --
// equivalentFlatSpeedForGradeMS (grade-pace-physics.ts),
// paceModeEquivalentSpeedMS (wind-physics.ts), and a direct application
// of the Davis log-speed relationship (heat-humidity-model.ts) this
// module composes for a per-stretch use the existing heat/humidity
// engines don't -- see undoHeatAndHumidity's own comment for exactly why
// it doesn't reuse secondsFromLogspeedAdjustment's linear approximation.
//
// Undo order mirrors the forward stacking order documented for this
// exact model family (grade -> wind -> heat, effort to actual) in
// reverse: heat is undone first, then wind, then grade -- each step
// peels off the outermost-applied effect first, the same way unwinding a
// function composition f(g(h(x))) starts from f.

import { haversineDistanceM, bearingDeg } from "@/lib/route-import/route-summary";
import type { ParsedRoute } from "@/lib/route-import/types";
import { equivalentFlatSpeedForGradeMS } from "@/lib/grade-pace-physics";
import {
  windAtChestHeightMS,
  windForwardLateral,
  relativeAngleFromTrueBearing,
  paceModeEquivalentSpeedMS,
  type WindProfile,
} from "@/lib/wind-physics";
import { logspeedAdjustment } from "@/lib/environmental/heat-humidity-model";
import { durationScaleFor } from "@/lib/environmental/heat-model";
import type { WeatherConditions } from "@/lib/environmental/fetch-weather-conditions";

export type RecordedStretch = {
  startDistanceM: number;
  endDistanceM: number;
  distanceM: number;
  /** Real elapsed seconds from the run's own start to this stretch's start -- used to pick the weather reading that actually applied when this stretch was run, not a distance-proportional guess (a run with stops would make that guess wrong). */
  startElapsedSeconds: number;
  elapsedSeconds: number;
  /** This stretch's real, as-recorded speed -- distance/time, nothing undone. */
  actualSpeedMS: number;
  gradeDecimal: number;
  headingDeg: number | null;
  /**
   * True when this stretch is excluded from the effort view -- near-
   * stationary (a stoplight, a water stop the device didn't auto-pause
   * through) or well below the run's own median moving pace (the same
   * two criteria a friend's open-source planner's own "Recorded runs"
   * mode uses). Its time still counts toward the run's total elapsed
   * time; it just isn't costed as effort, the same way this codebase
   * already treats a stop in other contexts.
   */
  isStop: boolean;
  /** The flat/calm/cool-equivalent speed this stretch's effort was worth -- null for a stop, where "effort" isn't a meaningful question. */
  effortSpeedMS: number | null;
};

export type RecordedRunEffortOptions = {
  /** Distance over which actual pace is measured before any smoothing -- shorter resolves real pace changes (a hill, a surge) more precisely; longer is less sensitive to GPS noise. */
  stretchLengthM?: number;
  weightKg?: number;
  windProfile?: WindProfile;
  /** A stretch below this speed (m/s) is a stop regardless of the run's own pace -- catches a dead stop even on an otherwise very slow run. */
  stopSpeedThresholdMS?: number;
  /** A stretch below this fraction of the run's median moving speed is also a stop -- catches "stopped to take a photo" on an otherwise brisk run, where the stretch is still technically moving. */
  stopEffortFraction?: number;
};

const DEFAULT_STRETCH_LENGTH_M = 100;
const DEFAULT_WEIGHT_KG = 68;
const DEFAULT_WIND_PROFILE: WindProfile = "suburban";
const DEFAULT_STOP_SPEED_THRESHOLD_MS = 0.5; // ~1800m/hr -- a brisk walk is faster than this; a stoplight wait is not
const DEFAULT_STOP_EFFORT_FRACTION = 0.6; // matches the open-source planner's own documented threshold

type RawPoint = { distanceM: number; elevationM: number; lat: number; lon: number; elapsedSeconds: number };

function buildRawPoints(route: ParsedRoute): RawPoint[] {
  const points: RawPoint[] = [];
  let cumulativeDistanceM = 0;
  let previous: { lat: number; lon: number } | null = null;
  let lastKnownElevationM: number | null = null;

  for (const point of route.points) {
    if (point.lat === null || point.lon === null || point.elapsedSeconds === null) continue;
    if (previous) cumulativeDistanceM += haversineDistanceM(previous.lat, previous.lon, point.lat, point.lon);
    previous = { lat: point.lat, lon: point.lon };
    if (point.elevationM !== null) lastKnownElevationM = point.elevationM;
    if (lastKnownElevationM !== null) {
      points.push({ distanceM: cumulativeDistanceM, elevationM: lastKnownElevationM, lat: point.lat, lon: point.lon, elapsedSeconds: point.elapsedSeconds });
    }
  }
  return points;
}

/** Linear interpolation of elevation/elapsed time (both vary smoothly with distance) at an arbitrary target distance along the raw point sequence. */
function interpolateAt(points: RawPoint[], targetDistanceM: number, sampleIdx: number): { elevationM: number; elapsedSeconds: number; lat: number; lon: number; sampleIdx: number } {
  while (sampleIdx < points.length - 2 && points[sampleIdx + 1].distanceM < targetDistanceM) sampleIdx++;
  const a = points[sampleIdx];
  const b = points[Math.min(sampleIdx + 1, points.length - 1)];
  const span = b.distanceM - a.distanceM;
  const t = span > 0 ? (targetDistanceM - a.distanceM) / span : 0;
  return {
    elevationM: a.elevationM + (b.elevationM - a.elevationM) * t,
    elapsedSeconds: a.elapsedSeconds + (b.elapsedSeconds - a.elapsedSeconds) * t,
    lat: a.lat + (b.lat - a.lat) * t,
    lon: a.lon + (b.lon - a.lon) * t,
    sampleIdx,
  };
}

/**
 * Undoes heat and humidity's combined effect directly, via the Davis
 * log-speed relationship these grids already encode (ln(v_hot) =
 * ln(v_cool) + adj, so v_cool = v_hot / exp(adj)) -- NOT via
 * heat-model.ts's secondsFromLogspeedAdjustment, which deliberately
 * linearizes that relationship so HeatEngine + HumidityEngine's split
 * sums exactly with no double-counting (see that function's own comment).
 * This module has no such split to preserve -- it wants the one real,
 * combined, exact effect for a single stretch -- so it uses the exact
 * exponential form the model actually describes, scaled by the whole
 * run's own real duration (durationScaleFor), matching the model's
 * documented calibration to whole-effort length.
 */
function undoHeatAndHumidity(actualSpeedMS: number, tempC: number, humidityPct: number, wholeRunDurationSeconds: number): number {
  const rawAdjustment = logspeedAdjustment(tempC, humidityPct);
  const scaledAdjustment = rawAdjustment * durationScaleFor(wholeRunDurationSeconds);
  return actualSpeedMS / Math.exp(scaledAdjustment);
}

/**
 * The full per-stretch "undo everything" chain, in the reverse of the
 * forward effort->actual order (grade, then wind, then heat): heat is
 * undone first (the outermost-applied effect), then wind, then grade,
 * leaving the flat/calm/cool-equivalent speed the stretch's effort was
 * actually worth.
 */
function undoConditions(
  actualSpeedMS: number,
  gradeDecimal: number,
  headingDeg: number | null,
  conditions: WeatherConditions,
  wholeRunDurationSeconds: number,
  weightKg: number,
  windProfile: WindProfile,
): number | null {
  const afterHeat = undoHeatAndHumidity(actualSpeedMS, conditions.tempC, conditions.relativeHumidityPct, wholeRunDurationSeconds);

  let afterWind = afterHeat;
  if (headingDeg !== null) {
    const windAtChest = windAtChestHeightMS(conditions.windSpeedMS, windProfile);
    const relativeAngle = relativeAngleFromTrueBearing(conditions.windFromBearingDeg, headingDeg);
    const { forward, lateral } = windForwardLateral(windAtChest, relativeAngle);
    const windUndone = paceModeEquivalentSpeedMS(afterHeat, forward, lateral, weightKg);
    if (windUndone !== null) afterWind = windUndone;
  }

  return equivalentFlatSpeedForGradeMS(afterWind, gradeDecimal);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Resolves whichever weather reading is closest in elapsed-run-time to a
 * stretch's own midpoint -- mirrors fetch-weather-conditions.ts's own
 * "closest hour" matching, just keyed on elapsed seconds into the run
 * instead of a wall-clock reading, since that's what's actually known
 * here (the caller is responsible for having already resolved each
 * reading's own elapsed-seconds offset from the run's start, e.g. from
 * fetchConditionsWindow's hourly points paired with their own offsets).
 */
function nearestConditions(readings: { elapsedSeconds: number; conditions: WeatherConditions }[], atElapsedSeconds: number): WeatherConditions {
  let best = readings[0];
  let bestDiff = Infinity;
  for (const reading of readings) {
    const diff = Math.abs(reading.elapsedSeconds - atElapsedSeconds);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = reading;
    }
  }
  return best.conditions;
}

/**
 * The main entry point: resamples a recorded route into even-length
 * stretches carrying real elapsed time, flags stops, and -- for every
 * non-stop stretch -- undoes grade, wind, and heat/humidity to produce
 * the flat/calm/cool-equivalent effort speed. Requires real per-point
 * elapsed time (a GPX/TCX/FIT file from a watch, not a hand-drawn route
 * with no timestamps) -- throws if none is present, same as
 * analyzeCourse throwing on too little route data, rather than silently
 * returning a meaningless result.
 */
export function computeRecordedRunEffort(
  route: ParsedRoute,
  weatherReadings: { elapsedSeconds: number; conditions: WeatherConditions }[],
  options: RecordedRunEffortOptions = {},
): RecordedStretch[] {
  const stretchLengthM = options.stretchLengthM ?? DEFAULT_STRETCH_LENGTH_M;
  const weightKg = options.weightKg ?? DEFAULT_WEIGHT_KG;
  const windProfile = options.windProfile ?? DEFAULT_WIND_PROFILE;
  const stopSpeedThresholdMS = options.stopSpeedThresholdMS ?? DEFAULT_STOP_SPEED_THRESHOLD_MS;
  const stopEffortFraction = options.stopEffortFraction ?? DEFAULT_STOP_EFFORT_FRACTION;

  const points = buildRawPoints(route);
  if (points.length < 2) {
    throw new Error("computeRecordedRunEffort requires a route with real per-point GPS and elapsed-time data.");
  }
  if (weatherReadings.length === 0) {
    throw new Error("computeRecordedRunEffort requires at least one weather reading for this run's own time window.");
  }

  const totalDistanceM = points[points.length - 1].distanceM;
  const runStartElapsedSeconds = points[0].elapsedSeconds;
  const wholeRunDurationSeconds = points[points.length - 1].elapsedSeconds - runStartElapsedSeconds;
  const stretchCount = Math.max(1, Math.floor(totalDistanceM / stretchLengthM));

  type PreStop = Omit<RecordedStretch, "isStop" | "effortSpeedMS">;
  const preStretches: PreStop[] = [];
  let sampleIdx = 0;
  let previousBoundary = interpolateAt(points, 0, 0);
  for (let i = 1; i <= stretchCount; i++) {
    const targetDistanceM = i === stretchCount ? totalDistanceM : i * stretchLengthM;
    const boundary = interpolateAt(points, targetDistanceM, sampleIdx);
    sampleIdx = boundary.sampleIdx;

    const startDistanceM = (i - 1) * stretchLengthM;
    const distanceM = targetDistanceM - startDistanceM;
    const startElapsedSeconds = previousBoundary.elapsedSeconds - runStartElapsedSeconds;
    const elapsedSeconds = boundary.elapsedSeconds - previousBoundary.elapsedSeconds;
    const actualSpeedMS = elapsedSeconds > 0 ? distanceM / elapsedSeconds : 0;
    const gradeDecimal = distanceM > 0 ? (boundary.elevationM - previousBoundary.elevationM) / distanceM : 0;
    const headingDeg =
      previousBoundary.lat === boundary.lat && previousBoundary.lon === boundary.lon
        ? null
        : bearingDeg(previousBoundary.lat, previousBoundary.lon, boundary.lat, boundary.lon);

    preStretches.push({ startDistanceM, endDistanceM: targetDistanceM, distanceM, startElapsedSeconds, elapsedSeconds, actualSpeedMS, gradeDecimal, headingDeg });
    previousBoundary = boundary;
  }

  const medianSpeedMS = median(preStretches.map((s) => s.actualSpeedMS).filter((s) => s > 0));

  return preStretches.map((stretch) => {
    const isStop = stretch.actualSpeedMS < stopSpeedThresholdMS || stretch.actualSpeedMS < medianSpeedMS * stopEffortFraction;
    if (isStop) return { ...stretch, isStop: true, effortSpeedMS: null };

    // The stretch's own real recorded elapsed time, not a distance-
    // proportional guess -- a guess would quietly drift wrong around any
    // stop, since a stop adds real elapsed time without adding distance.
    const conditions = nearestConditions(weatherReadings, stretch.startElapsedSeconds);
    const effortSpeedMS = undoConditions(stretch.actualSpeedMS, stretch.gradeDecimal, stretch.headingDeg, conditions, wholeRunDurationSeconds, weightKg, windProfile);
    return { ...stretch, isStop: false, effortSpeedMS };
  });
}

/** Convenience aggregate: the median effort speed across every non-stop stretch -- the single "how was this run really" headline number, with the per-stretch detail still available for a chart/table. */
export function medianEffortSpeedMS(stretches: RecordedStretch[]): number | null {
  const efforts = stretches.filter((s) => !s.isStop && s.effortSpeedMS !== null).map((s) => s.effortSpeedMS!);
  return efforts.length > 0 ? median(efforts) : null;
}

const MILE_METERS = 1609.344;

export type PerMileEffortSummary = {
  mileIndex: number; // 0-based
  startDistanceM: number;
  endDistanceM: number;
  /** Real recorded pace for this mile -- total elapsed time (including any stop) over total distance, converted to seconds/mile. */
  actualPaceSPerMi: number;
  /** The flat/calm/cool-equivalent pace this mile's effort was worth, seconds/mile -- null if every stretch in the mile was a stop (no effort to report). */
  effortPaceSPerMi: number | null;
  hasStop: boolean;
};

/**
 * Rolls the fine per-stretch detail up to one row per full mile -- matching
 * this codebase's own existing convention (course-analysis.ts's
 * perMileGrade/perMileTerrainCostJPerKg) for what a coach or athlete
 * actually wants to look at, rather than the raw ~100m-stretch table a
 * long run would otherwise produce (a marathon at 100m stretches is 420+
 * rows). A trailing partial mile at the end of the route is included as
 * its own, shorter row rather than dropped or merged into the prior mile.
 */
export function aggregateRecordedEffortByMile(stretches: RecordedStretch[]): PerMileEffortSummary[] {
  const byMile = new Map<number, RecordedStretch[]>();
  for (const stretch of stretches) {
    const mileIndex = Math.floor(stretch.startDistanceM / MILE_METERS);
    const bucket = byMile.get(mileIndex) ?? [];
    bucket.push(stretch);
    byMile.set(mileIndex, bucket);
  }

  return [...byMile.entries()]
    .sort(([a], [b]) => a - b)
    .map(([mileIndex, mileStretches]) => {
      const startDistanceM = mileStretches[0].startDistanceM;
      const endDistanceM = mileStretches[mileStretches.length - 1].endDistanceM;
      const totalDistanceM = mileStretches.reduce((sum, s) => sum + s.distanceM, 0);
      const totalElapsedSeconds = mileStretches.reduce((sum, s) => sum + s.elapsedSeconds, 0);
      const actualPaceSPerMi = totalDistanceM > 0 ? (totalElapsedSeconds / totalDistanceM) * MILE_METERS : 0;

      const effortSpeeds = mileStretches.filter((s) => !s.isStop && s.effortSpeedMS !== null).map((s) => s.effortSpeedMS!);
      const effortPaceSPerMi = effortSpeeds.length > 0 ? MILE_METERS / median(effortSpeeds) : null;

      return {
        mileIndex,
        startDistanceM,
        endDistanceM,
        actualPaceSPerMi,
        effortPaceSPerMi,
        hasStop: mileStretches.some((s) => s.isStop),
      };
    });
}
