"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";

import { ConfidenceRangeBar } from "@/components/confidence-range-bar";
import { ContentCallout } from "@/components/content-callout";
import { EquivalentPerformanceBar } from "@/components/equivalent-performance-bar";
import { LocationSearchField } from "@/components/location-search-field";
import { RouteImportPanel } from "@/components/route-import-panel";
import { SaveCalculationButton } from "@/components/save-calculation-button";
import { TrackDiagram } from "@/components/track-diagram";
import { compassPointLabel, WindCompass } from "@/components/wind-compass";
import { WindRelativeIndicator } from "@/components/wind-relative-indicator";
import {
  combineAdjustments,
  convertBetweenConditions,
  equivalentIdealTime,
  predictedActualTime,
  type CombinedAdjustment,
  type TimeEstimate,
} from "@/lib/environmental/combine";
import { elevationEngine, type ElevationEngineInput } from "@/lib/environmental/elevation-engine";
import type { WeatherConditions } from "@/lib/environmental/fetch-weather-conditions";
import { heatEngine, type HeatEngineInput } from "@/lib/environmental/heat-engine";
import { humidityEngine, type HumidityEngineInput } from "@/lib/environmental/humidity-engine";
import { inferWorkoutType, type WorkoutTypeGuess } from "@/lib/environmental/infer-workout-type";
import { buildConfidenceReasons, overallConfidenceLevel } from "@/lib/environmental/confidence-explanation";
import { buildSavedAnalysis } from "@/lib/environmental/saved-analysis";
import { buildCoachingSummary, buildCoachNotes } from "@/lib/environmental/coaching-summary";
import { routeWindEngine, type RouteWindEngineInput } from "@/lib/environmental/route-wind-engine";
import { trackWindEngine, type TrackWindEngineInput } from "@/lib/environmental/track-wind-engine";
import type { EngineResult, PerformanceContext } from "@/lib/environmental/types";
import { useEnvironmentalWeather } from "@/lib/environmental/use-environmental-weather";
import { windEngine, type WindEngineInput } from "@/lib/environmental/wind-engine";
import {
  perUnitAdjustmentSeconds,
  resolveWorkoutBout,
  scaleResultsPerUnit,
  trainingGuidance,
  type WorkoutInputMode,
} from "@/lib/environmental/workout-pace";
import { WORKOUT_TYPE_CONFIG, WORKOUT_TYPE_ORDER, type WorkoutType } from "@/lib/environmental/workout-types";
import { fieldClass, labelClass } from "@/lib/form-styles";
import type { RouteSummary } from "@/lib/route-import/route-summary";
import { formatClock, formatTrackTime, parseTimeToSeconds, parseTrackTime } from "@/lib/running-format";
import {
  ALT_PAIR,
  REP_DESCRIPTIONS,
  REP_SEGMENTS,
  REP_TYPE_OPTIONS,
  type RepType,
  type SpeedOrEffort,
} from "@/lib/track-wind-physics";
import {
  detailsBodyClass,
  detailsClass,
  heroCardClass,
  pageSectionHeadingClass,
  sectionLabelClass,
  segmentedButtonClass,
  statCardClass,
  statLabelClass,
  summaryClass,
} from "@/lib/tool-styles";
import { usePersistedField, usePersistedJSON } from "@/lib/use-persisted-field";
import { fetchExposureScore } from "@/lib/terrain/overpass-exposure";
import {
  EXPOSURE_LABEL_HINT,
  EXPOSURE_LABEL_ORDER,
  EXPOSURE_LABEL_SCORE,
  EXPOSURE_LABEL_TEXT,
  exposureLabelFor,
  type ExposureLabel,
} from "@/lib/wind-exposure";
import { WIND_PROFILE_OPTIONS, WIND_SPEED_LABEL, WIND_SPEED_TO_MS, type WindSpeedUnit } from "@/lib/wind-units";
import { relativeAngleFromTrueBearing, type WindProfile } from "@/lib/wind-physics";

type DistancePreset = "800m" | "1500m" | "mile" | "3k" | "5k" | "8k" | "10k" | "half" | "marathon" | "custom";
type CourseType = "road" | "track" | "route";
type GoalMode = "analyze" | "predict" | "convert" | "adjust";
type TempUnit = "c" | "f";
type WeightUnit = "lbs" | "kg";
type ElevationUnit = "m" | "ft";
type WeatherSource = "manual" | "auto";
type PaceDisplayUnit = "mi" | "km";

const PACE_DISPLAY_UNIT_METERS: Record<PaceDisplayUnit, number> = { mi: 1609.344, km: 1000 };

const DISTANCE_METERS: Record<Exclude<DistancePreset, "custom">, number> = {
  "800m": 800,
  "1500m": 1500,
  mile: 1609.344,
  "3k": 3000,
  "5k": 5000,
  "8k": 8000,
  "10k": 10000,
  half: 21097.5,
  marathon: 42195,
};

const DISTANCE_ORDER: DistancePreset[] = ["800m", "1500m", "mile", "3k", "5k", "8k", "10k", "half", "marathon", "custom"];

const DISTANCE_LABEL: Record<DistancePreset, string> = {
  "800m": "800m",
  "1500m": "1500m",
  mile: "Mile",
  "3k": "3K",
  "5k": "5K",
  "8k": "8K",
  "10k": "10K",
  half: "Half Marathon",
  marathon: "Marathon",
  custom: "Custom distance",
};

const GOAL_MODE_COPY: Record<GoalMode, { button: string; timeLabel: string; helper: string; resultLabel: string }> = {
  analyze: {
    button: "Analyze a past run",
    timeLabel: "Time you actually ran",
    helper: "See what that performance was really worth once heat, wind, humidity, and hills are stripped out.",
    resultLabel: "Equivalent Performance in Ideal Conditions",
  },
  predict: {
    button: "Predict a race",
    timeLabel: "Time you can run in ideal conditions",
    helper: "Estimate what to expect on race day once the forecast and course are factored in.",
    resultLabel: "Predicted race-day time",
  },
  convert: {
    button: "Compare two conditions",
    timeLabel: "Time you actually ran",
    helper: "See what the same performance would be worth under a different set of conditions.",
    resultLabel: "Equivalent Performance Under Conditions B",
  },
  adjust: {
    button: "Adjust workout paces",
    timeLabel: "Planned time",
    helper: "Get the pace to run today's workout so it still delivers the training effect it's meant to.",
    resultLabel: "Recommended workout pace",
  },
};

const WEIGHT_DEFAULT_LBS = 150;
const WEIGHT_DEFAULT_KG = 68;
const STORAGE_KEY = "haarchive-environmental-calculator-state";

type PersistedState = {
  courseType: CourseType;
  distancePreset: DistancePreset;
  customDistanceInput: string;
  repType: RepType;
  speedOrEffort: SpeedOrEffort;
  timeInput: string;
  goalMode: GoalMode;
  weightInput: string;
  weightUnit: WeightUnit;
  headingDeg: number;
  windProfile: WindProfile;
  windExposureScore: number;
  elevationGainInput: string;
  elevationLossInput: string;
  elevationUnit: ElevationUnit;
  sourceA: WeatherSource;
  tempInputA: string;
  tempUnitA: TempUnit;
  rhInputA: string;
  windSpeedInputA: string;
  windSpeedUnitA: WindSpeedUnit;
  relativeWindAngleA: number;
  workoutType: WorkoutType;
  workoutPaceInput: string;
  paceDisplayUnit: PaceDisplayUnit;
  workoutInputMode: WorkoutInputMode;
  workoutDistanceInput: string;
  workoutDurationInput: string;
  showAdvanced: boolean;
  showEducation: boolean;
};

type ResolvedConditions = {
  tempC: number;
  relativeHumidityPct: number;
  windSpeedMS: number;
  windFromBearingDeg: number;
  runnerHeadingBearingDeg: number;
};

function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

function fToC(f: number): number {
  return ((f - 32) * 5) / 9;
}

function mToFt(m: number): number {
  return m * 3.28084;
}

function ftToM(ft: number): number {
  return ft / 3.28084;
}

function msToMph(ms: number): number {
  return ms * 2.23694;
}

function formatRange(low: number, high: number, formatter: (seconds: number) => string): string {
  return `${formatter(Math.min(low, high))}–${formatter(Math.max(low, high))}`;
}

function resolveManualConditions(
  tempInput: string,
  tempUnit: TempUnit,
  rhInput: string,
  windSpeedInput: string,
  windSpeedUnit: WindSpeedUnit,
  relativeWindAngleDeg: number,
): ResolvedConditions | null {
  const tempRaw = Number(tempInput);
  const rhRaw = Number(rhInput);
  const windSpeedRaw = Number(windSpeedInput);
  if (!Number.isFinite(tempRaw)) return null;
  if (!Number.isFinite(rhRaw) || rhRaw < 0 || rhRaw > 100) return null;
  if (!Number.isFinite(windSpeedRaw) || windSpeedRaw < 0) return null;
  return {
    tempC: tempUnit === "f" ? fToC(tempRaw) : tempRaw,
    relativeHumidityPct: rhRaw,
    windSpeedMS: windSpeedRaw * WIND_SPEED_TO_MS[windSpeedUnit],
    windFromBearingDeg: relativeWindAngleDeg,
    runnerHeadingBearingDeg: 0,
  };
}

function resolveAutoConditions(fetched: WeatherConditions | null, headingDeg: number): ResolvedConditions | null {
  if (!fetched) return null;
  return {
    tempC: fetched.tempC,
    relativeHumidityPct: fetched.relativeHumidityPct,
    windSpeedMS: fetched.windSpeedMS,
    windFromBearingDeg: fetched.windFromBearingDeg,
    runnerHeadingBearingDeg: headingDeg,
  };
}

type ComputeResultsParams = {
  conditions: ResolvedConditions | null;
  courseType: CourseType;
  elevationGainM: number;
  elevationLossM: number;
  /** Track only -- a track's terrain is a fixed, known case, so it keeps the discrete profile picker. */
  windProfile: WindProfile;
  /** Road/route only -- see wind-exposure.ts's continuous 0-100 sheltering score. */
  windExposureScore: number;
  weightKg: number;
  repType: RepType;
  speedOrEffort: SpeedOrEffort;
  routeSummary: RouteSummary | null;
  context: PerformanceContext;
};

