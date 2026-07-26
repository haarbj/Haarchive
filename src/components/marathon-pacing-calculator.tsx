"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";

import { RouteImportPanel } from "@/components/route-import-panel";
import { SaveCalculationButton } from "@/components/save-calculation-button";
import { WindCompass } from "@/components/wind-compass";
import {
  isWithinModelDomain,
  predictSpeeds,
  selectTrainingPaces,
  type CvThresholdModel,
} from "@/lib/cv-threshold-math";
import type { WeatherConditions } from "@/lib/environmental/fetch-weather-conditions";
import { buildFuelingSchedule, computeFuelingTargets } from "@/lib/marathon-pacing/fueling-engine";
import { analyzeCourse, type CourseAnalysis } from "@/lib/marathon-pacing/course-analysis";
import { buildDisplaySplits } from "@/lib/marathon-pacing/pace-rounding";
import { PRESET_COURSES, buildPresetRoute, presetCourseMap, type PresetCourseId } from "@/lib/marathon-pacing/preset-courses";
import { generatePacingPlan, type MileSplit } from "@/lib/marathon-pacing/split-generator";
import { PACING_STRATEGIES, type RiskLevel, type StrategyId } from "@/lib/marathon-pacing/strategy-engine";
import type { Durability } from "@/lib/marathon-pacing/physiology-engine";
import type { ParsedRoute } from "@/lib/route-import/types";
import type { RouteSummary } from "@/lib/route-import/route-summary";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { formatClock, parseTimeToSeconds } from "@/lib/running-format";
import { usePersistedField, usePersistedJSON } from "@/lib/use-persisted-field";
import {
  detailsBodyClass,
  detailsClass,
  heroCardClass,
  sectionLabelClass,
  segmentedButtonClass,
  statCardClass,
  statLabelClass,
  summaryClass,
} from "@/lib/tool-styles";

const METERS_PER_MILE = 1609.344;
const MARATHON_METERS = 42195;
const MODEL_URL = "/data/cv-threshold-model.json";
const STORAGE_KEY = "haarchive-marathon-pacing-calculator-state";

// Same 800m-10K range the CV Threshold Calculator offers -- the underlying
// model (cv-threshold-math.ts) is only fit across that domain, so this
// mirrors that tool's own distance list rather than the site's full
// race-distances.ts catalog, which goes well beyond what the model supports.
type FitnessDistanceKey = "800m" | "1500m" | "1600m" | "mile" | "3000m" | "5k" | "8k" | "10k";
const FITNESS_DISTANCE_OPTIONS: { key: FitnessDistanceKey; label: string; meters: number }[] = [
  { key: "800m", label: "800m", meters: 800 },
  { key: "1500m", label: "1500m", meters: 1500 },
  { key: "1600m", label: "1600m", meters: 1600 },
  { key: "mile", label: "1 Mile", meters: METERS_PER_MILE },
  { key: "3000m", label: "3000m", meters: 3000 },
  { key: "5k", label: "5K", meters: 5000 },
  { key: "8k", label: "8K", meters: 8000 },
  { key: "10k", label: "10K", meters: 10000 },
];

const DURABILITY_OPTIONS: { key: Durability; label: string }[] = [
  { key: "poor", label: "Poor" },
  { key: "average", label: "Average" },
  { key: "excellent", label: "Excellent" },
];

const RISK_OPTIONS: { key: RiskLevel; label: string }[] = [
  { key: "low", label: "Low" },
  { key: "moderate", label: "Moderate" },
  { key: "high", label: "High" },
];

type PersistedState = {
  fitnessDistanceKey: FitnessDistanceKey;
  fitnessTimeInput: string;
  ageInput: string;
  goalTimeInput: string;
  weightLbInput: string;
  durability: Durability;
  strategyId: StrategyId;
  risk: RiskLevel;
  courseSource: "upload" | "preset";
  presetCourseId: PresetCourseId | "";
  useConditions: boolean;
  tempFInput: string;
  humidityInput: string;
  windMphInput: string;
  windFromDeg: number;
  showMethodology: boolean;
};

