"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";

import { RouteImportPanel } from "@/components/route-import-panel";
import { SaveCalculationButton } from "@/components/save-calculation-button";
import { Button } from "@/components/ui/button";
import { LabeledInput } from "@/components/ui/labeled-input";
import { analyzeCourse, type CourseAnalysis } from "@/lib/marathon-pacing/course-analysis";
import { evaluateConditions, type ConditionsInput } from "@/lib/race-pace-planner/conditions";
import { buildFuelingSchedule } from "@/lib/race-pace-planner/fueling-plan";
import {
  averageHillImpactSecPerMile,
  buildCheckpoints,
  buildRacePacePlan,
  formatPace,
  MARATHON_MILES,
  perMileNetGradeFtFromCourseAnalysis,
  type PlanMile,
  type RaceClimb,
  type StartStrategy,
} from "@/lib/race-pace-planner/pace-plan";
import { fieldClass, labelClass } from "@/lib/form-styles";
import type { ParsedRoute } from "@/lib/route-import/types";
import type { RouteSummary } from "@/lib/route-import/route-summary";
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

const STORAGE_KEY = "haarchive-race-pace-planner-state";
const DEFAULT_CLIMB: RaceClimb = { atMile: 10, lengthMiles: 1, feet: 150, direction: "climb" };

type CourseMode = "gps" | "manual";

type PersistedState = {
  goalTimeInput: string;
  strategy: StartStrategy;
  courseMode: CourseMode;
  totalGainFtInput: string;
  totalLossFtInput: string;
  climbs: RaceClimb[];
  useConditions: boolean;
  tempFInput: string;
  humidityInput: string;
  windMphInput: string;
  altitudeDiffFtInput: string;
  carbRateInput: string;
  gelGramsInput: string;
  caffeineEnabled: boolean;
};

const EFFORT_TONE: Record<PlanMile["effort"], string> = {
  Relaxed: "text-zinc-600 dark:text-zinc-300",
  "Settling in": "text-zinc-700 dark:text-zinc-200",
  "Marathon effort": "text-zinc-900 dark:text-white",
  "Comfortably hard": "text-amber-700 dark:text-amber-400",
  "Strong finish": "text-emerald-700 dark:text-emerald-400",
};