// Road, track, and route share the same Heat/Humidity engines (all apply
// regardless of course type) but need different Wind models -- a runner's
// heading is constant on the road, rotates continuously through a track's
// curves (track-wind-engine.ts), or follows a real GPS-derived path
// (route-wind-engine.ts). Elevation uses either a manually-entered
// gain/loss total (road) or the real total measured from an imported
// route's own elevation samples (route) -- a standard track is flat by
// construction, so there's nothing for ElevationEngine to do there.
function computeResults(params: ComputeResultsParams): EngineResult[] {
  const { conditions, courseType, elevationGainM, elevationLossM, windProfile, windExposureScore, weightKg, repType, speedOrEffort, routeSummary, context } = params;
  const results: EngineResult[] = [];

  if (conditions) {
    const heatInput: HeatEngineInput = { tempC: conditions.tempC };
    if (heatEngine.isApplicable(heatInput)) results.push(heatEngine.compute(heatInput, context));

    const humidityInput: HumidityEngineInput = {
      tempC: conditions.tempC,
      relativeHumidityPct: conditions.relativeHumidityPct,
    };
    if (humidityEngine.isApplicable(humidityInput)) results.push(humidityEngine.compute(humidityInput, context));

    if (courseType === "track") {
      const trackWindInput: TrackWindEngineInput = {
        windSpeedMS: conditions.windSpeedMS,
        windFromBearingDeg: conditions.windFromBearingDeg,
        runnerHeadingBearingDeg: conditions.runnerHeadingBearingDeg,
        windProfile,
        weightKg,
        repType,
        speedOrEffort,
      };
      if (trackWindEngine.isApplicable(trackWindInput)) results.push(trackWindEngine.compute(trackWindInput, context));
    } else if (courseType === "route") {
      const routeWindInput: RouteWindEngineInput = {
        windSpeedMS: conditions.windSpeedMS,
        // Already a true bearing in both manual (a true-bearing compass)
        // and auto (straight from the weather API) modes for route
        // source -- no runner heading needed, since the route's own
        // segments already carry their real headings.
        windFromBearingDeg: conditions.windFromBearingDeg,
        windExposureScore,
        weightKg,
        speedOrEffort,
        headingSegments: routeSummary?.headingSegments ?? [],
      };
      if (routeWindEngine.isApplicable(routeWindInput)) results.push(routeWindEngine.compute(routeWindInput, context));
    } else {
      const windInput: WindEngineInput = {
        windSpeedMS: conditions.windSpeedMS,
        windFromBearingDeg: conditions.windFromBearingDeg,
        runnerHeadingBearingDeg: conditions.runnerHeadingBearingDeg,
        windExposureScore,
        weightKg,
      };
      if (windEngine.isApplicable(windInput)) results.push(windEngine.compute(windInput, context));
    }
  }

  if (courseType === "road") {
    const elevationInput: ElevationEngineInput = { elevationGainM, elevationLossM };
    if (elevationEngine.isApplicable(elevationInput)) results.push(elevationEngine.compute(elevationInput, context));
  } else if (courseType === "route" && routeSummary) {
    const elevationInput: ElevationEngineInput = {
      elevationGainM: routeSummary.elevationGainM,
      elevationLossM: routeSummary.elevationLossM,
    };
    if (elevationEngine.isApplicable(elevationInput)) results.push(elevationEngine.compute(elevationInput, context));
  }

  return results;
}