// Same module-scope fetch-once cache pattern as cv-threshold-calculator.tsx
// -- a separate promise here (not a shared import) since each component
// owns its own private cache the same way that one does.
let modelPromise: Promise<CvThresholdModel> | null = null;
function loadModel(): Promise<CvThresholdModel> {
  if (!modelPromise) {
    modelPromise = fetch(MODEL_URL).then((res) => {
      if (!res.ok) throw new Error(`Failed to load model data (${res.status})`);
      return res.json() as Promise<CvThresholdModel>;
    });
  }
  return modelPromise;
}

const PRESET_COURSES_BY_REGION = new Map<string, typeof PRESET_COURSES>();
for (const course of PRESET_COURSES) {
  const list = PRESET_COURSES_BY_REGION.get(course.region) ?? [];
  list.push(course);
  PRESET_COURSES_BY_REGION.set(course.region, list);
}

function buildFlatCourse(): CourseAnalysis {
  const mileCount = Math.floor(MARATHON_METERS / METERS_PER_MILE);
  return {
    totalDistanceM: mileCount * METERS_PER_MILE,
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
    perMileGrade: new Array(mileCount).fill(0),
    perMileHeadingDeg: new Array(mileCount).fill(null),
  };
}

function fToC(f: number): number {
  return ((f - 32) * 5) / 9;
}

function mphToMS(mph: number): number {
  return mph * 0.44704;
}