// A race-day planner that turns a goal pace, the course's hills, and
// expected conditions into a mile-by-mile plan, a fueling schedule, and
// segment-by-segment mental strategy -- the "what do I actually do on
// race day" layer, not a fitness-prediction model. Course data comes from
// either of two input modes: an imported GPS route (GPX/TCX/FIT or
// Strava, elevation extracted automatically via course-analysis.ts) or a
// quick manual course-map entry (total gain/loss plus a few named
// climbs/descents, flat assumed elsewhere). Both modes feed the exact
// same pacing model -- see pace-plan.ts's own module doc.
export function RacePacePlanner() {
  const baseId = useId();
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const [goalTimeInput, setGoalTimeInput] = usePersistedField(persisted?.goalTimeInput, "3:45:00");
  const [strategy, setStrategy] = usePersistedField<StartStrategy>(persisted?.strategy, "progressive");
  const [courseMode, setCourseMode] = usePersistedField<CourseMode>(persisted?.courseMode, "manual");
  const [totalGainFtInput, setTotalGainFtInput] = usePersistedField(persisted?.totalGainFtInput, "0");
  const [totalLossFtInput, setTotalLossFtInput] = usePersistedField(persisted?.totalLossFtInput, "0");
  const [climbs, setClimbs] = usePersistedField<RaceClimb[]>(persisted?.climbs, []);

  // The parsed GPS route itself is deliberately not persisted (same
  // precedent as the Environmental Calculator's own route state) --
  // re-importing a file is quick, and a route's full point data is too
  // large to round-trip through localStorage. `routeNotice` surfaces when
  // a loaded route couldn't be analyzed (e.g. too few GPS points) --
  // handled by falling back to manual mode with a notice, never by
  // crashing.
  const [routeLabel, setRouteLabel] = useState<string | null>(null);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [courseAnalysis, setCourseAnalysis] = useState<CourseAnalysis | null>(null);
  const [routeNotice, setRouteNotice] = useState<string | null>(null);

  function handleRouteLoaded(summary: RouteSummary, label: string, route: ParsedRoute) {
    try {
      const analysis = analyzeCourse(route);
      setRouteSummary(summary);
      setRouteLabel(label);
      setCourseAnalysis(analysis);
      setRouteNotice(null);
    } catch (error) {
      // A route with too few usable GPS/elevation points to analyze --
      // fall back to manual entry rather than leaving the tool stuck with
      // no usable course data (or, worse, crashing on a malformed file).
      setRouteSummary(null);
      setRouteLabel(null);
      setCourseAnalysis(null);
      setCourseMode("manual");
      setRouteNotice(
        `Couldn't read the elevation from ${label} (${error instanceof Error ? error.message : "unknown error"}) -- switched to manual course entry instead.`,
      );
    }
  }

  const [useConditions, setUseConditions] = usePersistedField(persisted?.useConditions, false);
  const [tempFInput, setTempFInput] = usePersistedField(persisted?.tempFInput, "55");
  const [humidityInput, setHumidityInput] = usePersistedField(persisted?.humidityInput, "50");
  const [windMphInput, setWindMphInput] = usePersistedField(persisted?.windMphInput, "5");
  const [altitudeDiffFtInput, setAltitudeDiffFtInput] = usePersistedField(persisted?.altitudeDiffFtInput, "0");

  const [carbRateInput, setCarbRateInput] = usePersistedField(persisted?.carbRateInput, "60");
  const [gelGramsInput, setGelGramsInput] = usePersistedField(persisted?.gelGramsInput, "25");
  const [caffeineEnabled, setCaffeineEnabled] = usePersistedField(persisted?.caffeineEnabled, false);

  function persistState() {
    try {
      const state: PersistedState = {
        goalTimeInput,
        strategy,
        courseMode,
        totalGainFtInput,
        totalLossFtInput,
        climbs,
        useConditions,
        tempFInput,
        humidityInput,
        windMphInput,
        altitudeDiffFtInput,
        carbRateInput,
        gelGramsInput,
        caffeineEnabled,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage (e.g. private browsing).
    }
  }

  function updateClimb(index: number, patch: Partial<RaceClimb>) {
    setClimbs(climbs.map((climb, i) => (i === index ? { ...climb, ...patch } : climb)));
    persistState();
  }

  function addClimb() {
    setClimbs([...climbs, { ...DEFAULT_CLIMB }]);
    persistState();
  }

  function removeClimb(index: number) {
    setClimbs(climbs.filter((_, i) => i !== index));
    persistState();
  }

  const goalTimeSeconds = parseTimeToSeconds(goalTimeInput);
  const totalGainFt = Number(totalGainFtInput);
  const totalLossFt = Number(totalLossFtInput);
  const manualCourseValid = Number.isFinite(totalGainFt) && Number.isFinite(totalLossFt);

  const courseValid = courseMode === "gps" ? courseAnalysis !== null : manualCourseValid;
  const canGeneratePlan = goalTimeSeconds !== null && goalTimeSeconds > 0 && courseValid;

  const plan =
    canGeneratePlan && courseMode === "gps" && courseAnalysis
      ? buildRacePacePlan(goalTimeSeconds!, strategy, {
          totalGainFt: Math.round(courseAnalysis.totalClimbM * 3.28084),
          totalLossFt: Math.round(courseAnalysis.totalDescentM * 3.28084),
          climbs: [],
          perMileNetGradeFt: perMileNetGradeFtFromCourseAnalysis(courseAnalysis),
        })
      : canGeneratePlan && courseMode === "manual"
        ? buildRacePacePlan(goalTimeSeconds!, strategy, {
            totalGainFt: Math.max(0, totalGainFt),
            totalLossFt: Math.max(0, totalLossFt),
            climbs,
          })
        : null;

  const checkpoints = plan ? buildCheckpoints(plan) : [];
  const hillImpact = plan ? averageHillImpactSecPerMile(plan) : 0;

  const tempFRaw = Number(tempFInput);
  const humidityRaw = Number(humidityInput);
  const windMphRaw = Number(windMphInput);
  const altitudeDiffFtRaw = Number(altitudeDiffFtInput);
  const conditionsValid =
    Number.isFinite(tempFRaw) && Number.isFinite(humidityRaw) && Number.isFinite(windMphRaw) && Number.isFinite(altitudeDiffFtRaw);
  const conditionsInput: ConditionsInput = {
    tempF: tempFRaw,
    humidityPct: humidityRaw,
    windMph: windMphRaw,
    altitudeDiffFt: altitudeDiffFtRaw,
  };
  const conditionFlags = useConditions && conditionsValid ? evaluateConditions(conditionsInput) : [];

  const carbRateRaw = Number(carbRateInput);
  const gelGramsRaw = Number(gelGramsInput);
  const fuelingValid = Number.isFinite(carbRateRaw) && carbRateRaw > 0 && Number.isFinite(gelGramsRaw) && gelGramsRaw > 0;
  const fuelingSchedule = plan && fuelingValid
    ? buildFuelingSchedule(plan, { carbGramsPerHour: carbRateRaw, gelCarbGrams: gelGramsRaw, caffeineEnabled })
    : null;

  return (
    <div className="mt-10 space-y-10">
      <div>
        <p className={sectionLabelClass}>Goal</p>
        <div className={`${statCardClass} space-y-4`}>
          <div className="flex flex-wrap items-end gap-4">
            <LabeledInput
              id={`${baseId}-goal-time`}
              label="Goal marathon time"
              type="text"
              value={goalTimeInput}
              onChange={(event) => {
                setGoalTimeInput(event.target.value);
                persistState();
              }}
              placeholder="h:mm:ss"
              autoComplete="off"
              className="w-32"
            />
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            Use your honest current-fitness estimate here, a range is fine, not a number you hope race day magic
            will deliver. Need help landing on one? The{" "}
            <Link
              href="/cv-threshold-calculator"
              className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
            >
              Threshold, CV &amp; VO2 Max Pace Calculator
            </Link>{" "}
            can help you get there from a recent race.
          </p>
          <div>
            <p className={labelClass}>Start strategy</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStrategy("progressive");
                  persistState();
                }}
                aria-pressed={strategy === "progressive"}
                className={segmentedButtonClass(strategy === "progressive")}
              >
                Progressive (recommended)
              </button>
              <button
                type="button"
                onClick={() => {
                  setStrategy("even");
                  persistState();
                }}
                aria-pressed={strategy === "even"}
                className={segmentedButtonClass(strategy === "even")}
              >
                Even
              </button>
            </div>
            <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
              {strategy === "progressive"
                ? "Opens a bit slower than goal pace and converges by mile 5 -- a buffer against a too-fast start, the most common way a marathon goes wrong."
                : "Holds goal pace from mile 1 -- a reasonable choice if you've already practiced even pacing in training and trust your own restraint."}
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className={sectionLabelClass}>Course</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setCourseMode("gps");
              persistState();
            }}
            aria-pressed={courseMode === "gps"}
            className={segmentedButtonClass(courseMode === "gps")}
          >
            GPS route
          </button>
          <button
            type="button"
            onClick={() => {
              setCourseMode("manual");
              persistState();
            }}
            aria-pressed={courseMode === "manual"}
            className={segmentedButtonClass(courseMode === "manual")}
          >
            Course map (manual)
          </button>
        </div>
        <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
          {courseMode === "gps"
            ? "Upload a GPX, TCX, or FIT file (or import from Strava) and this plan uses the route's own real per-mile elevation -- no hill-naming required."
            : "The quick path: enter total gain/loss and name only the hills big enough to actually matter, flat is assumed everywhere else."}
        </p>

        {routeNotice && (
          <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">{routeNotice}</p>
        )}

        {courseMode === "gps" ? (
          <div className={`${statCardClass} mt-3 space-y-4`}>
            <RouteImportPanel onRouteLoaded={handleRouteLoaded} />
            {!courseAnalysis && (
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                No route loaded yet -- a plan needs a course to adjust for, upload one above or switch to manual
                entry.
              </p>
            )}
            {courseAnalysis && (
              <div>
                <p className={labelClass}>
                  Parsed elevation profile{routeLabel ? ` -- ${routeLabel}` : ""}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className={statCardClass}>
                    <p className={statLabelClass}>Distance</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                      {(routeSummary!.totalDistanceM / 1609.344).toFixed(1)} mi
                    </p>
                  </div>
                  <div className={statCardClass}>
                    <p className={statLabelClass}>Total gain</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                      {Math.round(courseAnalysis.totalClimbM * 3.28084)} ft
                    </p>
                  </div>
                  <div className={statCardClass}>
                    <p className={statLabelClass}>Total loss</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                      {Math.round(courseAnalysis.totalDescentM * 3.28084)} ft
                    </p>
                  </div>
                  <div className={statCardClass}>
                    <p className={statLabelClass}>Miles analyzed</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                      {Math.min(MARATHON_MILES, courseAnalysis.perMileGrade.length)} / {MARATHON_MILES}
                    </p>
                  </div>
                </div>
                {courseAnalysis.perMileGrade.length < MARATHON_MILES && (
                  <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                    This route is shorter than a full marathon -- miles beyond mile{" "}
                    {courseAnalysis.perMileGrade.length} are assumed flat.
                  </p>
                )}
                <p className="mt-2 mb-1 text-xs text-zinc-600 dark:text-zinc-300">
                  Confirm this looks right before generating a plan from it:
                </p>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-black/10 dark:border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface sticky top-0">
                      <tr className="border-b border-black/10 text-zinc-600 uppercase dark:border-white/10 dark:text-zinc-300">
                        <th className="py-1.5 pr-3 pl-3">Mile</th>
                        <th className="py-1.5 pr-3">Net grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perMileNetGradeFtFromCourseAnalysis(courseAnalysis).map((netFt, i) => (
                        <tr key={i} className="border-b border-black/5 last:border-0 dark:border-white/5">
                          <td className="py-1 pr-3 pl-3 font-semibold text-zinc-900 dark:text-white">{i + 1}</td>
                          <td className="py-1 pr-3 tabular-nums">
                            {netFt === 0 ? "flat" : `${netFt > 0 ? "+" : ""}${Math.round(netFt)} ft`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={`${statCardClass} mt-3 space-y-4`}>
            <div className="flex flex-wrap gap-4">
              <LabeledInput
                id={`${baseId}-gain`}
                label="Total elevation gain (ft)"
                type="number"
                inputMode="decimal"
                min={0}
                value={totalGainFtInput}
                onChange={(event) => {
                  setTotalGainFtInput(event.target.value);
                  persistState();
                }}
                className="w-32"
              />
              <LabeledInput
                id={`${baseId}-loss`}
                label="Total elevation loss (ft)"
                type="number"
                inputMode="decimal"
                min={0}
                value={totalLossFtInput}
                onChange={(event) => {
                  setTotalLossFtInput(event.target.value);
                  persistState();
                }}
                className="w-32"
              />
            </div>

            <div>
              <p className={labelClass}>Notable climbs &amp; descents</p>
              <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-300">
                Only the hills big enough to actually change your pacing -- a net change of 15ft/mi or less is
                roughly 5 seconds of noise and gets ignored. This can&rsquo;t discover a short, steep hill in the
                middle of a mile you haven&rsquo;t named here; switch to GPS route above for that level of
                precision from an actual course file.
              </p>
              <div className="space-y-3">
                {climbs.map((climb, index) => (
                  <div key={index} className="flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-3 dark:border-white/10">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateClimb(index, { direction: "climb" })}
                        aria-pressed={climb.direction === "climb"}
                        className={segmentedButtonClass(climb.direction === "climb")}
                      >
                        Climb
                      </button>
                      <button
                        type="button"
                        onClick={() => updateClimb(index, { direction: "descent" })}
                        aria-pressed={climb.direction === "descent"}
                        className={segmentedButtonClass(climb.direction === "descent")}
                      >
                        Descent
                      </button>
                    </div>
                    <div>
                      <label htmlFor={`${baseId}-climb-${index}-mile`} className={labelClass}>
                        At mile
                      </label>
                      <input
                        id={`${baseId}-climb-${index}-mile`}
                        type="number"
                        inputMode="decimal"
                        min={1}
                        max={26}
                        value={climb.atMile}
                        onChange={(event) => updateClimb(index, { atMile: Number(event.target.value) })}
                        className={`w-20 ${fieldClass}`}
                      />
                    </div>
                    <div>
                      <label htmlFor={`${baseId}-climb-${index}-length`} className={labelClass}>
                        Length (mi)
                      </label>
                      <input
                        id={`${baseId}-climb-${index}-length`}
                        type="number"
                        inputMode="decimal"
                        min={0.1}
                        step={0.1}
                        value={climb.lengthMiles}
                        onChange={(event) => updateClimb(index, { lengthMiles: Number(event.target.value) })}
                        className={`w-20 ${fieldClass}`}
                      />
                    </div>
                    <div>
                      <label htmlFor={`${baseId}-climb-${index}-feet`} className={labelClass}>
                        Elevation change (ft)
                      </label>
                      <input
                        id={`${baseId}-climb-${index}-feet`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={climb.feet}
                        onChange={(event) => updateClimb(index, { feet: Number(event.target.value) })}
                        className={`w-24 ${fieldClass}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeClimb(index)}
                      aria-label={`Remove climb at mile ${climb.atMile}`}
                      className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-black/5 hover:text-red-700 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={addClimb}>
                + Add a climb or descent
              </Button>
            </div>
          </div>
        )}
      </div>

      <div>
        <p className={sectionLabelClass}>Expected conditions</p>
        <div className="flex gap-2">
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
        {useConditions && (
          <div className={`${statCardClass} mt-3 space-y-4`}>
            <div className="flex flex-wrap gap-4">
              <LabeledInput
                id={`${baseId}-temp`}
                label="Temperature (°F)"
                type="number"
                inputMode="decimal"
                value={tempFInput}
                onChange={(event) => {
                  setTempFInput(event.target.value);
                  persistState();
                }}
                className="w-24"
              />
              <LabeledInput
                id={`${baseId}-humidity`}
                label="Humidity (%)"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                value={humidityInput}
                onChange={(event) => {
                  setHumidityInput(event.target.value);
                  persistState();
                }}
                className="w-24"
              />
              <LabeledInput
                id={`${baseId}-wind`}
                label="Wind (mph)"
                type="number"
                inputMode="decimal"
                min={0}
                value={windMphInput}
                onChange={(event) => {
                  setWindMphInput(event.target.value);
                  persistState();
                }}
                className="w-24"
              />
              <LabeledInput
                id={`${baseId}-altitude`}
                label="Race altitude vs. training (ft)"
                type="number"
                inputMode="decimal"
                value={altitudeDiffFtInput}
                onChange={(event) => {
                  setAltitudeDiffFtInput(event.target.value);
                  persistState();
                }}
                className="w-32"
              />
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              These are estimates to help you plan, not precise time corrections -- for that level of precision, see
              the{" "}
              <Link
                href="/environmental-calculator"
                className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
              >
                Environmental Performance Calculator
              </Link>
              .
            </p>
            {conditionFlags.length > 0 && (
              <div className="space-y-2">
                {conditionFlags.map((flag, i) => (
                  <p key={i} className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
                    {flag.note}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!canGeneratePlan && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {goalTimeSeconds === null || goalTimeSeconds <= 0
            ? "Enter a valid goal marathon time to generate a plan."
            : "Upload a GPS route above to generate a plan."}
        </p>
      )}

      {plan && (
        <>
          <div>
            <p className={sectionLabelClass}>Big picture (don&rsquo;t memorize the splits)</p>
            <div className={heroCardClass}>
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                {strategy === "progressive"
                  ? `Open relaxed, around ${formatPace(plan.miles[0].flatPaceSecPerMile)}, and let it come down to your real goal pace of ${formatPace(plan.goalPaceSecPerMile)} by mile 5.`
                  : `Settle into your goal pace of ${formatPace(plan.goalPaceSecPerMile)} from the first mile and hold it.`}{" "}
                Cruise there through the middle of the race, then shift gears for your final push starting around
                mile {plan.finishKickStartMile}
                {" -- "}that&rsquo;s where this plan asks for strength and intensity, not just steady effort.
                {hillImpact !== 0 && (
                  <>
                    {" "}
                    The hills you&rsquo;ve named here swing your pace by roughly {Math.round(Math.abs(hillImpact))}
                    {" seconds/mile on average when you hit them -- expect that, don’t fight it."}
                  </>
                )}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {checkpoints.map((checkpoint) => (
                  <div key={checkpoint.label} className={statCardClass}>
                    <p className={statLabelClass}>{checkpoint.label}</p>
                    <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">
                      {formatClock(Math.round(checkpoint.elapsedSeconds))}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
                Projected finish: {formatClock(Math.round(plan.totalElapsedSeconds))}
                {" (full miles only -- the last partial 0.2mi isn’t split out separately)."}
              </p>
            </div>
          </div>

          <div>
            <p className={sectionLabelClass}>Mile-by-mile plan</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-xs tracking-wide text-zinc-600 uppercase dark:border-white/10 dark:text-zinc-300">
                    <th className="py-2 pr-3">Mile</th>
                    <th className="py-2 pr-3">Watch pace</th>
                    <th className="py-2 pr-3">Elapsed</th>
                    <th className="py-2 pr-3">Effort</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.miles.map((mile) => (
                    <tr key={mile.mile} className="border-b border-black/5 last:border-0 dark:border-white/5">
                      <td className="py-1.5 pr-3 font-semibold text-zinc-900 dark:text-white">{mile.mile}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{formatPace(mile.watchPaceSecPerMile)}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{formatClock(Math.round(mile.elapsedSeconds))}</td>
                      <td className={`py-1.5 pr-3 font-medium ${EFFORT_TONE[mile.effort]}`}>{mile.effort}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
              Watch pace already includes the grade adjustment for any climb or descent you named above. Effort is
              what that mile should feel like, not just what the watch says -- a climb mile is marked
              &ldquo;Comfortably hard&rdquo; even though the pace already slowed for it, because the point of grade
              adjustment is to keep effort level, not the number on your wrist.
            </p>

            <SaveCalculationButton
              calculatorType="race-pace-planner"
              input={{ goalTimeInput, strategy, courseMode, totalGainFtInput, totalLossFtInput, climbs }}
              output={{ projectedFinish: formatClock(Math.round(plan.totalElapsedSeconds)) }}
              label={`${goalTimeInput} marathon, ${strategy} start`}
            />
          </div>

          <div>
            <p className={sectionLabelClass}>Fueling schedule</p>
            <div className={`${statCardClass} space-y-4`}>
              <div className="flex flex-wrap gap-4">
                <LabeledInput
                  id={`${baseId}-carb-rate`}
                  label="Target carb rate (g/hr)"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  value={carbRateInput}
                  onChange={(event) => {
                    setCarbRateInput(event.target.value);
                    persistState();
                  }}
                  className="w-24"
                />
                <LabeledInput
                  id={`${baseId}-gel-grams`}
                  label="Gel carb content (g)"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  value={gelGramsInput}
                  onChange={(event) => {
                    setGelGramsInput(event.target.value);
                    persistState();
                  }}
                  className="w-24"
                />
                <div>
                  <p className={labelClass}>Caffeine</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCaffeineEnabled(false);
                        persistState();
                      }}
                      aria-pressed={!caffeineEnabled}
                      className={segmentedButtonClass(!caffeineEnabled)}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCaffeineEnabled(true);
                        persistState();
                      }}
                      aria-pressed={caffeineEnabled}
                      className={segmentedButtonClass(caffeineEnabled)}
                    >
                      Yes
                    </button>
                  </div>
                </div>
              </div>

              {fuelingSchedule && (
                <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-200">
                  <p>
                    Pre-race gel: ~{fuelingSchedule.preRaceGel.minutesBeforeStart} minutes before the start.
                  </p>
                  <ul className="space-y-1.5">
                    {fuelingSchedule.gels.map((gel) => (
                      <li key={gel.atMinute}>
                        ~Mile {gel.nearMile} ({gel.atMinute} min): {gel.note}
                        {gel.optional ? " -- optional, skip if your stomach's iffy this late" : ""}
                      </li>
                    ))}
                  </ul>
                  {fuelingSchedule.mouthRinseInsteadOfFinalGel && (
                    <p>
                      In the last stretch of the race, too close to the finish for another gel to help, swish a
                      carbohydrate drink and spit it out instead -- a real, smaller benefit from the mouth sensing
                      carbs, without the gut having to process anything this late.
                    </p>
                  )}
                  {fuelingSchedule.caffeine && (
                    <p>
                      Caffeine: {fuelingSchedule.caffeine.firstDoseMg}mg 45-60 minutes before the start, then another{" "}
                      {fuelingSchedule.caffeine.secondDoseMg}mg around {fuelingSchedule.caffeine.secondDoseAtMinute}{" "}
                      minutes into the race. Nothing in the final hour -- it won&rsquo;t take effect in time to help.
                    </p>
                  )}
                  <p>
                    Hydration: drink to thirst at aid stations, not a fixed schedule -- don&rsquo;t try to fully
                    replace what you&rsquo;re sweating out, that&rsquo;s neither necessary nor realistic mid-race.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <p className={sectionLabelClass}>Race-day strategy, segment by segment</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={statCardClass}>
                <p className={statLabelClass}>Opening miles</p>
                <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-200">
                  Stay relaxed and let your pace converge toward target -- the race is long, and nothing worth
                  winning happens in the first mile.
                </p>
              </div>
              <div className={statCardClass}>
                <p className={statLabelClass}>Middle miles</p>
                <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-200">
                  Click off the miles smoothly. Spot-check your pace every couple of miles rather than staring at
                  your watch constantly -- trust the plan between checks.
                </p>
              </div>
              <div className={statCardClass}>
                <p className={statLabelClass}>Final miles</p>
                <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-200">
                  Shift from relaxation to strength and intensity. Push toward your limit without tipping into the
                  abyss -- there&rsquo;s a real difference between running hard and running yourself into the wall.
                </p>
              </div>
              <div className={statCardClass}>
                <p className={statLabelClass}>The finish</p>
                <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-200">
                  Build momentum rather than just surviving. Don&rsquo;t lose speed drifting wide through turns or
                  weaving traffic, and save a real kick for the last 400-800m.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="space-y-2">
        <details className={detailsClass}>
          <summary className={summaryClass}>
            <span
              aria-hidden="true"
              className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
            >
              ▶
            </span>
            Honest caveats
          </summary>
          <div className={detailsBodyClass}>
            <p>
              Your goal pace should reflect your actual current fitness, a range is a perfectly reasonable input,
              not a number you&rsquo;re hoping race-day magic delivers. In manual course-map mode, this plan
              can&rsquo;t discover a hill you didn&rsquo;t name -- switch to GPS route mode above if you have a
              file for the course. Either way, the grade adjustment itself is a widely-used rule of thumb, not a
              fitted physical model; for precise grade-adjusted pace on its own, see the{" "}
              <Link
                href="/gap-calculator"
                className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
              >
                GAP Calculator
              </Link>
              . Most importantly: the plan bends. Something will go wrong on race day, a bathroom stop, a bad patch,
              weather that didn&rsquo;t match the forecast, and the right response is to deal with it and return to
              the plan, not to abandon it over one rough mile.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