function ManualWeatherFields({
  idPrefix,
  windAngleMode = "relative",
  windRelativeToLabel,
  tempInput,
  setTempInput,
  tempUnit,
  setTempUnit,
  rhInput,
  setRhInput,
  windSpeedInput,
  setWindSpeedInput,
  windSpeedUnit,
  setWindSpeedUnit,
  relativeWindAngleDeg,
  setRelativeWindAngleDeg,
}: {
  idPrefix: string;
  /**
   * "relative" (default): the dial is relative to `windRelativeToLabel`
   * (a runner's heading, or the track's home straight). "true-bearing":
   * the dial is an absolute compass direction -- used for an imported
   * route, which already has its own per-segment headings baked in, so
   * there's no single "relative to" direction to speak of.
   */
  windAngleMode?: "relative" | "true-bearing";
  /** e.g. "the direction you're running" (road) or "the track's home straight" (track). Unused in "true-bearing" mode. */
  windRelativeToLabel?: string;
  tempInput: string;
  setTempInput: (value: string) => void;
  tempUnit: TempUnit;
  setTempUnit: (value: TempUnit) => void;
  rhInput: string;
  setRhInput: (value: string) => void;
  windSpeedInput: string;
  setWindSpeedInput: (value: string) => void;
  windSpeedUnit: WindSpeedUnit;
  setWindSpeedUnit: (value: WindSpeedUnit) => void;
  relativeWindAngleDeg: number;
  setRelativeWindAngleDeg: (value: number) => void;
}) {
  function handleTempUnitChange(next: TempUnit) {
    if (next === tempUnit) return;
    const parsed = Number(tempInput);
    if (Number.isFinite(parsed)) {
      setTempInput(String(Math.round(next === "f" ? cToF(parsed) : fToC(parsed))));
    }
    setTempUnit(next);
  }

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
      <WindCompass
        angleDeg={relativeWindAngleDeg}
        onChange={setRelativeWindAngleDeg}
        variant={windAngleMode === "true-bearing" ? "heading" : "wind"}
      />

      <div className="flex-1 space-y-4">
        <p className="text-xs text-zinc-600 dark:text-zinc-300">
          {windAngleMode === "true-bearing" ? (
            <>
              Set this to the compass direction the wind is blowing <em>from</em> -- your route&rsquo;s own heading
              changes are already accounted for from the file, so there&rsquo;s nothing else to set here.
            </>
          ) : (
            <>
              Drag the dot to where the wind is coming <em>from</em>, relative to {windRelativeToLabel} -- straight
              up (HEAD) means a headwind there, straight down (TAIL) means a tailwind.
            </>
          )}
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${idPrefix}-temp`} className={labelClass}>
              Temperature
            </label>
            <div className="flex gap-2">
              <input
                id={`${idPrefix}-temp`}
                type="number"
                inputMode="decimal"
                value={tempInput}
                onChange={(event) => setTempInput(event.target.value)}
                className={`w-20 ${fieldClass}`}
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => handleTempUnitChange("f")}
                  aria-pressed={tempUnit === "f"}
                  className={segmentedButtonClass(tempUnit === "f")}
                >
                  °F
                </button>
                <button
                  type="button"
                  onClick={() => handleTempUnitChange("c")}
                  aria-pressed={tempUnit === "c"}
                  className={segmentedButtonClass(tempUnit === "c")}
                >
                  °C
                </button>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor={`${idPrefix}-rh`} className={labelClass}>
              Humidity
            </label>
            <div className="flex items-center gap-2">
              <input
                id={`${idPrefix}-rh`}
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                value={rhInput}
                onChange={(event) => setRhInput(event.target.value)}
                className={`w-20 ${fieldClass}`}
              />
              <span className="text-sm text-zinc-600 dark:text-zinc-300">% relative humidity</span>
            </div>
            <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
              How saturated the air is with moisture -- 100% means it can&rsquo;t hold any more, which slows sweat
              evaporation and your body&rsquo;s ability to cool itself.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor={`${idPrefix}-wind-speed`} className={labelClass}>
            Wind speed
          </label>
          <div className="flex gap-2">
            <input
              id={`${idPrefix}-wind-speed`}
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              value={windSpeedInput}
              onChange={(event) => setWindSpeedInput(event.target.value)}
              className={`w-24 ${fieldClass}`}
            />
            <select
              aria-label="Wind speed unit"
              value={windSpeedUnit}
              onChange={(event) => setWindSpeedUnit(event.target.value as WindSpeedUnit)}
              className={fieldClass}
            >
              {(Object.keys(WIND_SPEED_LABEL) as WindSpeedUnit[]).map((unit) => (
                <option key={unit} value={unit}>
                  {WIND_SPEED_LABEL[unit]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EnvironmentalCalculator() {
  const baseId = useId();
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const [courseType, setCourseType] = usePersistedField<CourseType>(persisted?.courseType, "road");
  const [distancePreset, setDistancePreset] = usePersistedField<DistancePreset>(persisted?.distancePreset, "5k");
  const [customDistanceInput, setCustomDistanceInput] = usePersistedField(persisted?.customDistanceInput, "5000");
  const [repType, setRepType] = usePersistedField<RepType>(persisted?.repType, "400m");
  const [speedOrEffort, setSpeedOrEffort] = usePersistedField<SpeedOrEffort>(persisted?.speedOrEffort, "constant-effort");
  // A parsed route's full point-by-point data isn't persisted (could be
  // thousands of points) -- re-importing a file or picking a Strava
  // activity again is quick, so this deliberately resets on reload.
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [timeInput, setTimeInput] = usePersistedField(persisted?.timeInput, "20:00");
  const [goalMode, setGoalMode] = usePersistedField<GoalMode>(persisted?.goalMode, "analyze");

  const [weightInput, setWeightInput] = usePersistedField(persisted?.weightInput, String(WEIGHT_DEFAULT_LBS));
  const [weightUnit, setWeightUnit] = usePersistedField<WeightUnit>(persisted?.weightUnit, "lbs");
  const [headingDeg, setHeadingDeg] = usePersistedField(persisted?.headingDeg, 0);
  const [windProfile, setWindProfile] = usePersistedField<WindProfile>(persisted?.windProfile, "suburban");
  const [windExposureScore, setWindExposureScore] = usePersistedField(persisted?.windExposureScore, EXPOSURE_LABEL_SCORE.suburban);
  const [exposureDetected, setExposureDetected] = useState<{ score: number; label: ExposureLabel } | null>(null);
  const [exposureMessage, setExposureMessage] = useState<string | null>(null);
  // Tracked as its own boolean (not inferred from exposureMessage's text)
  // so the checklist and the inline status message are both driven by the
  // same underlying fact and can never disagree with each other.
  const [exposureDetectionFailed, setExposureDetectionFailed] = useState(false);

  const [elevationGainInput, setElevationGainInput] = usePersistedField(persisted?.elevationGainInput, "0");
  const [elevationLossInput, setElevationLossInput] = usePersistedField(persisted?.elevationLossInput, "0");
  const [elevationUnit, setElevationUnit] = usePersistedField<ElevationUnit>(persisted?.elevationUnit, "ft");

  const [sourceA, setSourceA] = usePersistedField<WeatherSource>(persisted?.sourceA, "manual");
  const [tempInputA, setTempInputA] = usePersistedField(persisted?.tempInputA, "59");
  const [tempUnitA, setTempUnitA] = usePersistedField<TempUnit>(persisted?.tempUnitA, "f");
  const [rhInputA, setRhInputA] = usePersistedField(persisted?.rhInputA, "50");
  const [windSpeedInputA, setWindSpeedInputA] = usePersistedField(persisted?.windSpeedInputA, "5");
  const [windSpeedUnitA, setWindSpeedUnitA] = usePersistedField<WindSpeedUnit>(persisted?.windSpeedUnitA, "mph");
  const [relativeWindAngleA, setRelativeWindAngleA] = usePersistedField(persisted?.relativeWindAngleA, 0);

  // Conditions B is a "what if" comparison scenario for Convert mode only --
  // deliberately not persisted (nor location/auto-fetch-capable) to keep it
  // a lightweight scratch comparison rather than a second full weather flow.
  const [tempInputB, setTempInputB] = usePersistedField<string>(undefined, "50");
  const [tempUnitB, setTempUnitB] = usePersistedField<TempUnit>(undefined, "f");
  const [rhInputB, setRhInputB] = usePersistedField<string>(undefined, "40");
  const [windSpeedInputB, setWindSpeedInputB] = usePersistedField<string>(undefined, "0");
  const [windSpeedUnitB, setWindSpeedUnitB] = usePersistedField<WindSpeedUnit>(undefined, "mph");
  const [relativeWindAngleB, setRelativeWindAngleB] = usePersistedField<number>(undefined, 0);

  const [workoutType, setWorkoutType] = usePersistedField<WorkoutType>(persisted?.workoutType, "tempo");
  // Set only when an imported activity's title/distance/elevation produced
  // an automatic guess -- drives the "We detected this as..." + Change
  // framing so the user only has to intervene when the guess is wrong,
  // rather than always being asked to classify the run themselves.
  const [workoutTypeGuess, setWorkoutTypeGuess] = useState<WorkoutTypeGuess | null>(null);
  const [showWorkoutTypeOverride, setShowWorkoutTypeOverride] = useState(false);
  const [workoutPaceInput, setWorkoutPaceInput] = usePersistedField(persisted?.workoutPaceInput, "7:00");
  const [paceDisplayUnit, setPaceDisplayUnit] = usePersistedField<PaceDisplayUnit>(persisted?.paceDisplayUnit, "mi");
  const [workoutInputMode, setWorkoutInputMode] = usePersistedField<WorkoutInputMode>(persisted?.workoutInputMode, "distance");
  const [workoutDistanceInput, setWorkoutDistanceInput] = usePersistedField(persisted?.workoutDistanceInput, "4");
  const [workoutDurationInput, setWorkoutDurationInput] = usePersistedField(persisted?.workoutDurationInput, "28:00");

  const [showAdvanced, setShowAdvanced] = usePersistedField(persisted?.showAdvanced, false);
  const [showEducation, setShowEducation] = usePersistedField(persisted?.showEducation, false);

  const envWeatherA = useEnvironmentalWeather();

  useEffect(() => {
    try {
      const state: PersistedState = {
        courseType,
        distancePreset,
        customDistanceInput,
        repType,
        speedOrEffort,
        timeInput,
        goalMode,
        weightInput,
        weightUnit,
        headingDeg,
        windProfile,
        windExposureScore,
        elevationGainInput,
        elevationLossInput,
        elevationUnit,
        sourceA,
        tempInputA,
        tempUnitA,
        rhInputA,
        windSpeedInputA,
        windSpeedUnitA,
        relativeWindAngleA,
        workoutType,
        workoutPaceInput,
        paceDisplayUnit,
        workoutInputMode,
        workoutDistanceInput,
        workoutDurationInput,
        showAdvanced,
        showEducation,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage.
    }
  }, [
    courseType,
    distancePreset,
    customDistanceInput,
    repType,
    speedOrEffort,
    timeInput,
    goalMode,
    weightInput,
    weightUnit,
    headingDeg,
    windProfile,
    windExposureScore,
    elevationGainInput,
    elevationLossInput,
    elevationUnit,
    sourceA,
    tempInputA,
    tempUnitA,
    rhInputA,
    windSpeedInputA,
    windSpeedUnitA,
    relativeWindAngleA,
    workoutType,
    workoutPaceInput,
    paceDisplayUnit,
    workoutInputMode,
    workoutDistanceInput,
    workoutDurationInput,
    showAdvanced,
    showEducation,
  ]);

  // Automatically estimate wind exposure from map data whenever a real
  // location becomes available -- a route's own GPS centroid takes
  // priority (it's the actual course), falling back to road mode's
  // geocoded weather location. Silently does nothing on failure (no
  // coordinates yet, network error, ambiguous data): the manual picker
  // below is always there as a fallback, and detection simply retries
  // the next time the location changes.
  useEffect(() => {
    if (courseType === "track") return;
    const lat = courseType === "route" ? routeSummary?.centroidLat : envWeatherA.resolvedLat;
    const lon = courseType === "route" ? routeSummary?.centroidLon : envWeatherA.resolvedLon;
    if (lat == null || lon == null) return;

    let cancelled = false;
    fetchExposureScore(lat, lon).then((score) => {
      if (cancelled) return;
      if (score === null) {
        setExposureDetected(null);
        setExposureDetectionFailed(true);
        setExposureMessage("Terrain couldn't be estimated automatically. Using manual selection instead.");
        return;
      }
      const label = exposureLabelFor(score);
      setExposureDetected({ score, label });
      setExposureDetectionFailed(false);
      setWindExposureScore(score);
      setExposureMessage(`Terrain estimated automatically: ${EXPOSURE_LABEL_TEXT[label]} (from map data)`);
    });
    return () => {
      cancelled = true;
    };
  }, [courseType, routeSummary?.centroidLat, routeSummary?.centroidLon, envWeatherA.resolvedLat, envWeatherA.resolvedLon, setWindExposureScore]);

  function handleCourseTypeChange(next: CourseType) {
    if (next === courseType) return;
    setCourseType(next);
    // A road-style "20:00" default reads as a bare-seconds track rep time
    // (parseTrackTime would treat the ":" as mm:ss.d, giving a nonsensical
    // 20-minute lap) and vice versa, so reset to a sensible default for
    // whichever mode is now active rather than leaving a confusing value.
    setTimeInput(next === "track" ? "60.0" : "20:00");
  }

  function handleWeightUnitChange(next: WeightUnit) {
    if (next === weightUnit) return;
    const parsed = Number(weightInput);
    if (Number.isFinite(parsed) && parsed > 0) {
      const converted = next === "kg" ? parsed / 2.20462 : parsed * 2.20462;
      setWeightInput(String(Math.round(converted)));
    } else {
      setWeightInput(next === "kg" ? String(WEIGHT_DEFAULT_KG) : String(WEIGHT_DEFAULT_LBS));
    }
    setWeightUnit(next);
  }

  function handleElevationUnitChange(next: ElevationUnit) {
    if (next === elevationUnit) return;
    const convert = (raw: string) => {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return raw;
      return String(Math.round(next === "ft" ? mToFt(parsed) : ftToM(parsed)));
    };
    setElevationGainInput(convert(elevationGainInput));
    setElevationLossInput(convert(elevationLossInput));
    setElevationUnit(next);
  }

  const rep = REP_SEGMENTS[repType];

  // "Adjust workout paces" + road is the one combination with no existing
  // distance/time input to reuse (track already has repType+time, route
  // already has its imported file) -- a planned pace plus a distance OR
  // duration fully determines the same {distanceMeters, timeSeconds} pair
  // every other mode already works with, via resolveWorkoutBout.
  // An imported route is always a completed activity, not a hypothetical
  // future one -- "Predict a Race" (what will conditions likely do to a
  // future effort) and "Adjust workout paces" (what pace to target for a
  // future workout) both presuppose the run hasn't happened yet, which
  // contradicts having just loaded its actual GPS/time data. Restricting
  // the available modes here prevents that contradictory combination
  // instead of just letting the user pick it and get a confusing result.
  const hasLoadedActivity = courseType === "route" && routeSummary !== null;
  const availableGoalModes: GoalMode[] = hasLoadedActivity
    ? (["analyze", "convert"] as GoalMode[])
    : (Object.keys(GOAL_MODE_COPY) as GoalMode[]);

  useEffect(() => {
    if (hasLoadedActivity && (goalMode === "predict" || goalMode === "adjust")) {
      setGoalMode("analyze");
    }
  }, [hasLoadedActivity, goalMode, setGoalMode]);

  // "What best describes this run?" replaces the raw constant-effort/
  // constant-speed physics toggle as the primary control -- each workout
  // type carries a sensible default assumption (see workout-types.ts), so
  // most users never need to think about the toggle at all. It's still
  // available as a manual override in Advanced Settings, which simply
  // resets to the descriptor's default whenever the descriptor changes.
  useEffect(() => {
    setSpeedOrEffort(WORKOUT_TYPE_CONFIG[workoutType].defaultSpeedOrEffort);
  }, [workoutType, setSpeedOrEffort]);

  const isWorkoutRoadInput = goalMode === "adjust" && courseType === "road";
  const workoutPaceSeconds = parseTimeToSeconds(workoutPaceInput);
  const workoutUnitMeters = PACE_DISPLAY_UNIT_METERS[paceDisplayUnit];
  const workoutDistanceRaw = Number(workoutDistanceInput);
  const workoutDurationSeconds = parseTimeToSeconds(workoutDurationInput);
  const workoutBout = isWorkoutRoadInput
    ? resolveWorkoutBout(
        workoutPaceSeconds,
        workoutUnitMeters,
        workoutInputMode,
        Number.isFinite(workoutDistanceRaw) ? workoutDistanceRaw : null,
        workoutDurationSeconds,
      )
    : null;

  const distanceMeters = isWorkoutRoadInput
    ? (workoutBout?.distanceMeters ?? 0)
    : courseType === "track"
      ? rep.distanceM
      : courseType === "route"
        ? (routeSummary?.totalDistanceM ?? 0)
        : distancePreset === "custom"
          ? Number(customDistanceInput)
          : DISTANCE_METERS[distancePreset];
  const distanceValid = Number.isFinite(distanceMeters) && distanceMeters > 0;
  const timeSeconds = isWorkoutRoadInput
    ? (workoutBout?.timeSeconds ?? null)
    : courseType === "track"
      ? parseTrackTime(timeInput)
      : parseTimeToSeconds(timeInput);
  const formatTime = courseType === "track" ? formatTrackTime : formatClock;

  function handleRouteLoaded(summary: RouteSummary, label: string) {
    setRouteSummary(summary);
    setTimeInput(formatClock(summary.totalTimeSeconds));
    // Treat the imported activity as the source of truth for weather too --
    // no separate location/date lookup required (see the calculator's
    // feedback-driven "import should feel authoritative" design goal).
    if (summary.centroidLat !== null && summary.centroidLon !== null) {
      setSourceA("auto");
      envWeatherA.applyRouteLocation(summary.centroidLat, summary.centroidLon, summary.startTimeIso, summary.source);
    }
    // Same idea for workout type: guess it from the activity itself rather
    // than asking, and only surface the manual picker if the user says the
    // guess is wrong.
    const guess = inferWorkoutType({
      title: summary.source === "strava" ? label : null,
      distanceMeters: summary.totalDistanceM,
      elevationGainM: summary.elevationGainM,
    });
    setWorkoutType(guess.type);
    setWorkoutTypeGuess(guess);
    setShowWorkoutTypeOverride(false);
  }

  const context: PerformanceContext | null =
    distanceValid && timeSeconds && timeSeconds > 0
      ? { distanceMeters, actualTimeSeconds: timeSeconds, paceMS: distanceMeters / timeSeconds }
      : null;

  const weightRaw = Number(weightInput);
  const weightValid = Number.isFinite(weightRaw) && weightRaw > 0;
  const weightKg = weightValid ? (weightUnit === "kg" ? weightRaw : weightRaw / 2.20462) : WEIGHT_DEFAULT_KG;

  const elevationGainRaw = Number(elevationGainInput);
  const elevationLossRaw = Number(elevationLossInput);
  const elevationGainM =
    Number.isFinite(elevationGainRaw) && elevationGainRaw > 0
      ? elevationUnit === "ft"
        ? ftToM(elevationGainRaw)
        : elevationGainRaw
      : 0;
  const elevationLossM =
    Number.isFinite(elevationLossRaw) && elevationLossRaw > 0
      ? elevationUnit === "ft"
        ? ftToM(elevationLossRaw)
        : elevationLossRaw
      : 0;

  const conditionsA =
    sourceA === "auto"
      ? resolveAutoConditions(envWeatherA.fetchedConditions, headingDeg)
      : resolveManualConditions(tempInputA, tempUnitA, rhInputA, windSpeedInputA, windSpeedUnitA, relativeWindAngleA);

  // What computeResults actually used for elevation -- a route's own
  // measured samples take priority over the manual gain/loss fields, the
  // same precedence computeResults itself applies.
  const effectiveElevationGainM = courseType === "route" && routeSummary ? routeSummary.elevationGainM : elevationGainM;
  const effectiveElevationLossM = courseType === "route" && routeSummary ? routeSummary.elevationLossM : elevationLossM;

  const conditionsB =
    goalMode === "convert"
      ? resolveManualConditions(tempInputB, tempUnitB, rhInputB, windSpeedInputB, windSpeedUnitB, relativeWindAngleB)
      : null;

  const resultsA = context
    ? computeResults({ conditions: conditionsA, courseType, elevationGainM, elevationLossM, windProfile, windExposureScore, weightKg, repType, speedOrEffort, routeSummary, context })
    : [];
  const combinedA = combineAdjustments(resultsA);

  const resultsB =
    context && goalMode === "convert"
      ? computeResults({ conditions: conditionsB, courseType, elevationGainM, elevationLossM, windProfile, windExposureScore, weightKg, repType, speedOrEffort, routeSummary, context })
      : [];
  const combinedB = combineAdjustments(resultsB);

  const canSolve = context !== null && conditionsA !== null && (goalMode !== "convert" || conditionsB !== null);

  function deriveOutcome(ctx: PerformanceContext, a: CombinedAdjustment, b: CombinedAdjustment): TimeEstimate {
    if (goalMode === "analyze") return equivalentIdealTime(ctx.actualTimeSeconds, a);
    // "Adjust workout paces" reuses the exact same math as Predict: the
    // planned pace/time is the ideal baseline, and today's conditions add
    // (or occasionally subtract) time on top of it -- only the framing of
    // the result (a pace, with coaching guidance) differs, not the math.
    if (goalMode === "predict" || goalMode === "adjust") return predictedActualTime(ctx.actualTimeSeconds, a);
    return convertBetweenConditions(ctx.actualTimeSeconds, a, b);
  }

  const outcome: TimeEstimate | null = context && canSolve ? deriveOutcome(context, combinedA, combinedB) : null;

  // A 200/600/1000m rep is a non-integer number of laps, so it necessarily
  // starts partway around the track -- which half gets skipped is a real,
  // exploitable choice on a windy day. Computed only for track mode (road
  // reps and the standard 400m lap have no "alt" starting line).
  const altRepType = courseType === "track" ? ALT_PAIR[repType] : undefined;

  const altResultsA =
    context && altRepType
      ? computeResults({ conditions: conditionsA, courseType, elevationGainM, elevationLossM, windProfile, windExposureScore, weightKg, repType: altRepType, speedOrEffort, routeSummary, context })
      : [];
  const altCombinedA = combineAdjustments(altResultsA);

  const altResultsB =
    context && altRepType && goalMode === "convert"
      ? computeResults({ conditions: conditionsB, courseType, elevationGainM, elevationLossM, windProfile, windExposureScore, weightKg, repType: altRepType, speedOrEffort, routeSummary, context })
      : [];
  const altCombinedB = combineAdjustments(altResultsB);

  const altOutcome: TimeEstimate | null =
    context && canSolve && altRepType ? deriveOutcome(context, altCombinedA, altCombinedB) : null;

  // Lower is always better here in every goal mode: a faster equivalent
  // performance (Analyze), a faster predicted time (Predict), or a faster
  // conditions-B equivalent (Convert).
  const altIsBetter = outcome !== null && altOutcome !== null && altOutcome.estimateSeconds < outcome.estimateSeconds - 0.05;

  const copy = GOAL_MODE_COPY[goalMode];
  const windRelativeToLabel = courseType === "track" ? "the track's home straight" : "the direction you're running";

  // "Adjust workout paces" reframes the same outcome/resultsA the other
  // three modes already compute as a pace (or, on the track, a rep time)
  // instead of a finish time -- track reps are naturally "per rep," road
  // and route naturally "per mile/km," so there's no single universal unit.
  const workoutConfig = WORKOUT_TYPE_CONFIG[workoutType];
  const workoutPerUnitMeters = courseType === "road" ? PACE_DISPLAY_UNIT_METERS[paceDisplayUnit] : 1609.344;
  const workoutPerUnitLabel = courseType === "track" ? "rep" : courseType === "road" && paceDisplayUnit === "km" ? "km" : "mile";
  const workoutUnits = distanceMeters > 0 ? distanceMeters / workoutPerUnitMeters : 0;
  const workoutPlannedPaceSeconds =
    courseType !== "track" && context && workoutUnits > 0 ? context.actualTimeSeconds / workoutUnits : null;
  const workoutRecommendedLowSeconds =
    courseType === "track" ? outcome?.lowSeconds ?? null : outcome && workoutUnits > 0 ? outcome.lowSeconds / workoutUnits : null;
  const workoutRecommendedHighSeconds =
    courseType === "track" ? outcome?.highSeconds ?? null : outcome && workoutUnits > 0 ? outcome.highSeconds / workoutUnits : null;
  const workoutResultsForDisplay =
    courseType === "track" ? resultsA : scaleResultsPerUnit(resultsA, distanceMeters, workoutPerUnitMeters);
  const workoutTotalAdjustmentForDisplay =
    courseType === "track"
      ? combinedA.totalAdjustmentSeconds
      : perUnitAdjustmentSeconds(combinedA.totalAdjustmentSeconds, distanceMeters, workoutPerUnitMeters);

  // Pace display for Analyze/Predict/Compare (Adjust already shows its own
  // pace framing above): most runners think in pace, not total time, so
  // road/route results show both. Track already shows a rep time, which is
  // the natural "pace" framing for a single lap -- no conversion needed.
  const confidenceReasons = buildConfidenceReasons({
    courseType,
    hasGpsRoute: routeSummary !== null,
    weatherSource: sourceA,
    terrainSource: exposureDetected !== null ? "auto-detected" : "manual",
  });
  const confidenceLevel = overallConfidenceLevel(confidenceReasons);

  const showsPaceDisplay = courseType !== "track";
  const paceUnitMeters = PACE_DISPLAY_UNIT_METERS[paceDisplayUnit];
  const paceUnitLabel = paceDisplayUnit === "mi" ? "mi" : "km";
  const distanceInPaceUnits = distanceMeters > 0 ? distanceMeters / paceUnitMeters : 0;
  const actualPaceSeconds = context && distanceInPaceUnits > 0 ? context.actualTimeSeconds / distanceInPaceUnits : null;
  const equivalentPaceLowSeconds = outcome && distanceInPaceUnits > 0 ? outcome.lowSeconds / distanceInPaceUnits : null;
  const equivalentPaceHighSeconds = outcome && distanceInPaceUnits > 0 ? outcome.highSeconds / distanceInPaceUnits : null;
  const breakdownResultsA = showsPaceDisplay ? scaleResultsPerUnit(resultsA, distanceMeters, paceUnitMeters) : resultsA;
  const breakdownTotalA = showsPaceDisplay
    ? perUnitAdjustmentSeconds(combinedA.totalAdjustmentSeconds, distanceMeters, paceUnitMeters)
    : combinedA.totalAdjustmentSeconds;
  const breakdownResultsB = showsPaceDisplay ? scaleResultsPerUnit(resultsB, distanceMeters, paceUnitMeters) : resultsB;
  const breakdownTotalB = showsPaceDisplay
    ? perUnitAdjustmentSeconds(combinedB.totalAdjustmentSeconds, distanceMeters, paceUnitMeters)
    : combinedB.totalAdjustmentSeconds;

  // The same underlying breakdown, whichever mode produced it -- used to
  // generate the top-of-results coaching summary and each mode's own
  // closing Coach's Notes without re-deriving anything new.
  const resultsForInterpretation = goalMode === "adjust" ? workoutResultsForDisplay : breakdownResultsA;
  const coachingSummaryText = buildCoachingSummary(resultsForInterpretation);
  const coachNotesText = buildCoachNotes(resultsForInterpretation);

  return (
    <div className="mt-10 space-y-10">
      <p className={pageSectionHeadingClass}>Activity</p>
      <div>
        <p className={sectionLabelClass}>Performance</p>
        <div className={`${statCardClass} space-y-4`}>
          <div>
            <p className={labelClass}>Where are you running this?</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleCourseTypeChange("road")}
                aria-pressed={courseType === "road"}
                className={segmentedButtonClass(courseType === "road")}
              >
                Road / open course
              </button>
              <button
                type="button"
                onClick={() => handleCourseTypeChange("track")}
                aria-pressed={courseType === "track"}
                className={segmentedButtonClass(courseType === "track")}
              >
                🏟️ Track (400m oval)
              </button>
              <button
                type="button"
                onClick={() => handleCourseTypeChange("route")}
                aria-pressed={courseType === "route"}
                className={segmentedButtonClass(courseType === "route")}
              >
                🗺️ Import a route
              </button>
            </div>
            <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
              {courseType === "track"
                ? "Your heading rotates continuously through the curves, so wind is integrated segment-by-segment around the track rather than treated as one constant angle."
                : courseType === "route"
                  ? "Upload a .gpx, .tcx, or .fit file, or pick a Strava activity -- distance, elevation, and every heading change along the way come from the file itself."
                  : "One steady heading for the whole effort -- the right choice for races, tempo runs, and long intervals."}
            </p>
          </div>

          {courseType === "route" && (
            <div>
              <RouteImportPanel onRouteLoaded={handleRouteLoaded} />
              {routeSummary && (
                <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300 sm:grid-cols-2">
                  {(
                    [
                      { label: "Distance imported", done: routeSummary.totalDistanceM > 0 },
                      { label: "Duration imported", done: routeSummary.totalTimeSeconds > 0 },
                      {
                        label: "Elevation imported",
                        done: routeSummary.elevationGainM > 0 || routeSummary.elevationLossM > 0,
                      },
                      { label: "Route headings imported", done: routeSummary.headingSegments.length > 0 },
                      { label: "Weather retrieved", done: envWeatherA.fetchedConditions !== null },
                      {
                        label: "Wind integrated across course",
                        done: envWeatherA.fetchedConditions !== null && routeSummary.headingSegments.length > 0,
                      },
                    ] as const
                  ).map((item) => (
                    <li key={item.label} className="flex items-center gap-1.5">
                      <span aria-hidden="true">{item.done ? "✓" : "○"}</span>
                      {item.label}
                    </li>
                  ))}
                  <li className="flex items-center gap-1.5">
                    <span aria-hidden="true">{exposureDetected ? "✓" : exposureDetectionFailed ? "⚠" : "○"}</span>
                    {exposureDetected
                      ? "Terrain estimated automatically"
                      : exposureDetectionFailed
                        ? "Terrain couldn't be estimated automatically"
                        : "Terrain estimated"}
                  </li>
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-6">
            {isWorkoutRoadInput && (
              <>
                <div className="min-w-[160px]">
                  <label htmlFor={`${baseId}-workout-pace`} className={labelClass}>
                    Target pace
                  </label>
                  <div className="flex gap-2">
                    <input
                      id={`${baseId}-workout-pace`}
                      type="text"
                      value={workoutPaceInput}
                      onChange={(event) => setWorkoutPaceInput(event.target.value)}
                      placeholder="mm:ss"
                      autoComplete="off"
                      className={`w-24 ${fieldClass}`}
                    />
                    <select
                      aria-label="Pace unit"
                      value={paceDisplayUnit}
                      onChange={(event) => setPaceDisplayUnit(event.target.value as PaceDisplayUnit)}
                      className={fieldClass}
                    >
                      <option value="mi">/mi</option>
                      <option value="km">/km</option>
                    </select>
                  </div>
                  {workoutPaceSeconds === null && (
                    <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">Enter as mm:ss, e.g. 6:00.</p>
                  )}
                </div>

                <div className="min-w-[180px]">
                  <p className={labelClass}>Planned as a</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setWorkoutInputMode("distance")}
                      aria-pressed={workoutInputMode === "distance"}
                      className={segmentedButtonClass(workoutInputMode === "distance")}
                    >
                      Distance
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkoutInputMode("duration")}
                      aria-pressed={workoutInputMode === "duration"}
                      className={segmentedButtonClass(workoutInputMode === "duration")}
                    >
                      Duration
                    </button>
                  </div>
                </div>

                {workoutInputMode === "distance" ? (
                  <div className="min-w-0">
                    <label htmlFor={`${baseId}-workout-distance`} className={labelClass}>
                      Distance ({paceDisplayUnit === "mi" ? "miles" : "km"})
                    </label>
                    <input
                      id={`${baseId}-workout-distance`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.1}
                      value={workoutDistanceInput}
                      onChange={(event) => setWorkoutDistanceInput(event.target.value)}
                      className={`w-24 ${fieldClass}`}
                    />
                  </div>
                ) : (
                  <div className="min-w-0">
                    <label htmlFor={`${baseId}-workout-duration`} className={labelClass}>
                      Duration
                    </label>
                    <input
                      id={`${baseId}-workout-duration`}
                      type="text"
                      value={workoutDurationInput}
                      onChange={(event) => setWorkoutDurationInput(event.target.value)}
                      placeholder="mm:ss"
                      autoComplete="off"
                      className={`w-28 ${fieldClass}`}
                    />
                  </div>
                )}
                <p className="w-full text-xs text-zinc-600 dark:text-zinc-300">
                  {WORKOUT_TYPE_CONFIG[workoutType].structure === "interval"
                    ? "Enter one representative rep -- e.g. for 6x800m, a single 800m at its target pace."
                    : "Enter the whole planned segment for this workout."}
                </p>
              </>
            )}

            {!isWorkoutRoadInput && courseType === "road" && (
              <div className="min-w-0">
                <label htmlFor={`${baseId}-distance`} className={labelClass}>
                  Distance
                </label>
                <select
                  id={`${baseId}-distance`}
                  value={distancePreset}
                  onChange={(event) => setDistancePreset(event.target.value as DistancePreset)}
                  className={fieldClass}
                >
                  {DISTANCE_ORDER.map((preset) => (
                    <option key={preset} value={preset}>
                      {DISTANCE_LABEL[preset]}
                    </option>
                  ))}
                </select>
                {distancePreset === "custom" && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={1}
                      value={customDistanceInput}
                      onChange={(event) => setCustomDistanceInput(event.target.value)}
                      className={`w-28 ${fieldClass}`}
                    />
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">meters</span>
                  </div>
                )}
              </div>
            )}

            {courseType === "track" && (
              <div className="min-w-[200px]">
                <label htmlFor={`${baseId}-rep`} className={labelClass}>
                  Rep distance
                </label>
                <select
                  id={`${baseId}-rep`}
                  value={repType}
                  onChange={(event) => setRepType(event.target.value as RepType)}
                  className={fieldClass}
                >
                  {REP_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 max-w-[220px] text-xs text-zinc-600 dark:text-zinc-300">
                  {REP_DESCRIPTIONS[repType]}
                </p>
              </div>
            )}

            {courseType === "route" && (
              <div className="min-w-0">
                <p className={labelClass}>Distance</p>
                <p className="text-base font-semibold text-zinc-900 dark:text-white">
                  {routeSummary ? `${(distanceMeters / 1609.344).toFixed(2)} mi` : "Import a route below"}
                </p>
              </div>
            )}

            {!isWorkoutRoadInput && (
              <div className="min-w-0">
                <label htmlFor={`${baseId}-time`} className={labelClass}>
                  {copy.timeLabel}
                </label>
                <input
                  id={`${baseId}-time`}
                  type="text"
                  value={timeInput}
                  onChange={(event) => setTimeInput(event.target.value)}
                  placeholder={courseType === "track" ? "62.0 or 1:20.0" : "mm:ss"}
                  autoComplete="off"
                  className={`w-32 ${fieldClass}`}
                />
                {timeSeconds === null && (
                  <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                    {courseType === "track" ? "Enter as seconds (62.4) or mm:ss.d (1:02.4)." : "Enter as mm:ss or h:mm:ss."}
                  </p>
                )}
              </div>
            )}

            {(courseType === "track" || courseType === "route") && (
              <div className="min-w-[220px]">
                {workoutTypeGuess && !showWorkoutTypeOverride ? (
                  <>
                    <p className={labelClass}>What best describes this run?</p>
                    <p className="text-sm text-zinc-700 dark:text-zinc-200">
                      We detected this as {workoutTypeGuess.confidence === "low" ? "an" : "a"}{" "}
                      <strong>{WORKOUT_TYPE_CONFIG[workoutType].label}</strong>.{" "}
                      <button
                        type="button"
                        onClick={() => setShowWorkoutTypeOverride(true)}
                        className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
                      >
                        Change
                      </button>
                    </p>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{workoutTypeGuess.reason}</p>
                  </>
                ) : (
                  <>
                    <label htmlFor={`${baseId}-workout-type`} className={labelClass}>
                      What best describes this run?
                    </label>
                    <select
                      id={`${baseId}-workout-type`}
                      value={workoutType}
                      onChange={(event) => {
                        setWorkoutType(event.target.value as WorkoutType);
                        setWorkoutTypeGuess(null);
                      }}
                      className={`w-full max-w-xs ${fieldClass}`}
                    >
                      {WORKOUT_TYPE_ORDER.map((type) => (
                        <option key={type} value={type}>
                          {WORKOUT_TYPE_CONFIG[type].label}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <p className="mt-1.5 max-w-md text-xs text-zinc-600 dark:text-zinc-300">
                  Assumes you&rsquo;d hold{" "}
                  {WORKOUT_TYPE_CONFIG[workoutType].defaultSpeedOrEffort === "constant-effort"
                    ? "steady effort (splits drift with the wind)"
                    : "steady splits (effort rises and falls with the wind)"}{" "}
                  in the wind -- override in Advanced settings if you paced it differently.
                </p>
              </div>
            )}
          </div>

          <div>
            <p className={labelClass}>What do you want to do?</p>
            <div className="flex flex-wrap gap-2">
              {availableGoalModes.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setGoalMode(mode)}
                  aria-pressed={goalMode === mode}
                  className={segmentedButtonClass(goalMode === mode)}
                >
                  {GOAL_MODE_COPY[mode].button}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">{copy.helper}</p>
            {hasLoadedActivity && (
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                You loaded a completed activity, so it&rsquo;s treated as the source of truth -- Predict and Adjust
                (which assume a run hasn&rsquo;t happened yet) aren&rsquo;t offered here.
              </p>
            )}
          </div>

        </div>
      </div>

      <p className={pageSectionHeadingClass}>Conditions</p>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className={sectionLabelClass}>
            {goalMode === "predict" ? "Expected conditions" : "Conditions during the run"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSourceA("manual")}
              aria-pressed={sourceA === "manual"}
              className={segmentedButtonClass(sourceA === "manual")}
            >
              Enter manually
            </button>
            <button
              type="button"
              onClick={() => setSourceA("auto")}
              aria-pressed={sourceA === "auto"}
              className={segmentedButtonClass(sourceA === "auto")}
            >
              🌍 Use weather data
            </button>
          </div>
        </div>

        <div className={statCardClass}>
          {sourceA === "auto" ? (
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              {courseType !== "route" && <WindCompass angleDeg={headingDeg} onChange={setHeadingDeg} variant="heading" />}

              <div className="flex-1 space-y-4">
                {courseType !== "route" && (
                  <div>
                    <p className={labelClass}>
                      {courseType === "track" ? "Which way does the home straight face?" : "Which way will you be running?"}
                    </p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300">
                      {courseType === "track"
                        ? "Set this to the compass direction you run down the homestretch, and the wind's effect is worked out automatically as your heading rotates through the curves."
                        : "Set this to your actual heading (or the race course's general direction) so the wind's effect on you can be worked out automatically."}
                    </p>
                  </div>
                )}

                {courseType === "route" && routeSummary ? (
                  <p className="text-xs text-zinc-600 dark:text-zinc-300">
                    📍 Location and time came straight from the imported activity -- weather was fetched
                    automatically, with nothing else to look up.
                    {envWeatherA.weatherMessage && ` ${envWeatherA.weatherMessage}`}
                  </p>
                ) : (
                  <>
                    <div>
                      <p className={labelClass}>When</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => envWeatherA.setWhenMode("now")}
                          aria-pressed={envWeatherA.whenMode === "now"}
                          className={segmentedButtonClass(envWeatherA.whenMode === "now")}
                        >
                          Right now
                        </button>
                        <button
                          type="button"
                          onClick={() => envWeatherA.setWhenMode("specific")}
                          aria-pressed={envWeatherA.whenMode === "specific"}
                          className={segmentedButtonClass(envWeatherA.whenMode === "specific")}
                        >
                          A specific date &amp; time
                        </button>
                      </div>
                      {envWeatherA.whenMode === "specific" && (
                        <input
                          type="datetime-local"
                          value={envWeatherA.whenInput}
                          onChange={(event) => envWeatherA.setWhenInput(event.target.value)}
                          className={`mt-2 ${fieldClass}`}
                        />
                      )}
                      <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                        Past dates use historical weather records; future dates (up to ~16 days out) use the
                        forecast -- useful for checking a past race or planning around an upcoming one.
                      </p>
                    </div>

                    <LocationSearchField
                      search={envWeatherA.locationSearch}
                      placeholder="Enter the race city, e.g. Boston, MA"
                      message={envWeatherA.weatherMessage}
                    />
                  </>
                )}

                {envWeatherA.fetchedConditions && (
                  <div className={statCardClass}>
                    <p className={statLabelClass}>
                      {envWeatherA.weatherLocation ? `Conditions — ${envWeatherA.weatherLocation}` : "Conditions"}
                    </p>
                    <div className="mt-2 space-y-1.5 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-zinc-600 dark:text-zinc-300">🌡️ Temperature</span>
                        <span className="font-semibold text-zinc-900 dark:text-white">
                          {cToF(envWeatherA.fetchedConditions.tempC).toFixed(0)}°F ({envWeatherA.fetchedConditions.tempC.toFixed(0)}°C)
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-zinc-600 dark:text-zinc-300">💧 Humidity</span>
                        <span className="font-semibold text-zinc-900 dark:text-white">
                          {envWeatherA.fetchedConditions.relativeHumidityPct.toFixed(0)}%
                        </span>
                      </div>
                      {courseType !== "route" && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-zinc-600 dark:text-zinc-300">
                            🧭 {courseType === "track" ? "Home straight faces" : "You run toward"}
                          </span>
                          <span className="font-semibold text-zinc-900 dark:text-white">
                            {compassPointLabel(headingDeg)} ({Math.round(headingDeg)}°)
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-zinc-600 dark:text-zinc-300">💨 Wind blows from</span>
                        <span className="font-semibold text-zinc-900 dark:text-white">
                          {compassPointLabel(envWeatherA.fetchedConditions.windFromBearingDeg)} (
                          {Math.round(envWeatherA.fetchedConditions.windFromBearingDeg)}°)
                        </span>
                      </div>
                      {courseType !== "route" && (
                        <div className="pt-1">
                          <WindRelativeIndicator
                            relativeAngleDeg={relativeAngleFromTrueBearing(
                              envWeatherA.fetchedConditions.windFromBearingDeg,
                              headingDeg,
                            )}
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-zinc-600 dark:text-zinc-300">💨 Speed / gusts</span>
                        <span className="font-semibold text-zinc-900 dark:text-white">
                          {msToMph(envWeatherA.fetchedConditions.windSpeedMS).toFixed(0)} /{" "}
                          {msToMph(envWeatherA.fetchedConditions.windGustsMS).toFixed(0)} mph (
                          {envWeatherA.fetchedConditions.windSpeedMS.toFixed(1)} /{" "}
                          {envWeatherA.fetchedConditions.windGustsMS.toFixed(1)} m/s)
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-zinc-600 dark:text-zinc-300">☁️ Cloud cover</span>
                        <span className="font-semibold text-zinc-900 dark:text-white">
                          {envWeatherA.fetchedConditions.cloudCoverPct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <ManualWeatherFields
              idPrefix={`${baseId}-a`}
              windAngleMode={courseType === "route" ? "true-bearing" : "relative"}
              windRelativeToLabel={windRelativeToLabel}
              tempInput={tempInputA}
              setTempInput={setTempInputA}
              tempUnit={tempUnitA}
              setTempUnit={setTempUnitA}
              rhInput={rhInputA}
              setRhInput={setRhInputA}
              windSpeedInput={windSpeedInputA}
              setWindSpeedInput={setWindSpeedInputA}
              windSpeedUnit={windSpeedUnitA}
              setWindSpeedUnit={setWindSpeedUnitA}
              relativeWindAngleDeg={relativeWindAngleA}
              setRelativeWindAngleDeg={setRelativeWindAngleA}
            />
          )}
        </div>
      </div>

      {goalMode === "convert" && (
        <div>
          <p className={sectionLabelClass}>Conditions to compare against</p>
          <div className={statCardClass}>
            <p className="mb-4 text-xs text-zinc-600 dark:text-zinc-300">
              A hypothetical or alternate set of conditions to convert your performance into -- e.g. a cooler day, a
              different course&rsquo;s typical weather, or simply calm and mild (50°F, 40% humidity, no wind) as a
              baseline.
            </p>
            <ManualWeatherFields
              idPrefix={`${baseId}-b`}
              windAngleMode={courseType === "route" ? "true-bearing" : "relative"}
              windRelativeToLabel={windRelativeToLabel}
              tempInput={tempInputB}
              setTempInput={setTempInputB}
              tempUnit={tempUnitB}
              setTempUnit={setTempUnitB}
              rhInput={rhInputB}
              setRhInput={setRhInputB}
              windSpeedInput={windSpeedInputB}
              setWindSpeedInput={setWindSpeedInputB}
              windSpeedUnit={windSpeedUnitB}
              setWindSpeedUnit={setWindSpeedUnitB}
              relativeWindAngleDeg={relativeWindAngleB}
              setRelativeWindAngleDeg={setRelativeWindAngleB}
            />
          </div>
        </div>
      )}

      <div>
        <p className={sectionLabelClass}>
          {courseType === "track" ? "Track" : courseType === "route" ? "Course" : "Course (optional)"}
        </p>
        <div className={`${statCardClass} space-y-4`}>
          {courseType === "road" && (
            <>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label htmlFor={`${baseId}-gain`} className={labelClass}>
                    Elevation gain
                  </label>
                  <input
                    id={`${baseId}-gain`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={elevationGainInput}
                    onChange={(event) => setElevationGainInput(event.target.value)}
                    className={`w-24 ${fieldClass}`}
                  />
                </div>
                <div>
                  <label htmlFor={`${baseId}-loss`} className={labelClass}>
                    Elevation loss
                  </label>
                  <input
                    id={`${baseId}-loss`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={elevationLossInput}
                    onChange={(event) => setElevationLossInput(event.target.value)}
                    className={`w-24 ${fieldClass}`}
                  />
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleElevationUnitChange("m")}
                    aria-pressed={elevationUnit === "m"}
                    className={segmentedButtonClass(elevationUnit === "m")}
                  >
                    meters
                  </button>
                  <button
                    type="button"
                    onClick={() => handleElevationUnitChange("ft")}
                    aria-pressed={elevationUnit === "ft"}
                    className={segmentedButtonClass(elevationUnit === "ft")}
                  >
                    feet
                  </button>
                </div>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                Total climbing and descending over the whole course -- leave at 0/0 for a flat course, or check your
                watch/course map for the total. Climbing costs far more time than descending gives back.
              </p>
            </>
          )}

          {courseType === "route" && (
            <div>
              <p className={labelClass}>Elevation gain / loss</p>
              <p className="text-base font-semibold text-zinc-900 dark:text-white">
                {routeSummary
                  ? elevationUnit === "ft"
                    ? `${Math.round(mToFt(routeSummary.elevationGainM))}ft gain / ${Math.round(mToFt(routeSummary.elevationLossM))}ft loss`
                    : `${Math.round(routeSummary.elevationGainM)}m gain / ${Math.round(routeSummary.elevationLossM)}m loss`
                  : "Import a route above"}
              </p>
              <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                Measured directly from the file&rsquo;s own elevation samples -- no manual entry needed.
              </p>
            </div>
          )}

          {courseType === "track" ? (
            <div>
              <p className={labelClass}>Terrain (how exposed the course is to wind)</p>
              <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
                {WIND_PROFILE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    title={option.hint}
                    onClick={() => setWindProfile(option.value)}
                    aria-pressed={windProfile === option.value}
                    className={segmentedButtonClass(windProfile === option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                A standard World Athletics track (36.5m radius), lane 1 -- no elevation, since a real track is
                engineered flat.
              </p>
            </div>
          ) : (
            <div>
              <p className={labelClass}>Terrain (how exposed the course is to wind)</p>
              <div className="grid grid-cols-2 gap-2 sm:max-w-sm sm:grid-cols-3">
                {EXPOSURE_LABEL_ORDER.map((label) => (
                  <button
                    key={label}
                    type="button"
                    title={EXPOSURE_LABEL_HINT[label]}
                    onClick={() => {
                      setWindExposureScore(EXPOSURE_LABEL_SCORE[label]);
                      setExposureDetected(null);
                      setExposureDetectionFailed(false);
                      setExposureMessage(null);
                    }}
                    aria-pressed={exposureLabelFor(windExposureScore) === label}
                    className={segmentedButtonClass(exposureLabelFor(windExposureScore) === label)}
                  >
                    {EXPOSURE_LABEL_TEXT[label]}
                  </button>
                ))}
              </div>
              {exposureMessage && (
                <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                  {exposureDetected ? "📍 " : exposureDetectionFailed ? "⚠ " : ""}
                  {exposureMessage}
                  {exposureDetected && " -- pick a different option above to override."}
                </p>
              )}
              {!exposureMessage && (
                <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                  Automatically estimated from map data once a location or route is set -- wind isn&rsquo;t really a
                  category, so this feeds a continuous exposure score into the model rather than a fixed bucket.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((value) => !value)}
          aria-expanded={showAdvanced}
          className="flex items-center gap-2 py-1 text-sm font-semibold text-zinc-900 dark:text-white"
        >
          Advanced settings
          <span aria-hidden="true" className="text-xs font-normal">
            {showAdvanced ? "↑" : "↓"}
          </span>
        </button>
        {showAdvanced && (
          <div className={`mt-3 ${statCardClass} flex flex-wrap items-end gap-4`}>
            <div>
              <label htmlFor={`${baseId}-weight`} className={labelClass}>
                Runner weight
              </label>
              <div className="flex gap-2">
                <input
                  id={`${baseId}-weight`}
                  type="number"
                  inputMode="decimal"
                  min={1}
                  value={weightInput}
                  onChange={(event) => setWeightInput(event.target.value)}
                  className={`w-24 ${fieldClass}`}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleWeightUnitChange("lbs")}
                    aria-pressed={weightUnit === "lbs"}
                    className={segmentedButtonClass(weightUnit === "lbs")}
                  >
                    lbs
                  </button>
                  <button
                    type="button"
                    onClick={() => handleWeightUnitChange("kg")}
                    aria-pressed={weightUnit === "kg"}
                    className={segmentedButtonClass(weightUnit === "kg")}
                  >
                    kg
                  </button>
                </div>
              </div>
            </div>
            <p className="max-w-sm text-xs text-zinc-600 dark:text-zinc-300">
              Only affects the wind estimate, and only slightly -- heavier runners have more drag but less relative
              cost from it. The default of {WEIGHT_DEFAULT_LBS} lbs is a reasonable stand-in if you&rsquo;d rather
              skip this.
            </p>

            {(courseType === "track" || courseType === "route") && (
              <div className="w-full">
                <p className={labelClass}>
                  {goalMode === "predict" || goalMode === "adjust" ? "In the wind, plan to hold" : "In the wind, you held"}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSpeedOrEffort("constant-effort")}
                    aria-pressed={speedOrEffort === "constant-effort"}
                    className={segmentedButtonClass(speedOrEffort === "constant-effort")}
                    title="Most runners: effort stays even, splits drift with the wind"
                  >
                    Constant effort
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpeedOrEffort("constant-speed")}
                    aria-pressed={speedOrEffort === "constant-speed"}
                    className={segmentedButtonClass(speedOrEffort === "constant-speed")}
                    title="Following a pacing light, Stryd power target, or another runner's exact splits"
                  >
                    Constant speed
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                  Overrides the assumption picked automatically from &ldquo;What best describes this run?&rdquo;
                  above -- resets to that default if you change the workout descriptor.{" "}
                  {speedOrEffort === "constant-effort"
                    ? "Splits speed up and slow down with the wind; effort stays even."
                    : "Effort rises into the wind and drops with it, to hold identical splits every segment."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {outcome && (
        <div>
          <p className={pageSectionHeadingClass}>Results</p>
          <p className="mt-3 text-base font-semibold text-zinc-900 dark:text-white">{coachingSummaryText}</p>
        </div>
      )}

      {outcome && goalMode === "adjust" && (
        <div>
          <p className={sectionLabelClass}>Result</p>
          <div className={heroCardClass}>
            <p className={statLabelClass}>Recommended Workout Pace</p>
            {courseType === "track" ? (
              <>
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">Planned time for this rep</p>
                <p className="text-2xl font-semibold text-zinc-900 dark:text-white">{formatTime(context!.actualTimeSeconds)}</p>
                <p aria-hidden="true" className="my-1 text-xl text-zinc-400">
                  ↓
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-300">Recommended time today</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
                  {workoutRecommendedLowSeconds !== null && workoutRecommendedHighSeconds !== null
                    ? formatRange(workoutRecommendedLowSeconds, workoutRecommendedHighSeconds, formatTime)
                    : "--"}
                </p>
                {workoutRecommendedLowSeconds !== null && workoutRecommendedHighSeconds !== null && (
                  <div className="mt-2 max-w-sm">
                    <ConfidenceRangeBar
                      lowSeconds={workoutRecommendedLowSeconds}
                      estimateSeconds={(workoutRecommendedLowSeconds + workoutRecommendedHighSeconds) / 2}
                      highSeconds={workoutRecommendedHighSeconds}
                      referenceSeconds={context!.actualTimeSeconds}
                      referenceLabel="Planned"
                      formatValue={formatTime}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">Planned {workoutConfig.label} Pace</p>
                <p className="text-2xl font-semibold text-zinc-900 dark:text-white">
                  {workoutPlannedPaceSeconds !== null ? formatClock(workoutPlannedPaceSeconds) : "--"}/{workoutPerUnitLabel === "mile" ? "mi" : "km"}
                </p>
                <p aria-hidden="true" className="my-1 text-xl text-zinc-400">
                  ↓
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-300">Recommended Pace Today</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
                  {workoutRecommendedLowSeconds !== null && workoutRecommendedHighSeconds !== null
                    ? `${formatRange(workoutRecommendedLowSeconds, workoutRecommendedHighSeconds, formatClock)}/${workoutPerUnitLabel === "mile" ? "mi" : "km"}`
                    : "--"}
                </p>
                {workoutRecommendedLowSeconds !== null && workoutRecommendedHighSeconds !== null && workoutPlannedPaceSeconds !== null && (
                  <div className="mt-2 max-w-sm">
                    <ConfidenceRangeBar
                      lowSeconds={workoutRecommendedLowSeconds}
                      estimateSeconds={(workoutRecommendedLowSeconds + workoutRecommendedHighSeconds) / 2}
                      highSeconds={workoutRecommendedHighSeconds}
                      referenceSeconds={workoutPlannedPaceSeconds}
                      referenceLabel="Planned"
                      formatValue={formatClock}
                    />
                  </div>
                )}
              </>
            )}

            <details className={`mt-2 ${detailsClass}`}>
              <summary className={summaryClass}>Confidence is {confidenceLevel} -- why?</summary>
              <ul className={`${detailsBodyClass} space-y-1`}>
                {confidenceReasons.map((reason) => (
                  <li key={reason.label}>
                    {reason.strengthensConfidence ? "✓ " : "~ "}
                    {reason.label}
                  </li>
                ))}
              </ul>
            </details>

            <SaveCalculationButton
              calculatorType="environmental-calculator"
              input={buildSavedAnalysis({
                courseType,
                goalMode,
                workoutType,
                distanceMeters,
                actualTimeSeconds: context!.actualTimeSeconds,
                equivalentTimeSeconds: outcome.estimateSeconds,
                equivalentLowSeconds: outcome.lowSeconds,
                equivalentHighSeconds: outcome.highSeconds,
                conditions: conditionsA
                  ? {
                      tempC: conditionsA.tempC,
                      relativeHumidityPct: conditionsA.relativeHumidityPct,
                      windSpeedMS: conditionsA.windSpeedMS,
                      windFromBearingDeg: conditionsA.windFromBearingDeg,
                      windExposureScore,
                      elevationGainM: effectiveElevationGainM,
                      elevationLossM: effectiveElevationLossM,
                    }
                  : null,
                breakdown: workoutResultsForDisplay.map((r) => ({ factor: r.factor, adjustmentSeconds: r.adjustmentSeconds })),
                confidenceLevel,
                recordedAtIso: routeSummary?.startTimeIso ?? null,
              })}
              output={{
                estimateSeconds: outcome.estimateSeconds,
                lowSeconds: outcome.lowSeconds,
                highSeconds: outcome.highSeconds,
              }}
              label={`${workoutConfig.label} -- ${
                workoutPlannedPaceSeconds !== null
                  ? `${formatClock(workoutPlannedPaceSeconds)}/${workoutPerUnitLabel === "mile" ? "mi" : "km"}`
                  : formatTime(context!.actualTimeSeconds)
              }`}
            />
          </div>

          <div className="mt-4">
            <p className={sectionLabelClass}>What Slowed You Down (Or Helped)</p>
            <div className={statCardClass}>
              <EquivalentPerformanceBar
                results={workoutResultsForDisplay}
                totalAdjustmentSeconds={workoutTotalAdjustmentForDisplay}
              />
            </div>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
              Shown as seconds per {workoutPerUnitLabel}
              {workoutPerUnitLabel === "rep" ? " (this rep's total)" : ""}.
            </p>
          </div>

          {courseType === "road" && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <span>Workout type:</span>
              {workoutTypeGuess && !showWorkoutTypeOverride ? (
                <>
                  <strong className="text-zinc-900 dark:text-white">{workoutConfig.label}</strong>
                  <span>(detected)</span>
                  <button
                    type="button"
                    onClick={() => setShowWorkoutTypeOverride(true)}
                    className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
                  >
                    Change
                  </button>
                </>
              ) : (
                <select
                  aria-label="Workout type"
                  value={workoutType}
                  onChange={(event) => {
                    setWorkoutType(event.target.value as WorkoutType);
                    setWorkoutTypeGuess(null);
                  }}
                  className={fieldClass}
                >
                  {WORKOUT_TYPE_ORDER.map((type) => (
                    <option key={type} value={type}>
                      {WORKOUT_TYPE_CONFIG[type].label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="mt-4">
            <ContentCallout
              variant="tip"
              title="🎯 Training Guidance"
              text={trainingGuidance(
                workoutConfig.targetSystem,
                workoutConfig.driftDescription,
                workoutTotalAdjustmentForDisplay,
                workoutPerUnitLabel,
              )}
            />
          </div>

          {coachNotesText && (
            <div className="mt-4">
              <ContentCallout variant="tip" title="🧑‍🏫 Coach's Notes" text={coachNotesText} />
            </div>
          )}
        </div>
      )}

      {outcome && goalMode !== "adjust" && (
        <div>
          <p className={sectionLabelClass}>Result</p>
          <div className={`${heroCardClass} ${courseType === "track" ? "flex flex-col gap-6 sm:flex-row sm:items-start" : ""}`}>
            <div className="flex-1">
              <p className={statLabelClass}>{copy.resultLabel}</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
                {formatTime(outcome.estimateSeconds)}
              </p>
              {copy.resultLabel.includes("Ideal Conditions") && (
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  <strong>Ideal Conditions</strong> assumes cool temperature (~50-59°F), low humidity, calm wind, flat
                  terrain, and sea-level elevation.
                </p>
              )}
              <p className="mt-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                Likely range: {formatRange(outcome.lowSeconds, outcome.highSeconds, formatTime)}
              </p>
              <div className="mt-2 max-w-sm">
                <ConfidenceRangeBar
                  lowSeconds={outcome.lowSeconds}
                  estimateSeconds={outcome.estimateSeconds}
                  highSeconds={outcome.highSeconds}
                  referenceSeconds={goalMode !== "predict" ? context!.actualTimeSeconds : undefined}
                  referenceLabel={goalMode === "analyze" ? "Actual" : goalMode === "convert" ? "Conditions A" : undefined}
                  formatValue={formatTime}
                />
              </div>

              <details className={`mt-2 ${detailsClass}`}>
                <summary className={summaryClass}>
                  Confidence is {confidenceLevel} -- why?
                </summary>
                <ul className={`${detailsBodyClass} space-y-1`}>
                  {confidenceReasons.map((reason) => (
                    <li key={reason.label}>
                      {reason.strengthensConfidence ? "✓ " : "~ "}
                      {reason.label}
                    </li>
                  ))}
                </ul>
              </details>

              {showsPaceDisplay && (
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-black/10 pt-3 dark:border-white/10">
                  <div>
                    <p className={statLabelClass}>Actual pace</p>
                    <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                      {actualPaceSeconds !== null ? `${formatClock(actualPaceSeconds)}/${paceUnitLabel}` : "--"}
                    </p>
                  </div>
                  <span aria-hidden="true" className="text-lg text-zinc-400">
                    →
                  </span>
                  <div>
                    <p className={statLabelClass}>Equivalent pace</p>
                    <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                      {equivalentPaceLowSeconds !== null && equivalentPaceHighSeconds !== null
                        ? `${formatRange(equivalentPaceLowSeconds, equivalentPaceHighSeconds, formatClock)}/${paceUnitLabel}`
                        : "--"}
                    </p>
                  </div>
                  <div className="ml-auto flex gap-1">
                    <button
                      type="button"
                      onClick={() => setPaceDisplayUnit("mi")}
                      aria-pressed={paceDisplayUnit === "mi"}
                      className={segmentedButtonClass(paceDisplayUnit === "mi")}
                    >
                      /mi
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaceDisplayUnit("km")}
                      aria-pressed={paceDisplayUnit === "km"}
                      className={segmentedButtonClass(paceDisplayUnit === "km")}
                    >
                      /km
                    </button>
                  </div>
                </div>
              )}

              <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
                {goalMode === "analyze" &&
                  `Running ${formatTime(context!.actualTimeSeconds)} under these conditions was worth about ${formatTime(outcome.estimateSeconds)} on a calm, mild${courseType !== "track" ? ", flat" : ""} day. This is an estimate, not a lab measurement -- individual heat tolerance, wind sensitivity${courseType !== "track" ? ", and hill strength" : ""} all vary.`}
                {goalMode === "predict" &&
                  `A ${formatTime(context!.actualTimeSeconds)} effort in ideal conditions is likely to land around ${formatTime(outcome.estimateSeconds)} given the expected conditions${courseType !== "track" ? " and course" : ""}.`}
                {goalMode === "convert" &&
                  `Running ${formatTime(context!.actualTimeSeconds)} under Conditions A is roughly equivalent to ${formatTime(outcome.estimateSeconds)} under Conditions B.`}
              </p>
              <SaveCalculationButton
                calculatorType="environmental-calculator"
                input={buildSavedAnalysis({
                  courseType,
                  goalMode,
                  workoutType,
                  distanceMeters,
                  actualTimeSeconds: goalMode === "predict" ? null : context!.actualTimeSeconds,
                  equivalentTimeSeconds: outcome.estimateSeconds,
                  equivalentLowSeconds: outcome.lowSeconds,
                  equivalentHighSeconds: outcome.highSeconds,
                  conditions: conditionsA
                    ? {
                        tempC: conditionsA.tempC,
                        relativeHumidityPct: conditionsA.relativeHumidityPct,
                        windSpeedMS: conditionsA.windSpeedMS,
                        windFromBearingDeg: conditionsA.windFromBearingDeg,
                        windExposureScore,
                        elevationGainM: effectiveElevationGainM,
                        elevationLossM: effectiveElevationLossM,
                      }
                    : null,
                  breakdown: breakdownResultsA.map((r) => ({ factor: r.factor, adjustmentSeconds: r.adjustmentSeconds })),
                  confidenceLevel,
                  recordedAtIso: routeSummary?.startTimeIso ?? null,
                })}
                output={{ estimateSeconds: outcome.estimateSeconds, lowSeconds: outcome.lowSeconds, highSeconds: outcome.highSeconds }}
                label={`${
                  courseType === "track"
                    ? REP_TYPE_OPTIONS.find((option) => option.value === repType)?.label
                    : courseType === "route"
                      ? `${(distanceMeters / 1609.344).toFixed(2)} mi route`
                      : DISTANCE_LABEL[distancePreset]
                } in ${formatTime(context!.actualTimeSeconds)}`}
              />
            </div>

            {courseType === "track" && (
              <div className="flex flex-col items-center gap-2">
                <TrackDiagram repType={repType} />
                <p className="text-center text-xs text-zinc-600 dark:text-zinc-300">Segments this rep covers, highlighted</p>
              </div>
            )}
          </div>

          {courseType === "track" && altRepType && altOutcome && (
            <div className="mt-4">
              <ContentCallout
                variant={altIsBetter ? "tip" : "research"}
                title="🎯 Coaching Application"
                text={
                  altIsBetter
                    ? `Given today's conditions, ${REP_TYPE_OPTIONS.find((option) => option.value === altRepType)?.label} would be the better starting line -- about ${Math.abs(outcome.estimateSeconds - altOutcome.estimateSeconds).toFixed(1)}s faster than the standard ${REP_TYPE_OPTIONS.find((option) => option.value === repType)?.label} for the identical effort. Which segments you skip is a real, exploitable choice on a windy day, not a formality.`
                    : `The standard ${REP_TYPE_OPTIONS.find((option) => option.value === repType)?.label} starting line already beats ${REP_TYPE_OPTIONS.find((option) => option.value === altRepType)?.label} for today's conditions -- no need to switch.`
                }
              />
            </div>
          )}

          <div className="mt-4">
            <p className={sectionLabelClass}>What Slowed You Down (Or Helped)</p>
            <div className={statCardClass}>
              {goalMode === "convert" ? (
                <div className="space-y-6">
                  <div>
                    <p className={`${labelClass} mb-2`}>Conditions A</p>
                    <EquivalentPerformanceBar results={breakdownResultsA} totalAdjustmentSeconds={breakdownTotalA} />
                  </div>
                  <div>
                    <p className={`${labelClass} mb-2`}>Conditions B</p>
                    <EquivalentPerformanceBar results={breakdownResultsB} totalAdjustmentSeconds={breakdownTotalB} />
                  </div>
                </div>
              ) : (
                <EquivalentPerformanceBar results={breakdownResultsA} totalAdjustmentSeconds={breakdownTotalA} />
              )}
            </div>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
              Shown as seconds per {showsPaceDisplay ? paceUnitLabel : "this rep (total)"}.
            </p>
            {resultsA.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                {resultsA.map((result) => (
                  <li key={result.factor}>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-100">{result.factor}:</span> {result.summary}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {coachNotesText && (
            <div className="mt-4">
              <ContentCallout variant="tip" title="🧑‍🏫 Coach's Notes" text={coachNotesText} />
            </div>
          )}

          <div className="mt-4">
            <ContentCallout
              variant="tip"
              title="🎯 How to use this"
              text="Treat the estimate and range as a sanity check, not a promise -- if a race went badly in tough conditions, this can show you it was still a strong effort. If you're setting a goal for an upcoming race, use the low end of the range for a conservative target and the high end as your ceiling."
            />
          </div>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowEducation((value) => !value)}
          aria-expanded={showEducation}
          className="flex items-center gap-2 py-1 text-lg font-semibold text-zinc-900 dark:text-white"
        >
          Behind the calculator: what each factor means, and its limits
          <span aria-hidden="true" className="text-sm font-normal">
            {showEducation ? "↑" : "↓"}
          </span>
        </button>
        {showEducation && (
          <div className="mt-4 max-w-[64ch] space-y-2">
            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span
                  aria-hidden="true"
                  className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                >
                  ▶
                </span>
                🌡️ Heat
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Practical takeaway:</strong> On a
                  warm or humid day, expect to run somewhat slower for the same effort -- that&rsquo;s physics, not a
                  fitness problem, so don&rsquo;t let a slower split on a hot day shake your confidence.
                </p>
                <p className="mt-2">
                  As it gets hotter, your body sends more blood to your skin to shed heat (increased skin blood
                  flow) instead of to your working muscles, your heart rate drifts upward for the same pace
                  (cardiovascular drift), and your core temperature rises toward the point your body has to slow you
                  down to protect itself. Rather than reasoning that pattern out from first principles, this factor
                  is looked up from an empirical model fit directly to real race results -- Mantzios et al.,
                  &ldquo;Modeling the Effect of Ambient Temperature and Humidity on Marathon Performance&rdquo;
                  (Medicine &amp; Science in Sports &amp; Exercise, 2022;54(1):151), a statistical model built from
                  3,891 runners across 754 marathons. It&rsquo;s calibrated to marathon-length efforts, so shorter or
                  longer races use a scaled-down or scaled-up version of that same effect, which is the main reason
                  the result still comes with a confidence range rather than an exact number.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span
                  aria-hidden="true"
                  className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                >
                  ▶
                </span>
                💧 Humidity
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Practical takeaway:</strong> High
                  humidity makes a warm day feel even harder than the thermometer alone suggests -- it&rsquo;s worth
                  checking separately from temperature, not folding into a single &ldquo;it&rsquo;s hot&rdquo; judgment call.
                </p>
                <p className="mt-2">
                  Sweating only cools you if it evaporates -- in humid air, sweat drips off instead, so you lose
                  fluid without gaining the cooling benefit. Heat and humidity aren&rsquo;t fully separable in the
                  underlying data either (the same Mantzios et al. 2022 model above covers both together as one
                  temperature x humidity surface), so this calculator isolates humidity&rsquo;s marginal effect by
                  comparing that surface at the actual humidity against a dry-air reference, and attributes the
                  difference here rather than double-counting it under Heat.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span
                  aria-hidden="true"
                  className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                >
                  ▶
                </span>
                💨 Wind
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Practical takeaway:</strong> A
                  headwind costs you more time than an equal tailwind gives back -- don&rsquo;t expect a windy
                  out-and-back or loop to average out to zero, and don&rsquo;t judge your effort against a
                  headwind-slowed split as if the wind weren&rsquo;t there.
                </p>
                <p className="mt-2">
                  A headwind adds drag you have to push through; a tailwind reduces it. On the road, this factor is
                  grounded in Black et al. 2018 (calm-air metabolic cost), the standard drag equation, and Da Silva
                  et al. 2022 (converting drag force into a pace effect), and assumes you held one primary heading
                  for the whole effort -- a course with lots of turns will have a wind effect that varies along the
                  way, which is part of why the range here is wider than a single-heading point estimate would
                  suggest. On the track, it instead integrates the wind curve-by-curve as your heading rotates
                  continuously through the bends -- see the track-specific entry below. On an imported route, it
                  integrates the same way but point-by-point along your file&rsquo;s own real heading changes, so
                  there&rsquo;s no single-heading assumption to make at all -- this is the most precise of the three
                  wind models, which is why its range is the narrowest.
                </p>
              </div>
            </details>

            {courseType === "track" && (
              <>
                <details className={detailsClass}>
                  <summary className={summaryClass}>
                    <span
                      aria-hidden="true"
                      className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                    >
                      ▶
                    </span>
                    🏟️ Why a track needs more than the road model
                  </summary>
                  <div className={detailsBodyClass}>
                    <p>
                      On the road, a wind&rsquo;s effect on you is roughly constant for the length of a rep. On a
                      track, your heading rotates continuously through both curves, so the wind alternates between
                      assisting and opposing you within a single 400m lap. This calculator handles that by
                      numerically integrating around each curve: slicing it into 90 tiny straight segments,
                      evaluating the wind&rsquo;s effect on each one, and summing the result.
                    </p>
                  </div>
                </details>

                <details className={detailsClass}>
                  <summary className={summaryClass}>
                    <span
                      aria-hidden="true"
                      className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                    >
                      ▶
                    </span>
                    Why non-standard reps have an &ldquo;other start&rdquo; option
                  </summary>
                  <div className={detailsBodyClass}>
                    <p>
                      A 200m, 600m, or 1000m rep is a non-integer number of laps, so it necessarily starts partway
                      around the track -- which half of the track gets skipped is a real, exploitable choice on a
                      windy day. This calculator computes both starting lines and tells you which one is actually
                      faster for today&rsquo;s specific conditions, shown above when it makes a meaningful
                      difference.
                    </p>
                  </div>
                </details>

                <details className={detailsClass}>
                  <summary className={summaryClass}>
                    <span
                      aria-hidden="true"
                      className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                    >
                      ▶
                    </span>
                    Constant effort vs. constant speed
                  </summary>
                  <div className={detailsBodyClass}>
                    <p>
                      Constant effort is the realistic default: most runners naturally ease off into a headwind and
                      pick up with a tailwind, holding roughly the same physical exertion throughout. Constant speed
                      models a runner deliberately holding identical splits regardless of the wind -- following a
                      pacing light, a Stryd power target, or another runner&rsquo;s exact pace. Holding speed costs
                      strictly more in a headwind than the equivalent easing-off would, since the metabolic cost of
                      overcoming drag rises with the square of relative airflow speed.
                    </p>
                  </div>
                </details>
              </>
            )}

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span
                  aria-hidden="true"
                  className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                >
                  ▶
                </span>
                ⛰️ Elevation
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  <strong className="font-semibold text-zinc-900 dark:text-white">Practical takeaway:</strong> A
                  hilly course is almost always a net time cost versus a flat one of the same distance, even when
                  the total climbing and descending look balanced on paper -- don&rsquo;t expect the downhills to pay
                  back what the uphills cost.
                </p>
                <p className="mt-2">
                  Climbing costs substantially more energy per vertical meter than descending recovers -- this uses
                  the actual quintic polynomial from Minetti et al., &ldquo;Energy cost of walking and running at
                  extreme uphill and downhill slopes&rdquo; (Journal of Applied Physiology, 2002), the same model
                  behind the standalone{" "}
                  <Link
                    href="/gap-calculator"
                    className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
                  >
                    GAP Calculator
                  </Link>
                  . Since this input is a total gain/loss rather than a grade-by-grade profile (a 100m climb could
                  be a short steep pitch or a long gentle rise, which Minetti&rsquo;s polynomial treats quite
                  differently), it assumes a moderate representative grade to translate vertical meters into a
                  climbing/descending distance. Not a factor on a track, which is engineered flat.
                </p>
              </div>
            </details>

            {goalMode === "adjust" && (
              <>
                <details className={detailsClass}>
                  <summary className={summaryClass}>
                    <span
                      aria-hidden="true"
                      className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                    >
                      ▶
                    </span>
                    Why heat and humidity change a workout&rsquo;s pace, not just a race&rsquo;s
                  </summary>
                  <div className={detailsBodyClass}>
                    <p>
                      Heat and humidity add cardiovascular strain on top of whatever pace you&rsquo;re running --
                      your heart works harder to send blood to your skin for cooling as well as to your muscles for
                      running, so the same pace simply costs more at a given effort. A workout&rsquo;s target pace
                      is really a target <em>effort</em> in disguise (threshold effort, VO&#8322; max effort, easy
                      effort), so when conditions raise the cost of a pace, holding that pace means raising the
                      effort past what the workout intended -- exactly the drift this mode is built to catch before
                      it happens on the run, rather than showing up as an unplanned red-line 10 minutes in.
                    </p>
                  </div>
                </details>

                <details className={detailsClass}>
                  <summary className={summaryClass}>
                    <span
                      aria-hidden="true"
                      className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                    >
                      ▶
                    </span>
                    Why wind affects intervals differently than easy runs
                  </summary>
                  <div className={detailsBodyClass}>
                    <p>
                      Wind drag rises with the square of your speed relative to the air, so it costs disproportionately
                      more at faster paces -- a headwind that&rsquo;s a minor nuisance on an easy run can be a real
                      tax on a VO&#8322; max interval run at a much higher speed. It also compounds rep to rep:
                      fighting the same headwind on every interval adds up in a way a single continuous tempo effort
                      doesn&rsquo;t experience, which is why interval-style workouts get a rep-by-rep framing here
                      rather than a single blended number.
                    </p>
                  </div>
                </details>

                <details className={detailsClass}>
                  <summary className={summaryClass}>
                    <span
                      aria-hidden="true"
                      className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                    >
                      ▶
                    </span>
                    Why different workout types need different handling
                  </summary>
                  <div className={detailsBodyClass}>
                    <p>
                      Every workout type targets a specific physiological adaptation -- easy runs build aerobic base
                      without added fatigue, threshold work trains lactate clearance right at its limit, VO&#8322;
                      max intervals push your aerobic ceiling. The environmental math is identical underneath, but
                      what a given adjustment <em>means</em> isn&rsquo;t: the same +10 seconds per mile is a
                      non-issue on an easy run and the difference between a clean threshold session and an
                      accidental VO&#8322; max session. That&rsquo;s why the guidance above always names the
                      specific workout and what holding the original pace risks turning it into, rather than just
                      reporting a number.
                    </p>
                  </div>
                </details>
              </>
            )}

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span
                  aria-hidden="true"
                  className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                >
                  ▶
                </span>
                Confidence ranges, and what&rsquo;s not modeled yet
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Every factor&rsquo;s range reflects real variation this calculator can&rsquo;t know about for
                  you specifically -- heat acclimatization, sweat rate, wind-sensitivity, and hill strength all
                  differ by runner. The combined range simply adds each factor&rsquo;s own low/high bound rather
                  than assuming they&rsquo;re statistically independent, which is a wider, more conservative range than a
                  more sophisticated model might produce. Direct sunlight, air quality, and altitude
                  acclimatization aren&rsquo;t factored in yet -- each is a large enough topic to deserve its own
                  well-grounded model rather than a rough guess bolted onto this one.
                </p>
              </div>
            </details>
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Looking for just a live heat reading and training guidance, without a race or workout to analyze?{" "}
        <Link href="/heat-tracker" className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white">
          Heat Tracker
        </Link>{" "}
        has that.
      </p>
    </div>
  );
}