function lbsToKg(lbs: number): number {
  return lbs * 0.453592;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

// Bounds the underlying heat/humidity model's grid actually covers (0-45C /
// 32-113F) -- typed input beyond this degrades gracefully to the model's
// real edge rather than silently extrapolating into a nonsense result.
const TEMP_F_MIN = -20;
const TEMP_F_MAX = 130;
const WIND_MPH_MAX = 80;

// A small, dependency-free multi-line chart: each series is normalized
// independently to fill the chart's own height, so e.g. pace (seconds) and
// elevation (meters) can share one x-axis at a glance without a real dual
// y-axis -- exact values live in the mile table, this is for shape, not
// precision reading.
type ChartSeries = { label: string; color: string; values: number[] };

function MultiLineChart({ series, xLabels }: { series: ChartSeries[]; xLabels: string[] }) {
  const width = 640;
  const height = 180;
  const padding = 8;
  const count = xLabels.length;

  function pointsFor(values: number[]): string {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    return values
      .map((v, i) => {
        const x = count > 1 ? padding + (i / (count - 1)) * (width - padding * 2) : width / 2;
        // A truly constant series (e.g. grade on a flat course) has no
        // min/max to normalize against -- draw it centered rather than
        // silently collapsing to the bottom edge, which reads as "empty."
        const normalized = range > 0 ? (v - min) / range : 0.5;
        const y = height - padding - normalized * (height - padding * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={series.map((s) => s.label).join(", ")}>
        {series.map((s) => (
          <polyline key={s.label} points={pointsFor(s.values)} fill="none" stroke={s.color} strokeWidth={2} />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarathonPacingCalculator() {
  const baseId = useId();
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const [model, setModel] = useState<CvThresholdModel | null>(null);
  const [modelError, setModelError] = useState(false);
  useEffect(() => {
    loadModel()
      .then(setModel)
      .catch(() => setModelError(true));
  }, []);

  const [fitnessDistanceKey, setFitnessDistanceKey] = usePersistedField<FitnessDistanceKey>(persisted?.fitnessDistanceKey, "5k");
  const [fitnessTimeInput, setFitnessTimeInput] = usePersistedField(persisted?.fitnessTimeInput, "20:00");
  const [ageInput, setAgeInput] = usePersistedField(persisted?.ageInput, "35");
  const [goalTimeInput, setGoalTimeInput] = usePersistedField(persisted?.goalTimeInput, "3:45:00");
  const [weightLbInput, setWeightLbInput] = usePersistedField(persisted?.weightLbInput, "155");
  const [durability, setDurability] = usePersistedField<Durability>(persisted?.durability, "average");
  const [strategyId, setStrategyId] = usePersistedField<StrategyId>(persisted?.strategyId, "even-effort");
  const [risk, setRisk] = usePersistedField<RiskLevel>(persisted?.risk, "moderate");
  const [useConditions, setUseConditions] = usePersistedField(persisted?.useConditions, false);
  const [tempFInput, setTempFInput] = usePersistedField(persisted?.tempFInput, "55");
  const [humidityInput, setHumidityInput] = usePersistedField(persisted?.humidityInput, "50");
  const [windMphInput, setWindMphInput] = usePersistedField(persisted?.windMphInput, "0");
  const [windFromDeg, setWindFromDeg] = usePersistedField(persisted?.windFromDeg, 0);
  const [showMethodology, setShowMethodology] = usePersistedField(persisted?.showMethodology, false);

  const [courseSource, setCourseSource] = usePersistedField<"upload" | "preset">(persisted?.courseSource, "upload");
  const [presetCourseId, setPresetCourseId] = usePersistedField<PresetCourseId | "">(persisted?.presetCourseId, "");
  const [route, setRoute] = useState<ParsedRoute | null>(null);
  const [routeLabel, setRouteLabel] = useState<string | null>(null);

  function handleRouteLoaded(_summary: RouteSummary, label: string, loadedRoute: ParsedRoute) {
    setPresetCourseId(""); // uploading a route and picking a preset are mutually exclusive
    setRoute(loadedRoute);
    setRouteLabel(label);
    persistState();
  }

  function handleSelectPreset(id: PresetCourseId | "") {
    setPresetCourseId(id);
    setRoute(null);
    setRouteLabel(null);
    persistState();
  }

  const fitnessDistance = FITNESS_DISTANCE_OPTIONS.find((d) => d.key === fitnessDistanceKey);
  const fitnessTimeSeconds = parseTimeToSeconds(fitnessTimeInput);
  const ageRaw = Number(ageInput);
  const ageValid = ageInput.trim() !== "" && Number.isFinite(ageRaw) && ageRaw > 0;
  const canPredictFitness = model !== null && fitnessDistance !== undefined && fitnessTimeSeconds !== null && ageValid;

  const fitnessPrediction = canPredictFitness
    ? predictSpeeds(model, fitnessDistance.meters, fitnessTimeSeconds, ageRaw)
    : null;
  const fitnessInDomain = canPredictFitness ? isWithinModelDomain(model, fitnessDistance.meters, fitnessTimeSeconds, ageRaw) : true;
  const fitnessPaces = fitnessPrediction ? selectTrainingPaces(fitnessPrediction, "safe") : null;

  const goalTimeSeconds = parseTimeToSeconds(goalTimeInput);
  const weightLbRaw = Number(weightLbInput);
  const weightValid = weightLbInput.trim() !== "" && Number.isFinite(weightLbRaw) && weightLbRaw > 0;
  const weightKg = weightValid ? lbsToKg(weightLbRaw) : undefined;

  const { course, courseError } = useMemo(() => {
    const sourceRoute = presetCourseId ? buildPresetRoute(presetCourseMap.get(presetCourseId)!) : route;
    if (!sourceRoute) return { course: buildFlatCourse(), courseError: null as string | null };
    try {
      return { course: analyzeCourse(sourceRoute), courseError: null as string | null };
    } catch (error) {
      return {
        course: buildFlatCourse(),
        courseError: error instanceof Error ? error.message : "Couldn't analyze that route.",
      };
    }
  }, [route, presetCourseId]);

  const weatherConditions: WeatherConditions | undefined = useMemo(() => {
    if (!useConditions) return undefined;
    const tempFRaw = Number(tempFInput);
    const humidityRaw = Number(humidityInput);
    const windMphRaw = Number(windMphInput);
    if (!Number.isFinite(tempFRaw) || !Number.isFinite(humidityRaw) || !Number.isFinite(windMphRaw)) return undefined;
    const tempF = clamp(tempFRaw, TEMP_F_MIN, TEMP_F_MAX);
    const humidityPct = clamp(humidityRaw, 0, 100);
    const windMph = clamp(windMphRaw, 0, WIND_MPH_MAX);
    return {
      tempC: fToC(tempF),
      relativeHumidityPct: humidityPct,
      dewPointC: fToC(tempF) - 5,
      cloudCoverPct: 50,
      pressureHPa: 1013,
      windSpeedMS: mphToMS(windMph),
      windFromBearingDeg: windFromDeg,
      windGustsMS: mphToMS(windMph),
    };
  }, [useConditions, tempFInput, humidityInput, windMphInput, windFromDeg]);

  const canGeneratePlan = fitnessPaces !== null && goalTimeSeconds !== null && goalTimeSeconds > 0;

  const plan = useMemo(() => {
    if (!canGeneratePlan || !fitnessPaces) return null;
    return generatePacingPlan({
      course,
      goalTimeSeconds: goalTimeSeconds!,
      criticalSpeedMS: fitnessPaces.cvSpeedMS,
      vo2maxSpeedMS: fitnessPaces.vo2maxSpeedMS,
      strategyId,
      risk,
      weightKg,
      durability,
      weatherConditions,
    });
  }, [canGeneratePlan, course, goalTimeSeconds, fitnessPaces, strategyId, risk, weightKg, durability, weatherConditions]);

  // Displayed paces are rounded to the nearest 5s -- easier to hold in your
  // head on race day ("start at 6:20, pick it up 5s/mi") than false
  // precision no road marathon lets you actually hit anyway. Elapsed times
  // are the running sum of these rounded paces, not the engine's precise
  // elapsed time, so the table stays internally self-consistent.
  const displaySplits = useMemo(() => (plan ? buildDisplaySplits(plan.splits) : []), [plan]);
  const displayTotalSeconds = displaySplits.length > 0 ? displaySplits[displaySplits.length - 1].displayElapsedSeconds : null;

  const fuelingTargets = goalTimeSeconds ? computeFuelingTargets({ goalTimeSeconds, weightKg, tempC: weatherConditions?.tempC }) : null;
  const fuelingSchedule =
    plan && fuelingTargets && goalTimeSeconds
      ? buildFuelingSchedule(
          plan.splits.map((s) => ({ mile: s.mile, paceSecPerMile: s.paceSecPerMile })),
          fuelingTargets,
          goalTimeSeconds,
        )
      : [];

  function persistState() {
    try {
      const state: PersistedState = {
        fitnessDistanceKey,
        fitnessTimeInput,
        ageInput,
        goalTimeInput,
        weightLbInput,
        durability,
        strategyId,
        risk,
        courseSource,
        presetCourseId,
        useConditions,
        tempFInput,
        humidityInput,
        windMphInput,
        windFromDeg,
        showMethodology,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage.
    }
  }

  const totalMiles = plan?.splits.length ?? 0;
  const avgPaceSeconds = displayTotalSeconds !== null && totalMiles > 0 ? displayTotalSeconds / totalMiles : null;
  const finishDeltaSeconds = displayTotalSeconds !== null && goalTimeSeconds !== null ? displayTotalSeconds - goalTimeSeconds : null;

  return (
    <div className="mt-10 space-y-10">
      <div>
        <p className={sectionLabelClass}>Your fitness</p>
        <div className={`${statCardClass} space-y-4`}>
          <div>
            <p className={labelClass}>Recent race distance</p>
            <div className="flex flex-wrap gap-2">
              {FITNESS_DISTANCE_OPTIONS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => {
                    setFitnessDistanceKey(d.key);
                    persistState();
                  }}
                  aria-pressed={fitnessDistanceKey === d.key}
                  className={segmentedButtonClass(fitnessDistanceKey === d.key)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div>
              <label htmlFor={`${baseId}-fitness-time`} className={labelClass}>
                Finish time
              </label>
              <input
                id={`${baseId}-fitness-time`}
                type="text"
                value={fitnessTimeInput}
                onChange={(event) => {
                  setFitnessTimeInput(event.target.value);
                  persistState();
                }}
                placeholder="mm:ss"
                autoComplete="off"
                className={`w-28 ${fieldClass}`}
              />
            </div>
            <div>
              <label htmlFor={`${baseId}-age`} className={labelClass}>
                Age
              </label>
              <input
                id={`${baseId}-age`}
                type="number"
                min={10}
                max={90}
                value={ageInput}
                onChange={(event) => {
                  setAgeInput(event.target.value);
                  persistState();
                }}
                className={`w-20 ${fieldClass}`}
              />
            </div>
            <div>
              <label htmlFor={`${baseId}-weight`} className={labelClass}>
                Weight (lb, optional)
              </label>
              <input
                id={`${baseId}-weight`}
                type="number"
                min={0}
                value={weightLbInput}
                onChange={(event) => {
                  setWeightLbInput(event.target.value);
                  persistState();
                }}
                className={`w-24 ${fieldClass}`}
              />
            </div>
          </div>
          <div>
            <p className={labelClass}>Durability (fatigue resistance)</p>
            <div className="flex flex-wrap gap-2">
              {DURABILITY_OPTIONS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => {
                    setDurability(d.key);
                    persistState();
                  }}
                  aria-pressed={durability === d.key}
                  className={segmentedButtonClass(durability === d.key)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          {model && canPredictFitness && !fitnessInDomain && (
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              That performance (or age) is outside the fitness model&rsquo;s well-tested range -- treat the pacing plan
              below as a rougher estimate.
            </p>
          )}
          {modelError && <p className="text-xs font-semibold text-red-700 dark:text-red-400">Couldn&rsquo;t load fitness model data -- try refreshing.</p>}
        </div>
      </div>

      <div>
        <p className={sectionLabelClass}>Goal</p>
        <div className={`${statCardClass}`}>
          <label htmlFor={`${baseId}-goal-time`} className={labelClass}>
            Marathon goal time
          </label>
          <input
            id={`${baseId}-goal-time`}
            type="text"
            value={goalTimeInput}
            onChange={(event) => {
              setGoalTimeInput(event.target.value);
              persistState();
            }}
            placeholder="h:mm:ss"
            autoComplete="off"
            className={`w-32 ${fieldClass}`}
          />
          {goalTimeSeconds === null && <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">Enter as h:mm:ss, e.g. 3:45:00.</p>}
        </div>
      </div>

      <div>
        <p className={sectionLabelClass}>Course</p>
        <div className={`${statCardClass} space-y-4`}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setCourseSource("upload");
                persistState();
              }}
              aria-pressed={courseSource === "upload"}
              className={segmentedButtonClass(courseSource === "upload")}
            >
              Upload a file
            </button>
            <button
              type="button"
              onClick={() => {
                setCourseSource("preset");
                persistState();
              }}
              aria-pressed={courseSource === "preset"}
              className={segmentedButtonClass(courseSource === "preset")}
            >
              Choose a real race
            </button>
          </div>

          {courseSource === "upload" ? (
            <>
              <RouteImportPanel onRouteLoaded={handleRouteLoaded} />
              {route && (
                <button
                  type="button"
                  onClick={() => {
                    setRoute(null);
                    setRouteLabel(null);
                  }}
                  className="text-xs font-semibold text-zinc-700 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-zinc-200 dark:decoration-white/30 dark:hover:decoration-white"
                >
                  Clear &ldquo;{routeLabel}&rdquo; and use a flat course instead
                </button>
              )}
              {!route && (
                <p className="text-xs text-zinc-600 dark:text-zinc-300">
                  No course loaded -- pacing below assumes a flat marathon. Upload a GPX/TCX/FIT file or import from
                  Strava above for real terrain-aware pacing.
                </p>
              )}
            </>
          ) : (
            <div>
              <label htmlFor={`${baseId}-preset-course`} className={labelClass}>
                Race
              </label>
              <select
                id={`${baseId}-preset-course`}
                value={presetCourseId}
                onChange={(event) => handleSelectPreset(event.target.value as PresetCourseId | "")}
                className={fieldClass}
              >
                <option value="">Select a course…</option>
                {Array.from(PRESET_COURSES_BY_REGION.entries()).map(([region, courses]) => (
                  <optgroup key={region} label={region}>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {presetCourseId ? (
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">{presetCourseMap.get(presetCourseId)!.sourceNote}</p>
              ) : (
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                  These are approximate profiles built from each course&rsquo;s published elevation landmarks, not
                  surveyed GPS data -- close enough for pacing, not a replacement for the official course map.
                </p>
              )}
            </div>
          )}
          {courseError && <p className="text-xs font-semibold text-red-700 dark:text-red-400">{courseError}</p>}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-4">
          <p className={sectionLabelClass}>Conditions (optional)</p>
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setUseConditions(false);
                persistState();
              }}
              aria-pressed={!useConditions}
              className={segmentedButtonClass(!useConditions)}
            >
              Ideal
            </button>
            <button
              type="button"
              onClick={() => {
                setUseConditions(true);
                persistState();
              }}
              aria-pressed={useConditions}
              className={segmentedButtonClass(useConditions)}
            >
              Set conditions
            </button>
          </div>
        </div>
        {useConditions && (
          <div className={`${statCardClass} space-y-4`}>
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              Your goal time is your target effort under ideal conditions. These settings don&rsquo;t change that
              effort or try to force the clock back to your goal -- they show the realistic finish time that effort
              actually produces given the weather, same as a coach would tell you: don&rsquo;t push harder to fight
              the heat, expect to run slower.
            </p>
            <div className="flex flex-wrap items-start gap-6">
              <div>
                <label htmlFor={`${baseId}-temp`} className={labelClass}>
                  Temperature (°F)
                </label>
                <input
                  id={`${baseId}-temp`}
                  type="number"
                  min={-20}
                  max={130}
                  value={tempFInput}
                  onChange={(event) => {
                    setTempFInput(event.target.value);
                    persistState();
                  }}
                  className={`w-20 ${fieldClass}`}
                />
              </div>
              <div>
                <label htmlFor={`${baseId}-humidity`} className={labelClass}>
                  Humidity (%)
                </label>
                <input
                  id={`${baseId}-humidity`}
                  type="number"
                  min={0}
                  max={100}
                  value={humidityInput}
                  onChange={(event) => {
                    setHumidityInput(event.target.value);
                    persistState();
                  }}
                  className={`w-20 ${fieldClass}`}
                />
              </div>
              <div>
                <label htmlFor={`${baseId}-wind`} className={labelClass}>
                  Wind speed (mph)
                </label>
                <input
                  id={`${baseId}-wind`}
                  type="number"
                  min={0}
                  max={80}
                  value={windMphInput}
                  onChange={(event) => {
                    setWindMphInput(event.target.value);
                    persistState();
                  }}
                  className={`w-20 ${fieldClass}`}
                />
              </div>
              <div>
                <p className={labelClass}>Wind from</p>
                <WindCompass
                  angleDeg={windFromDeg}
                  onChange={(deg) => {
                    setWindFromDeg(deg);
                    persistState();
                  }}
                  variant="wind"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <p className={sectionLabelClass}>Strategy</p>
        <div className={`${statCardClass} space-y-4`}>
          <div>
            <p className={labelClass}>Pacing strategy</p>
            <div className="flex flex-wrap gap-2">
              {Object.values(PACING_STRATEGIES).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setStrategyId(s.id);
                    persistState();
                  }}
                  aria-pressed={strategyId === s.id}
                  className={segmentedButtonClass(strategyId === s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">{PACING_STRATEGIES[strategyId].description}</p>
          </div>
          <div>
            <p className={labelClass}>Risk tolerance</p>
            <div className="flex flex-wrap gap-2">
              {RISK_OPTIONS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => {
                    setRisk(r.key);
                    persistState();
                  }}
                  aria-pressed={risk === r.key}
                  className={segmentedButtonClass(risk === r.key)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {!canGeneratePlan && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Enter a recent race performance, age, and marathon goal time above to generate a pacing plan.
        </p>
      )}

      {plan && plan.splits.length > 0 && avgPaceSeconds && (
        <div>
          <p className={sectionLabelClass}>Your pacing plan</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className={heroCardClass}>
              <p className={statLabelClass}>Projected finish (full miles)</p>
              <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-white">{formatClock(displayTotalSeconds ?? plan.totalTimeSeconds)}</p>
              {useConditions && finishDeltaSeconds !== null && Math.abs(finishDeltaSeconds) >= 5 ? (
                <p className="mt-1 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                  {formatClock(Math.abs(finishDeltaSeconds))} {finishDeltaSeconds > 0 ? "slower" : "faster"} than your{" "}
                  {formatClock(goalTimeSeconds ?? 0)}{" "}
                  ideal-conditions goal, because of the conditions you set -- your target effort hasn&rsquo;t
                  changed, just what it produces today.
                </p>
              ) : (
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  Goal: {formatClock(goalTimeSeconds ?? 0)}{" "}
                  -- effort is solved to match this on this course&rsquo;s own terrain, not just computed as if the
                  course were flat. The splits below cover only the full miles shown; the last partial mile beyond
                  that isn&rsquo;t split out separately.
                </p>
              )}
            </div>
            <div className={statCardClass}>
              <p className={statLabelClass}>Average pace</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">{formatClock(avgPaceSeconds)}/mi</p>
            </div>
            <div className={statCardClass}>
              <p className={statLabelClass}>Course</p>
              <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
                {presetCourseId ? `${presetCourseMap.get(presetCourseId)!.name} -- ` : ""}
                {course.totalClimbM > 0 || course.totalDescentM > 0
                  ? `${Math.round(course.totalClimbM * 3.28084)}ft climb / ${Math.round(course.totalDescentM * 3.28084)}ft descent, rolling index ${course.rollingIndex.toFixed(1)}`
                  : "Flat (no course loaded)"}
              </p>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-xs tracking-wide text-zinc-600 uppercase dark:border-white/10 dark:text-zinc-300">
                  <th className="py-2 pr-3">Mile</th>
                  <th className="py-2 pr-3">Pace</th>
                  <th className="py-2 pr-3">Elapsed</th>
                  <th className="py-2 pr-3">Grade</th>
                  <th className="py-2 pr-3">Effort</th>
                  <th className="py-2 pr-3">Glycogen</th>
                  <th className="py-2 pr-3">Durability</th>
                </tr>
              </thead>
              <tbody>
                {plan.splits.map((split: MileSplit, index) => (
                  <tr key={split.mile} className="border-b border-black/5 last:border-0 dark:border-white/5" title={split.explanation}>
                    <td className="py-1.5 pr-3 font-semibold text-zinc-900 dark:text-white">{split.mile}</td>
                    <td className="py-1.5 pr-3">{formatClock(displaySplits[index].displayPaceSecPerMile)}</td>
                    <td className="py-1.5 pr-3">{formatClock(displaySplits[index].displayElapsedSeconds)}</td>
                    <td className="py-1.5 pr-3">{(split.grade * 100).toFixed(1)}%</td>
                    <td className="py-1.5 pr-3">{(split.targetEffortFraction * 100).toFixed(0)}%</td>
                    <td className="py-1.5 pr-3">{(split.fatigueState.glycogenRemainingFraction * 100).toFixed(0)}%</td>
                    <td className="py-1.5 pr-3">{(split.fatigueState.wPrimeBalanceFraction * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
            Paces are rounded to the nearest 5 seconds -- easier to hold in your head than false precision no road
            marathon lets you actually hit anyway. Hover any row for why that mile is paced the way it is.
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <p className={statLabelClass}>Pace &amp; elevation</p>
              <MultiLineChart
                series={[
                  { label: "Pace (faster = lower)", color: "#2563eb", values: plan.splits.map((s) => s.paceSecPerMile) },
                  { label: "Grade", color: "#16a34a", values: plan.splits.map((s) => s.grade) },
                ]}
                xLabels={plan.splits.map((s) => String(s.mile))}
              />
            </div>
            <div>
              <p className={statLabelClass}>Fatigue over the race</p>
              <MultiLineChart
                series={[
                  { label: "Glycogen remaining", color: "#ea580c", values: plan.splits.map((s) => s.fatigueState.glycogenRemainingFraction) },
                  { label: "Durability reserve", color: "#9333ea", values: plan.splits.map((s) => s.fatigueState.wPrimeBalanceFraction) },
                ]}
                xLabels={plan.splits.map((s) => String(s.mile))}
              />
            </div>
          </div>

          {fuelingTargets && fuelingTargets.carbGramsPerHour > 0 && (
            <div className="mt-8">
              <p className={statLabelClass}>Fueling</p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                Target: ~{Math.round(fuelingTargets.carbGramsPerHour)}g carbs, ~{Math.round(fuelingTargets.fluidMlPerHour)}mL fluid, ~
                {Math.round(fuelingTargets.sodiumMgPerHour)}mg sodium per hour.
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-200">
                {fuelingSchedule.map((reminder) => (
                  <li key={reminder.atMile}>
                    Mile {reminder.atMile}: ~{reminder.carbGrams}g carbs, ~{reminder.fluidMl}mL fluid, ~{reminder.sodiumMg}mg sodium
                    {reminder.note ? ` -- ${reminder.note}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <SaveCalculationButton
            calculatorType="marathon-pacing-calculator"
            input={{ fitnessDistanceKey, fitnessTimeInput, ageInput, goalTimeInput, strategyId, risk, durability }}
            output={{ projectedTime: formatClock(displayTotalSeconds ?? plan.totalTimeSeconds), avgPace: `${formatClock(avgPaceSeconds)}/mi` }}
            label={`${goalTimeInput} marathon, ${PACING_STRATEGIES[strategyId].label}`}
          />
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => {
            setShowMethodology((value) => !value);
            persistState();
          }}
          aria-expanded={showMethodology}
          className="flex items-center gap-2 py-1 text-lg font-semibold text-zinc-900 dark:text-white"
        >
          Behind the calculator: how this differs from a typical pace band
          <span aria-hidden="true" className="text-sm font-normal">
            {showMethodology ? "↑" : "↓"}
          </span>
        </button>
        {showMethodology && (
          <div className="mt-4 max-w-[64ch] space-y-2">
            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span aria-hidden="true" className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400">
                  ▶
                </span>
                Effort, not a preset pace table
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Every strategy here is a target <em>effort</em> curve (a fraction of your critical speed, over the
                  course of the race) rather than a table of preset pace deltas. That effort is converted into an
                  actual pace mile by mile using the real energy cost of that mile&rsquo;s grade (Minetti et al.
                  2002) -- so two runners on the same strategy get genuinely different splits on different courses,
                  rather than the same canned shape stretched to fit any race. The target effort itself is solved
                  for terrain, not assumed: on a course with meaningful net elevation change (Boston&rsquo;s
                  net-downhill course is a good example), running the effort that would hit your goal time on a flat
                  course actually finishes faster or slower than goal, so the effort is adjusted until the
                  terrain-adjusted total genuinely matches your goal time -- terrain is a fixed property of the
                  course, so it&rsquo;s fair to fold into what hitting your goal on this course even means. Wind and
                  heat/humidity are handled differently, deliberately: they&rsquo;re layered on top of that
                  already-solved effort rather than solved for, so setting hot or windy conditions shows you a
                  realistic finish time that can be slower (or faster) than your goal, instead of quietly demanding
                  more effort to force the clock back to an unchanged number.
                </p>
              </div>
            </details>
            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span aria-hidden="true" className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400">
                  ▶
                </span>
                Fatigue is tracked, not assumed away
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Glycogen remaining, a W&rsquo;-balance-style durability reserve (the same model sports scientists
                  use for critical-power pacing, adapted here to critical speed), and cumulative eccentric
                  (downhill) load are all tracked mile by mile from your own critical speed, size, and durability
                  rating -- not a fixed mile-20 slowdown applied to every runner regardless of fitness or the
                  course.
                </p>
              </div>
            </details>
            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span aria-hidden="true" className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400">
                  ▶
                </span>
                Limitations
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  The final partial mile isn&rsquo;t included in the projected finish time above -- only full miles
                  are split. Glycogen store size, cardiac drift, and eccentric-damage numbers are reasoned estimates
                  from published exercise-physiology ranges, not individually measured for you; treat them as
                  directionally useful, not lab-precise. Critical speed and vVO2max come from the same statistical
                  model behind the{" "}
                  <Link href="/cv-threshold-calculator" className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white">
                    Threshold/CV/VO2max Calculator
                  </Link>
                  , so its own domain and limitations apply here too.
                </p>
              </div>
            </details>
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Want the training paces behind your critical speed number on their own? See the{" "}
        <Link href="/cv-threshold-calculator" className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white">
          Threshold/CV/VO2max Calculator
        </Link>
        . For the physics behind grade and wind adjustments on their own, see the{" "}
        <Link href="/gap-calculator" className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white">
          GAP Calculator
        </Link>{" "}
        and the{" "}
        <Link href="/environmental-calculator" className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white">
          Environmental Performance Calculator
        </Link>
        .
      </p>
    </div>
  );
}
