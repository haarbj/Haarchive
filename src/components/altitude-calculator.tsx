"use client";

import { useEffect, useId } from "react";
import Link from "next/link";
import { AlertTriangle, Calculator, Dna, Gauge, Mountain, Sigma } from "lucide-react";

import { ContentCallout } from "@/components/content-callout";
import { SaveCalculationButton } from "@/components/save-calculation-button";
import {
  type AltitudeConversionInput,
  convertPerformanceBetweenAltitudes,
} from "@/lib/altitude-adjusted-pace-math";
import {
  resolveHomeAltitudeKm,
  resolveTargetAltitudeKm,
  type HomeAltitudeMode,
  type TargetAltitudeMode,
} from "@/lib/altitude-calculator-shared";
import {
  type AcclimatizationState,
  type AltitudeUnit,
  MAX_ALTITUDE_FT,
  MAX_ALTITUDE_KM,
  MIN_ALTITUDE_FT,
  altitudeToKm,
  capacityPercentAtAltitude,
  convertTimeBetweenAltitudes,
  convertVo2MaxBetweenAltitudes,
  convertWorkoutSplits,
  isAltitudeInModelDomain,
  kmToAltitude,
  kmToMeters,
  parseWorkoutSplitsInput,
} from "@/lib/altitude-vo2max-math";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { PACE_UNIT_LABEL, PACE_UNIT_METERS, type PaceUnit, formatPaceOutput, parsePaceInput } from "@/lib/pace-percent-math";
import { RACE_DISTANCES, raceDistanceMap } from "@/lib/race-distances";
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

const STORAGE_KEY = "haarchive-altitude-calculator-state";
const ALTITUDE_UNIT_LABEL: Record<AltitudeUnit, string> = { ft: "ft", m: "m" };

type ConversionMode = "vo2max" | "performance";
type RunMode = "pace" | "time" | "splits";

// Davis's own stated caution thresholds (see
// docs/altitude-adjusted-pace-reverse-engineering-report.md) -- surfaced
// here specifically around the second-model card below, since they're
// about that model's own fitted range, not the Bassett/Péronnet or
// Daniels-table models above it.
const EXTRAPOLATION_DISTANCE_METERS = 10000;
const HIGH_ALTITUDE_FT = 8000;

type PersistedState = {
  mode: ConversionMode;
  altitudeUnit: AltitudeUnit;
  altitudeInput: string;
  acclimatization: AcclimatizationState;
  homeMode: HomeAltitudeMode;
  homeAltitudeInput: string;
  targetMode: TargetAltitudeMode;
  targetAltitudeInput: string;
  vo2MaxInput: string;
  runMode: RunMode;
  useCustomDistance: boolean;
  runDistanceKey: string;
  customDistanceInput: string;
  runPaceInput: string;
  runPaceUnit: PaceUnit;
  runTimeInput: string;
  splitRepeatUnit: PaceUnit;
  splitsInput: string;
  showMethodology: boolean;
};

function formatAltitude(value: number, unit: AltitudeUnit): string {
  return `${Math.round(value).toLocaleString()} ${ALTITUDE_UNIT_LABEL[unit]}`;
}

// Unifies what were two separate tools (/altitude-calculator and
// /altitude-adjusted-pace-calculator) behind one mode toggle, with the
// elevation/acclimation inputs entered once and shared by both modes.
//
// The two tools' performance-conversion math was deliberately NOT merged
// into one model, even though both answer "what does this performance
// convert to at another altitude": VO2max mode uses acclimatization-aware
// population regressions (Bassett et al. 1999; Péronnet et al. 1991),
// since nothing else on the site models acclimatization at all. Performance
// mode's PRIMARY result reuses the Environmental Performance Calculator's
// own altitude-engine.ts (Jack Daniels' altitude tables, duration-scaled)
// directly -- the same functions, not a second independently-sourced model
// -- so this tool agrees with the Environmental Performance Calculator and
// Marathon Pacing Calculator on what a given altitude costs a given run.
// Performance mode ALSO shows a SECOND, independently-derived result from
// the exact model the old /altitude-adjusted-pace-calculator page used
// (John J. Davis's reverse-engineered Running Writings model) for the same
// inputs, rather than discarding it -- the two sources answer a related
// question from genuinely different evidence (a citable population
// regression vs. a third party's own undisclosed, black-box-fit model),
// and nothing here silently picks a winner between them. See
// lib/altitude-vo2max-math.ts and lib/altitude-adjusted-pace-math.ts for
// the full reasoning and citations behind each.
export function AltitudeCalculator() {
  const baseId = useId();
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const [mode, setMode] = usePersistedField<ConversionMode>(persisted?.mode, "vo2max");
  const [altitudeUnit, setAltitudeUnit] = usePersistedField<AltitudeUnit>(persisted?.altitudeUnit, "ft");
  const [altitudeInput, setAltitudeInput] = usePersistedField(persisted?.altitudeInput, "7000");
  const [acclimatization, setAcclimatization] = usePersistedField<AcclimatizationState>(
    persisted?.acclimatization,
    "acclimatized",
  );
  const [homeMode, setHomeMode] = usePersistedField<HomeAltitudeMode>(persisted?.homeMode, "sea");
  const [homeAltitudeInput, setHomeAltitudeInput] = usePersistedField(persisted?.homeAltitudeInput, "");
  const [targetMode, setTargetMode] = usePersistedField<TargetAltitudeMode>(persisted?.targetMode, "none");
  const [targetAltitudeInput, setTargetAltitudeInput] = usePersistedField(persisted?.targetAltitudeInput, "");
  const [vo2MaxInput, setVo2MaxInput] = usePersistedField(persisted?.vo2MaxInput, "");
  const [runMode, setRunMode] = usePersistedField<RunMode>(persisted?.runMode, "pace");
  const [useCustomDistance, setUseCustomDistance] = usePersistedField(persisted?.useCustomDistance, false);
  const [runDistanceKey, setRunDistanceKey] = usePersistedField(persisted?.runDistanceKey, "5k");
  const [customDistanceInput, setCustomDistanceInput] = usePersistedField(persisted?.customDistanceInput, "5000");
  const [runPaceInput, setRunPaceInput] = usePersistedField(persisted?.runPaceInput, "");
  const [runPaceUnit, setRunPaceUnit] = usePersistedField<PaceUnit>(persisted?.runPaceUnit, "mi");
  const [runTimeInput, setRunTimeInput] = usePersistedField(persisted?.runTimeInput, "");
  const [splitRepeatUnit, setSplitRepeatUnit] = usePersistedField<PaceUnit>(persisted?.splitRepeatUnit, "mi");
  const [splitsInput, setSplitsInput] = usePersistedField(persisted?.splitsInput, "");
  const [showMethodology, setShowMethodology] = usePersistedField(persisted?.showMethodology, false);

  useEffect(() => {
    try {
      const state: PersistedState = {
        mode,
        altitudeUnit,
        altitudeInput,
        acclimatization,
        homeMode,
        homeAltitudeInput,
        targetMode,
        targetAltitudeInput,
        vo2MaxInput,
        runMode,
        useCustomDistance,
        runDistanceKey,
        customDistanceInput,
        runPaceInput,
        runPaceUnit,
        runTimeInput,
        splitRepeatUnit,
        splitsInput,
        showMethodology,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage (e.g. private browsing).
    }
  }, [
    mode,
    altitudeUnit,
    altitudeInput,
    acclimatization,
    homeMode,
    homeAltitudeInput,
    targetMode,
    targetAltitudeInput,
    vo2MaxInput,
    runMode,
    useCustomDistance,
    runDistanceKey,
    customDistanceInput,
    runPaceInput,
    runPaceUnit,
    runTimeInput,
    splitRepeatUnit,
    splitsInput,
    showMethodology,
  ]);

  // --- Shared: current elevation, home altitude, target altitude ----------

  const altitudeRaw = Number(altitudeInput);
  const altitudeValid = altitudeInput.trim() !== "" && Number.isFinite(altitudeRaw);
  const altitudeKm = altitudeValid ? altitudeToKm(altitudeRaw, altitudeUnit) : null;
  const altitudeInDomain = altitudeKm !== null && isAltitudeInModelDomain(altitudeKm);

  const homeAltitudeCustomRaw = Number(homeAltitudeInput);
  const homeAltitudeCustomValid = homeAltitudeInput.trim() !== "" && Number.isFinite(homeAltitudeCustomRaw) && homeAltitudeCustomRaw >= 0;
  const homeAltitudeCustomKm = homeAltitudeCustomValid ? altitudeToKm(homeAltitudeCustomRaw, altitudeUnit) : null;
  const homeAltitudeKm = resolveHomeAltitudeKm(homeMode, homeAltitudeCustomKm, altitudeKm);
  const homeAltitudeInDomain = homeAltitudeKm === null || isAltitudeInModelDomain(homeAltitudeKm);
  const homeAltitudeMeters = homeAltitudeKm !== null && homeAltitudeInDomain ? kmToMeters(homeAltitudeKm) : 0;

  const targetAltitudeCustomRaw = Number(targetAltitudeInput);
  const targetAltitudeCustomValid = targetAltitudeInput.trim() !== "" && Number.isFinite(targetAltitudeCustomRaw);
  const targetAltitudeCustomKm = targetAltitudeCustomValid ? altitudeToKm(targetAltitudeCustomRaw, altitudeUnit) : null;
  const targetAltitudeKm = resolveTargetAltitudeKm(targetMode, targetAltitudeCustomKm, homeAltitudeKm);
  const targetAltitudeInDomain = targetAltitudeKm !== null && isAltitudeInModelDomain(targetAltitudeKm);
  const hasTarget = targetAltitudeKm !== null && targetAltitudeInDomain;
  const targetAltitudeRaw = targetAltitudeKm !== null ? kmToAltitude(targetAltitudeKm, altitudeUnit) : 0;

  // --- VO2max mode -----------------------------------------------------------

  const vo2MaxRaw = Number(vo2MaxInput);
  const vo2MaxValid = vo2MaxInput.trim() !== "" && Number.isFinite(vo2MaxRaw) && vo2MaxRaw > 0;

  const capacityPercent =
    altitudeKm !== null && altitudeInDomain ? capacityPercentAtAltitude(altitudeKm, acclimatization) : null;

  const conversion =
    altitudeKm !== null && altitudeInDomain && vo2MaxValid
      ? convertVo2MaxBetweenAltitudes(vo2MaxRaw, altitudeKm, hasTarget ? targetAltitudeKm! : altitudeKm, acclimatization)
      : null;

  const showTargetResult = conversion !== null && hasTarget;

  // --- Performance mode: shared distance + entered performance --------------

  const namedDistance = raceDistanceMap.get(runDistanceKey);
  const customDistanceRaw = Number(customDistanceInput);
  const customDistanceValid = Number.isFinite(customDistanceRaw) && customDistanceRaw > 0;
  const runDistanceMeters = useCustomDistance ? (customDistanceValid ? customDistanceRaw : null) : (namedDistance?.meters ?? null);
  const runDistanceLabel = useCustomDistance ? `${customDistanceInput}m` : (namedDistance?.label ?? "");

  const runPaceSeconds = parsePaceInput(runPaceInput, runPaceUnit);
  const runPaceValid = runPaceSeconds !== null && runPaceSeconds > 0;
  const runTimeSeconds = parseTimeToSeconds(runTimeInput);
  const runTimeValid = runTimeSeconds !== null && runTimeSeconds > 0;

  const actualTimeSeconds =
    runMode === "splits" || runDistanceMeters === null
      ? null
      : runMode === "pace"
        ? runPaceValid
          ? (runPaceSeconds! / PACE_UNIT_METERS[runPaceUnit]) * runDistanceMeters
          : null
        : runTimeValid
          ? runTimeSeconds!
          : null;

  // --- Performance mode: PRIMARY model (shared Daniels-table engine) --------

  const timeConversion =
    altitudeKm !== null && altitudeInDomain && actualTimeSeconds !== null
      ? convertTimeBetweenAltitudes(
          actualTimeSeconds,
          kmToMeters(altitudeKm),
          kmToMeters(hasTarget ? targetAltitudeKm! : altitudeKm),
          homeAltitudeMeters,
        )
      : null;

  const showRunTargetResult = timeConversion !== null && hasTarget;

  const parsedSplitEntries = runMode === "splits" ? parseWorkoutSplitsInput(splitsInput) : [];
  const firstInvalidSplitIndex = parsedSplitEntries.findIndex((seconds) => seconds === null);
  const validSplitSeconds = parsedSplitEntries.filter((seconds): seconds is number => seconds !== null);
  const canConvertSplits = runMode === "splits" && altitudeKm !== null && altitudeInDomain && validSplitSeconds.length > 0;
  const seaLevelSplitResults = canConvertSplits
    ? convertWorkoutSplits(validSplitSeconds, kmToMeters(altitudeKm!), 0, homeAltitudeMeters)
    : [];
  const targetSplitResults =
    canConvertSplits && hasTarget ? convertWorkoutSplits(validSplitSeconds, kmToMeters(altitudeKm!), kmToMeters(targetAltitudeKm!), homeAltitudeMeters) : [];
  const showSplitTargetResult = targetSplitResults.length > 0;

  const paceDisplayUnit: PaceUnit = runMode === "pace" ? runPaceUnit : "mi";
  const seaLevelPaceSecondsPerMeter =
    timeConversion && runDistanceMeters ? timeConversion.seaLevelTimeSeconds / runDistanceMeters : null;
  const targetPaceSecondsPerMeter =
    timeConversion && showRunTargetResult && runDistanceMeters ? timeConversion.targetTimeSeconds / runDistanceMeters : null;
  const seaLevelPaceDisplay =
    seaLevelPaceSecondsPerMeter !== null
      ? formatPaceOutput(seaLevelPaceSecondsPerMeter * PACE_UNIT_METERS[paceDisplayUnit], paceDisplayUnit)
      : null;
  const targetPaceDisplay =
    targetPaceSecondsPerMeter !== null
      ? formatPaceOutput(targetPaceSecondsPerMeter * PACE_UNIT_METERS[paceDisplayUnit], paceDisplayUnit)
      : null;
  const seaLevelTimeDisplay = timeConversion ? formatClock(timeConversion.seaLevelTimeSeconds) : null;
  const targetTimeDisplay = timeConversion && showRunTargetResult ? formatClock(timeConversion.targetTimeSeconds) : null;

  // --- Performance mode: SECOND model (Davis / Running Writings) -----------
  //
  // Fed the exact same actualTimeSeconds/runDistanceMeters/venue/home/target
  // the primary model above just used, rather than a second, separately-
  // collected set of inputs -- both models are asked literally the same
  // question. Not available for Workout splits (Davis's model has no
  // splits concept at all).
  const davisInputsReady =
    runMode !== "splits" && actualTimeSeconds !== null && runDistanceMeters !== null && altitudeKm !== null && altitudeInDomain && homeAltitudeInDomain;

  function davisConvert(targetMeters: number): number | null {
    if (!davisInputsReady) return null;
    const input: AltitudeConversionInput = {
      distanceMeters: runDistanceMeters!,
      timeSeconds: actualTimeSeconds!,
      venueAltitudeMeters: kmToMeters(altitudeKm!),
      homeAltitudeMeters,
      targetAltitudeMeters: targetMeters,
    };
    return convertPerformanceBetweenAltitudes(input);
  }

  const davisSeaLevelSeconds = davisConvert(0);
  const davisTargetSeconds = hasTarget ? davisConvert(kmToMeters(targetAltitudeKm!)) : null;
  const showDavisCard = davisSeaLevelSeconds !== null;

  const davisPaceSecondsPerMeter = (seconds: number | null) => (seconds !== null && runDistanceMeters ? seconds / runDistanceMeters : null);
  const davisSeaLevelPaceDisplay = (() => {
    const perMeter = davisPaceSecondsPerMeter(davisSeaLevelSeconds);
    return perMeter !== null ? formatPaceOutput(perMeter * PACE_UNIT_METERS[paceDisplayUnit], paceDisplayUnit) : null;
  })();
  const davisTargetPaceDisplay = (() => {
    const perMeter = davisPaceSecondsPerMeter(davisTargetSeconds);
    return perMeter !== null ? formatPaceOutput(perMeter * PACE_UNIT_METERS[paceDisplayUnit], paceDisplayUnit) : null;
  })();

  const venueFtForWarning = altitudeUnit === "ft" ? altitudeRaw : kmToAltitude(altitudeKm ?? 0, "ft");
  const targetFtForWarning = hasTarget ? kmToAltitude(targetAltitudeKm!, "ft") : 0;
  const showHighAltitudeWarning = showDavisCard && (venueFtForWarning > HIGH_ALTITUDE_FT || targetFtForWarning > HIGH_ALTITUDE_FT);
  const showExtrapolationWarning = showDavisCard && (runDistanceMeters ?? 0) > EXTRAPOLATION_DISTANCE_METERS;

  const acclimatizationLabel = acclimatization === "acclimatized" ? "an acclimatized" : "an unacclimatized";

  return (
    <div className="mt-10 space-y-10">
      <div>
        <p className={sectionLabelClass}>Conversion type</p>
        <div className={`${statCardClass} space-y-2`}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("vo2max")}
              aria-pressed={mode === "vo2max"}
              className={segmentedButtonClass(mode === "vo2max")}
            >
              VO2 max / aerobic capacity
            </button>
            <button
              type="button"
              onClick={() => setMode("performance")}
              aria-pressed={mode === "performance"}
              className={segmentedButtonClass(mode === "performance")}
            >
              Race / training performance
            </button>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            {mode === "vo2max"
              ? "Convert a VO2 max (or just see available aerobic capacity) between elevations."
              : "Convert a specific pace, race time, or workout splits between elevations."}
          </p>
        </div>
      </div>

      <div>
        <p className={sectionLabelClass}>Elevation &amp; acclimation</p>
        <div className={`${statCardClass} flex flex-wrap gap-6`}>
          <div className="min-w-0">
            <label htmlFor={`${baseId}-altitude`} className={labelClass}>
              Current elevation
            </label>
            <div className="flex gap-2">
              <input
                id={`${baseId}-altitude`}
                type="number"
                inputMode="decimal"
                value={altitudeInput}
                onChange={(event) => setAltitudeInput(event.target.value)}
                autoComplete="off"
                className={`w-28 ${fieldClass}`}
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setAltitudeUnit("ft")}
                  aria-pressed={altitudeUnit === "ft"}
                  className={segmentedButtonClass(altitudeUnit === "ft")}
                >
                  ft
                </button>
                <button
                  type="button"
                  onClick={() => setAltitudeUnit("m")}
                  aria-pressed={altitudeUnit === "m"}
                  className={segmentedButtonClass(altitudeUnit === "m")}
                >
                  m
                </button>
              </div>
            </div>
            {altitudeValid && !altitudeInDomain && (
              <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                Enter a value between {formatAltitude(0, altitudeUnit)} and{" "}
                {formatAltitude(kmToAltitude(MAX_ALTITUDE_KM, altitudeUnit), altitudeUnit)} -- see Confidence and
                limitations below for why this model stops being meaningful past {MAX_ALTITUDE_FT.toLocaleString()}{" "}
                ft.
              </p>
            )}
            {!altitudeValid && (
              <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">Enter an altitude to see a result.</p>
            )}
          </div>

          <div className="min-w-[220px]">
              <p className={labelClass}>Acclimatization</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAcclimatization("acclimatized")}
                  aria-pressed={acclimatization === "acclimatized"}
                  className={segmentedButtonClass(acclimatization === "acclimatized")}
                >
                  Acclimatized
                </button>
                <button
                  type="button"
                  onClick={() => setAcclimatization("unacclimatized")}
                  aria-pressed={acclimatization === "unacclimatized"}
                  className={segmentedButtonClass(acclimatization === "unacclimatized")}
                >
                  Unacclimatized
                </button>
              </div>
              <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                {acclimatization === "acclimatized"
                  ? "Several weeks living/training at this altitude."
                  : "1-7 days at this altitude -- not yet adapted."}{" "}
                Governs VO2 max mode only -- see Behind the calculator.
              </p>
            </div>

          <div className="min-w-[260px]">
              <p className={labelClass}>Home / living altitude</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setHomeMode("sea")}
                  aria-pressed={homeMode === "sea"}
                  className={segmentedButtonClass(homeMode === "sea")}
                >
                  Sea level
                </button>
                <button
                  type="button"
                  onClick={() => setHomeMode("same")}
                  aria-pressed={homeMode === "same"}
                  className={segmentedButtonClass(homeMode === "same")}
                >
                  Same as current
                </button>
                <button
                  type="button"
                  onClick={() => setHomeMode("other")}
                  aria-pressed={homeMode === "other"}
                  className={segmentedButtonClass(homeMode === "other")}
                >
                  Other
                </button>
                {homeMode === "other" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={homeAltitudeInput}
                      onChange={(event) => setHomeAltitudeInput(event.target.value)}
                      className={`w-24 ${fieldClass}`}
                    />
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">{ALTITUDE_UNIT_LABEL[altitudeUnit]}</span>
                  </div>
                )}
              </div>
              {homeMode === "other" && homeAltitudeInput.trim() !== "" && !homeAltitudeInDomain && (
                <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                  Outside the model&rsquo;s supported range -- treated as sea level (fully unacclimatized) below.
                </p>
              )}
              <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                Governs Performance mode&rsquo;s acclimation discount only. &ldquo;Sea level&rdquo; (the default)
                assumes no acclimation at all.
              </p>
            </div>

          <div className="min-w-[280px]">
            <p className={labelClass}>Convert to (optional)</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTargetMode("none")}
                aria-pressed={targetMode === "none"}
                className={segmentedButtonClass(targetMode === "none")}
              >
                None
              </button>
              <button
                type="button"
                onClick={() => setTargetMode("sea")}
                aria-pressed={targetMode === "sea"}
                className={segmentedButtonClass(targetMode === "sea")}
              >
                Sea level
              </button>
              <button
                type="button"
                onClick={() => setTargetMode("home")}
                aria-pressed={targetMode === "home"}
                className={segmentedButtonClass(targetMode === "home")}
              >
                Home altitude
              </button>
              <button
                type="button"
                onClick={() => setTargetMode("other")}
                aria-pressed={targetMode === "other"}
                className={segmentedButtonClass(targetMode === "other")}
              >
                Other
              </button>
              {targetMode === "other" && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={targetAltitudeInput}
                    onChange={(event) => setTargetAltitudeInput(event.target.value)}
                    className={`w-24 ${fieldClass}`}
                  />
                  <span className="text-sm text-zinc-600 dark:text-zinc-300">{ALTITUDE_UNIT_LABEL[altitudeUnit]}</span>
                </div>
              )}
            </div>
            <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
              Shared by both modes. &ldquo;None&rdquo; shows only the sea-level-equivalent baseline below.
            </p>
          </div>
        </div>
      </div>

      {mode === "vo2max" && (
        <div>
          <p className={sectionLabelClass}>Your VO2 max (optional)</p>
          <div className={`${statCardClass} flex flex-wrap gap-6`}>
            <div className="min-w-0">
              <label htmlFor={`${baseId}-vo2max`} className={labelClass}>
                VO2 max at this altitude
              </label>
              <input
                id={`${baseId}-vo2max`}
                type="number"
                inputMode="decimal"
                placeholder="e.g. 61"
                value={vo2MaxInput}
                onChange={(event) => setVo2MaxInput(event.target.value)}
                autoComplete="off"
                className={`w-28 ${fieldClass}`}
              />
            </div>
          </div>
        </div>
      )}

      {mode === "performance" && (
        <div>
          <p className={sectionLabelClass}>Your performance</p>
          <div className={`${statCardClass} flex flex-wrap gap-6`}>
            <div className="min-w-[260px]">
              <p className={labelClass}>Enter as</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRunMode("pace")}
                  aria-pressed={runMode === "pace"}
                  className={segmentedButtonClass(runMode === "pace")}
                >
                  Pace
                </button>
                <button
                  type="button"
                  onClick={() => setRunMode("time")}
                  aria-pressed={runMode === "time"}
                  className={segmentedButtonClass(runMode === "time")}
                >
                  Race time
                </button>
                <button
                  type="button"
                  onClick={() => setRunMode("splits")}
                  aria-pressed={runMode === "splits"}
                  className={segmentedButtonClass(runMode === "splits")}
                >
                  Workout splits
                </button>
              </div>
            </div>

            {runMode === "splits" ? (
              <>
                <div className="min-w-[180px]">
                  <p className={labelClass}>Repeat length</p>
                  <div className="flex gap-1">
                    {(["mi", "km", "400m", "200m"] as PaceUnit[]).map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        onClick={() => setSplitRepeatUnit(unit)}
                        aria-pressed={splitRepeatUnit === unit}
                        className={segmentedButtonClass(splitRepeatUnit === unit)}
                      >
                        {PACE_UNIT_LABEL[unit]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="min-w-[260px] flex-1">
                  <label htmlFor={`${baseId}-splits`} className={labelClass}>
                    Splits at this altitude (one per {PACE_UNIT_LABEL[splitRepeatUnit]})
                  </label>
                  <textarea
                    id={`${baseId}-splits`}
                    rows={2}
                    placeholder="8:00, 7:30, 7:00, 6:30, 6:15, 6:05, 5:55"
                    value={splitsInput}
                    onChange={(event) => setSplitsInput(event.target.value)}
                    autoComplete="off"
                    className={`w-full ${fieldClass}`}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="min-w-0">
                  <label htmlFor={`${baseId}-run-distance`} className={labelClass}>
                    Distance
                  </label>
                  {!useCustomDistance ? (
                    <select
                      id={`${baseId}-run-distance`}
                      value={runDistanceKey}
                      onChange={(event) => setRunDistanceKey(event.target.value)}
                      className={fieldClass}
                    >
                      {RACE_DISTANCES.map((distance) => (
                        <option key={distance.key} value={distance.key}>
                          {distance.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        id={`${baseId}-run-distance`}
                        type="number"
                        inputMode="decimal"
                        min={1}
                        value={customDistanceInput}
                        onChange={(event) => setCustomDistanceInput(event.target.value)}
                        className={`w-28 ${fieldClass}`}
                      />
                      <span className="text-sm text-zinc-600 dark:text-zinc-300">m</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setUseCustomDistance((v) => !v)}
                    className="mt-1 text-xs font-semibold text-zinc-700 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-zinc-200 dark:decoration-white/30 dark:hover:decoration-white"
                  >
                    {useCustomDistance ? "Choose a standard distance" : "Use a custom distance"}
                  </button>
                </div>

                {runMode === "pace" ? (
                  <div className="min-w-0">
                    <label htmlFor={`${baseId}-run-pace`} className={labelClass}>
                      Pace at this altitude
                    </label>
                    <div className="flex gap-2">
                      <input
                        id={`${baseId}-run-pace`}
                        type="text"
                        placeholder="mm:ss"
                        value={runPaceInput}
                        onChange={(event) => setRunPaceInput(event.target.value)}
                        autoComplete="off"
                        className={`w-24 ${fieldClass}`}
                      />
                      <select
                        aria-label="Pace unit"
                        value={runPaceUnit}
                        onChange={(event) => setRunPaceUnit(event.target.value as PaceUnit)}
                        className={fieldClass}
                      >
                        {(["mi", "km", "400m"] as PaceUnit[]).map((unit) => (
                          <option key={unit} value={unit}>
                            {PACE_UNIT_LABEL[unit]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <label htmlFor={`${baseId}-run-time`} className={labelClass}>
                      Time at this altitude
                    </label>
                    <input
                      id={`${baseId}-run-time`}
                      type="text"
                      placeholder="mm:ss or h:mm:ss"
                      value={runTimeInput}
                      onChange={(event) => setRunTimeInput(event.target.value)}
                      autoComplete="off"
                      className={`w-32 ${fieldClass}`}
                    />
                  </div>
                )}
              </>
            )}
          </div>
          {runMode === "splits" && firstInvalidSplitIndex !== -1 && (
            <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
              Split {firstInvalidSplitIndex + 1} isn&rsquo;t a valid mm:ss (or h:mm:ss) time -- check it and try
              again.
            </p>
          )}
          <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
            {runMode === "splits" ? (
              <>
                Each split is converted on its own, not blended into one average -- a hard, short repeat and a
                longer one cost differently under Daniels&rsquo; duration-scaling curve (see Behind the
                calculator). Like Race time, this mode has no acclimatized/unacclimatized distinction.
              </>
            ) : (
              <>
                Distance is required in both entry modes because Jack Daniels&rsquo; altitude tables scale the
                cost by how long the effort actually lasts, and a bare pace can&rsquo;t supply that on its own.
                This is the same altitude model the Environmental Performance Calculator uses, so the two tools
                agree on what this altitude costs.
              </>
            )}
          </p>
        </div>
      )}

      <div>
        <p className={sectionLabelClass}>Result</p>
        <div className={heroCardClass}>
          {mode === "vo2max" &&
            (altitudeValid && altitudeInDomain && capacityPercent !== null ? (
              <>
                <p className={statLabelClass}>Available aerobic capacity at {formatAltitude(altitudeRaw, altitudeUnit)}</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
                  {capacityPercent.toFixed(1)}%
                </p>

                {conversion && (
                  <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/10">
                    <p className={statLabelClass}>Estimated sea-level VO2 max</p>
                    <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">
                      {conversion.seaLevelVo2Max.toFixed(1)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                      from {vo2MaxRaw.toFixed(1)} VO2 max at {formatAltitude(altitudeRaw, altitudeUnit)}
                    </p>
                  </div>
                )}

                {showTargetResult && conversion && (
                  <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/10">
                    <p className={statLabelClass}>Estimated VO2 max at {formatAltitude(targetAltitudeRaw, altitudeUnit)}</p>
                    <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">
                      {conversion.targetVo2Max.toFixed(1)}
                    </p>
                  </div>
                )}

                <p className="mt-4 text-xs text-zinc-600 dark:text-zinc-300">
                  At {formatAltitude(altitudeRaw, altitudeUnit)}, the model estimates that approximately{" "}
                  {capacityPercent.toFixed(1)}% of sea-level aerobic capacity is available for {acclimatizationLabel}{" "}
                  athlete. This is a population-level estimate, not a personalized measurement -- see Confidence
                  and limitations below.
                </p>

                <SaveCalculationButton
                  calculatorType="altitude-calculator"
                  input={{ altitudeUnit, altitudeInput, acclimatization, targetMode, targetAltitudeInput, vo2MaxInput }}
                  output={{
                    currentCapacityPercent: capacityPercent,
                    seaLevelVo2Max: conversion?.seaLevelVo2Max ?? null,
                    targetVo2Max: showTargetResult ? conversion!.targetVo2Max : null,
                  }}
                  label={`${formatAltitude(altitudeRaw, altitudeUnit)}, ${acclimatization}`}
                />
              </>
            ) : (
              <p className="text-sm text-zinc-700 dark:text-zinc-200">
                Enter an altitude between {MIN_ALTITUDE_FT.toLocaleString()} and {MAX_ALTITUDE_FT.toLocaleString()}{" "}
                ft (or the meters equivalent) to see a result.
              </p>
            ))}

          {mode === "performance" &&
            (altitudeValid && altitudeInDomain ? (
              <>
                {timeConversion && (
                  <div>
                    <p className={statLabelClass}>Estimated sea-level-equivalent pace</p>
                    <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">
                      {seaLevelPaceDisplay}
                      {PACE_UNIT_LABEL[paceDisplayUnit]}
                    </p>
                    {seaLevelTimeDisplay && runDistanceLabel && (
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                        {seaLevelTimeDisplay} for {runDistanceLabel}
                      </p>
                    )}
                    {homeMode !== "sea" && homeAltitudeInDomain && (
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                        Discounted for training at {formatAltitude(kmToAltitude(homeAltitudeKm ?? 0, altitudeUnit), altitudeUnit)} -- see Behind the calculator.
                      </p>
                    )}
                  </div>
                )}

                {showRunTargetResult && timeConversion && (
                  <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/10">
                    <p className={statLabelClass}>Estimated pace at {formatAltitude(targetAltitudeRaw, altitudeUnit)}</p>
                    <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">
                      {targetPaceDisplay}
                      {PACE_UNIT_LABEL[paceDisplayUnit]}
                    </p>
                    {targetTimeDisplay && runDistanceLabel && (
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                        {targetTimeDisplay} for {runDistanceLabel} at {formatAltitude(targetAltitudeRaw, altitudeUnit)}
                      </p>
                    )}
                  </div>
                )}

                {seaLevelSplitResults.length > 0 && (
                  <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/10">
                    <p className={statLabelClass}>
                      {showSplitTargetResult ? `Splits converted to ${formatAltitude(targetAltitudeRaw, altitudeUnit)}` : "Sea-level-equivalent splits"}
                    </p>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full min-w-[320px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-black/10 text-xs tracking-wide text-zinc-600 uppercase dark:border-white/10 dark:text-zinc-300">
                            <th className="py-2 pr-3">Split</th>
                            <th className="py-2 pr-3">At {formatAltitude(altitudeRaw, altitudeUnit)}</th>
                            <th className="py-2 pr-3">{showSplitTargetResult ? `At ${formatAltitude(targetAltitudeRaw, altitudeUnit)}` : "Sea level"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {seaLevelSplitResults.map((split, i) => (
                            <tr key={split.index} className="border-b border-black/5 last:border-0 dark:border-white/5">
                              <td className="py-1.5 pr-3 font-semibold text-zinc-900 dark:text-white">{split.index + 1}</td>
                              <td className="py-1.5 pr-3">
                                {formatPaceOutput(split.actualTimeSeconds, splitRepeatUnit)}
                                {PACE_UNIT_LABEL[splitRepeatUnit]}
                              </td>
                              <td className="py-1.5 pr-3">
                                {formatPaceOutput(showSplitTargetResult ? targetSplitResults[i].targetTimeSeconds : split.targetTimeSeconds, splitRepeatUnit)}
                                {PACE_UNIT_LABEL[splitRepeatUnit]}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                      Each split converted on its own, not as one blended average -- see Behind the calculator.
                      {homeMode !== "sea" && homeAltitudeInDomain
                        ? ` Discounted for training at ${formatAltitude(kmToAltitude(homeAltitudeKm ?? 0, altitudeUnit), altitudeUnit)}.`
                        : ""}
                    </p>
                  </div>
                )}

                {!timeConversion && seaLevelSplitResults.length === 0 && (
                  <p className="text-sm text-zinc-700 dark:text-zinc-200">
                    Enter a pace, race time, or workout splits above to see a conversion.
                  </p>
                )}

                {targetMode !== "none" && !hasTarget && (
                  <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
                    Target altitude is outside the model&rsquo;s supported range ({MIN_ALTITUDE_FT.toLocaleString()}
                    &ndash;{MAX_ALTITUDE_FT.toLocaleString()} ft), so no target result is shown for it.
                  </p>
                )}

                {(timeConversion || seaLevelSplitResults.length > 0) && (
                  <SaveCalculationButton
                    calculatorType="altitude-calculator"
                    input={{
                      altitudeUnit,
                      altitudeInput,
                      homeMode,
                      homeAltitudeInput,
                      targetMode,
                      targetAltitudeInput,
                      runMode,
                      runPaceInput,
                      runPaceUnit,
                      runDistanceKey,
                      useCustomDistance,
                      customDistanceInput,
                      runTimeInput,
                      splitRepeatUnit,
                      splitsInput,
                    }}
                    output={{
                      seaLevelPace: seaLevelPaceDisplay ? `${seaLevelPaceDisplay}${PACE_UNIT_LABEL[paceDisplayUnit]}` : null,
                      targetPace: showRunTargetResult ? `${targetPaceDisplay}${PACE_UNIT_LABEL[paceDisplayUnit]}` : null,
                      seaLevelSplits: seaLevelSplitResults.map(
                        (s) => `${formatPaceOutput(s.actualTimeSeconds, splitRepeatUnit)}${PACE_UNIT_LABEL[splitRepeatUnit]} → ${formatPaceOutput(s.targetTimeSeconds, splitRepeatUnit)}${PACE_UNIT_LABEL[splitRepeatUnit]}`,
                      ),
                    }}
                    label={`${formatAltitude(altitudeRaw, altitudeUnit)}`}
                  />
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-700 dark:text-zinc-200">
                Enter an altitude between {MIN_ALTITUDE_FT.toLocaleString()} and {MAX_ALTITUDE_FT.toLocaleString()}{" "}
                ft (or the meters equivalent) to see a result.
              </p>
            ))}
        </div>
      </div>

      {mode === "performance" && showDavisCard && (
        <div>
          <p className={sectionLabelClass}>A second, independently-derived model</p>
          <div className={`${statCardClass} space-y-3`}>
            <p className="text-sm text-zinc-700 dark:text-zinc-200">
              The result above reuses this site&rsquo;s shared Daniels-table altitude engine (the same one the{" "}
              <Link href="/environmental-calculator" className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white">
                Environmental Performance Calculator
              </Link>{" "}
              uses). This is a genuinely different model -- independently reverse-engineered from John J.
              Davis&rsquo;s Running Writings Altitude-Adjusted Pace calculator -- answering the same question from
              different evidence. Shown here instead of just linked to, so neither one is presented as the
              answer.
            </p>

            {(showHighAltitudeWarning || showExtrapolationWarning) && (
              <div className="space-y-3">
                {showHighAltitudeWarning && (
                  <ContentCallout
                    variant="mistake"
                    title="High altitude"
                    text="Altitudes above 8,000ft are rare in the data this second model was fit on. Its results at this altitude may be less accurate."
                  />
                )}
                {showExtrapolationWarning && (
                  <ContentCallout
                    variant="mistake"
                    title="Extrapolated distance"
                    text="This second model's altitude effects for races longer than 10km are extrapolated from shorter races. Its results may be less reliable."
                  />
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className={statCardClass}>
                <p className={statLabelClass}>Sea-level-equivalent pace</p>
                <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">
                  {davisSeaLevelPaceDisplay}
                  {PACE_UNIT_LABEL[paceDisplayUnit]}
                </p>
                {davisSeaLevelSeconds !== null && runDistanceLabel && (
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                    {formatClock(davisSeaLevelSeconds)} for {runDistanceLabel}
                  </p>
                )}
              </div>
              {hasTarget && davisTargetSeconds !== null && (
                <div className={statCardClass}>
                  <p className={statLabelClass}>Pace at {formatAltitude(targetAltitudeRaw, altitudeUnit)}</p>
                  <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">
                    {davisTargetPaceDisplay}
                    {PACE_UNIT_LABEL[paceDisplayUnit]}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{formatClock(davisTargetSeconds)} for {runDistanceLabel}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowMethodology((value) => !value)}
          aria-expanded={showMethodology}
          className="flex items-center gap-2 py-1 text-lg font-semibold text-zinc-900 dark:text-white"
        >
          Behind the calculator: formulas, assumptions, and limitations
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
                <span className="inline-flex items-center gap-1.5">
                  <Mountain className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  Altitude and aerobic capacity
                </span>
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Air gets thinner as altitude increases -- barometric pressure drops, so each breath delivers
                  fewer oxygen molecules even though the percentage of oxygen in the air (about 21%) doesn&rsquo;t
                  change. Less oxygen reaching working muscle means a lower ceiling on how much aerobic energy the
                  body can produce, which shows up as a reduced maximal aerobic capacity -- the same mechanism
                  behind altitude&rsquo;s effect on marathon-pace multipliers covered in{" "}
                  <Link href="/exercise-physiology" className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white">
                    Exercise Physiology
                  </Link>
                  . This effect is present from the moment you arrive at altitude and never fully disappears, even
                  after full acclimatization -- acclimatization narrows the gap, it doesn&rsquo;t close it.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span aria-hidden="true" className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400">
                  ▶
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Dna className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  Acclimatization (VO2 max mode)
                </span>
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Given enough time at altitude, the body partially compensates -- increased red blood cell
                  production and other adaptations improve oxygen delivery, which is why the acclimatized curve
                  sits above the unacclimatized one at every altitude in this calculator. The source model defines
                  &ldquo;acclimatized&rdquo; as several weeks at altitude and &ldquo;unacclimatized&rdquo; as 1-7
                  days -- this calculator uses those same two states rather than inventing a more precise cutoff,
                  since the underlying research doesn&rsquo;t support a sharper one.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span aria-hidden="true" className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400">
                  ▶
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Sigma className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  The VO2 max equations
                </span>
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Both equations express <em>y</em>, the percentage of sea-level aerobic capacity available, as a
                  function of <em>x</em>, altitude in kilometers:
                </p>
                <p className="mt-2 font-mono text-xs text-zinc-700 dark:text-zinc-200">
                  Acclimatized: y = -1.12x² - 1.90x + 99.9
                  <br />
                  Unacclimatized: y = 0.178x³ - 1.43x² - 4.07x + 100
                </p>
                <p className="mt-2">
                  Altitude entered in feet or meters is converted to kilometers internally before either equation
                  runs, then converted back for display. This calculator caps altitude input at 20,000 ft since
                  the unacclimatized curve&rsquo;s own cubic term turns back upward past about 6.5 km, which the
                  source data doesn&rsquo;t support as a real recovery in capacity.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span aria-hidden="true" className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400">
                  ▶
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calculator className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  VO2 max conversion
                </span>
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Converting a VO2 max between two altitudes is three steps: (1) estimate the capacity percentage
                  at the altitude your VO2 max was measured at, (2) divide your VO2 max by that percentage to
                  recover an implied sea-level baseline, and (3) multiply that baseline by the capacity percentage
                  at your target altitude. This treats the model&rsquo;s percentage as directly applicable to a
                  VO2 max value -- a reasonable practical use of the model, but still a population-level estimate.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span aria-hidden="true" className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400">
                  ▶
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  Performance mode&rsquo;s primary model
                </span>
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Pace/time/splits conversion doesn&rsquo;t use the Bassett/Péronnet capacity-percentage model at
                  all -- it reuses the{" "}
                  <Link href="/environmental-calculator" className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white">
                    Environmental Performance Calculator
                  </Link>
                  &rsquo;s own altitude model directly: a quadratic fit to Jack Daniels&rsquo; published Altitude
                  Adjustment Tables (marathon multipliers), scaled down for shorter efforts using Daniels&rsquo;
                  separate Mile/5K/Marathon table columns. Both tools call the exact same two functions (
                  <code className="rounded bg-black/5 px-1 py-0.5 text-[0.85em] dark:bg-white/10">marathonImpairmentFraction</code>,{" "}
                  <code className="rounded bg-black/5 px-1 py-0.5 text-[0.85em] dark:bg-white/10">altitudeDurationScale</code>) with the
                  same inputs, so they agree on what a given altitude costs a given run rather than merely landing
                  close.
                </p>
                <p className="mt-2">
                  Daniels&rsquo; tables themselves have no acclimatized/unacclimatized distinction, so this result
                  doesn&rsquo;t change with the VO2 max mode&rsquo;s Acclimatization toggle. &ldquo;Home / living
                  altitude&rdquo; is a separate lever built specifically to give Daniels&rsquo; tables the
                  acclimatization sensitivity they otherwise lack: it compares this page&rsquo;s own acclimatized
                  and unacclimatized capacity-percent curves at the race altitude, and treats the gap between them
                  as the amount acclimatization can realistically &ldquo;buy back.&rdquo; This is a simplification
                  of a genuinely continuous physiological process, not a third independently-validated study.
                </p>
                <p className="mt-2">
                  Workout splits mode runs a structured session through this exact same math, once per split
                  rather than once for the whole workout -- a workout&rsquo;s total time sits much closer to
                  Daniels&rsquo; 5K/marathon anchors than any individual short repeat does on its own, so
                  converting the total would overstate altitude&rsquo;s cost on each rep.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span aria-hidden="true" className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400">
                  ▶
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  Performance mode&rsquo;s second model (Running Writings)
                </span>
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Independently reverse-engineered from John J. Davis&rsquo;s{" "}
                  <a
                    href="https://apps.runningwritings.com/altitude-adjusted-pace/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-900 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
                  >
                    Altitude-Adjusted Pace calculator
                  </a>{" "}
                  (Running Writings): every value was fit by black-box statistical regression against 825 real
                  collected (input performance → predicted output) pairs, not read from source code. Validated to
                  a median error under 1 second and a worst case around 100 seconds (under 1%) across those same
                  825 performances, spanning 400m to the marathon and 0&ndash;12,000ft.
                </p>
                <p className="mt-2">
                  Unlike the primary model above, this one is genuinely distance-aware (a continuous spline from
                  400m to the marathon, not a duration-anchored lookup) and models home-altitude acclimation as a
                  continuous saturating function of absolute home altitude, fit directly to the same 825-point
                  dataset -- a more rigorous treatment of acclimation than the primary model&rsquo;s own
                  curve-blending approach. It has no workout-splits mode, which is why it isn&rsquo;t shown when
                  Workout splits is selected above.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span aria-hidden="true" className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400">
                  ▶
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  Confidence and limitations
                </span>
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  The VO2 max/capacity results come from population-level regressions popularized by TrainingPeaks
                  (trainingpeaks.com/blog/the-effect-of-racing-at-altitude), tracing to two underlying studies: the
                  acclimatized curve from Bassett et al. (Medicine &amp; Science in Sports &amp; Exercise, 1999)
                  and the unacclimatized curve from Péronnet et al. (Journal of Applied Physiology, 1991). Neither
                  source calls its output &ldquo;VO2 max&rdquo; specifically -- both describe it as aerobic
                  power/capacity.
                </p>
                <p className="mt-2">
                  Performance mode shows two genuinely different, separately-sourced models side by side rather
                  than picking one: a citable population regression (via the shared Daniels-table engine) and an
                  independently reverse-engineered third-party model (Running Writings). They can put a
                  meaningfully different size on the altitude effect at the same altitude -- both are legitimate,
                  measuring related but distinct things, not an error in either one.
                </p>
                <p className="mt-2">
                  Individual response to altitude varies -- genetics, fitness, hydration, and prior altitude
                  exposure all matter, and none of that is captured by any of these models. Treat every result
                  here as a population-level estimate from a published or fitted model, not a laboratory
                  measurement or a personalized physiological assessment.
                </p>
              </div>
            </details>
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Planning pace or fueling for a specific race that happens to be at altitude, and want heat, humidity, wind,
        and elevation change accounted for too, not just altitude on its own? The{" "}
        <Link href="/environmental-calculator" className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white">
          Environmental Performance Calculator
        </Link>{" "}
        combines all of those into one equivalent time for an actual course -- and shares this page&rsquo;s own
        primary pace/time altitude model, so the two agree on altitude&rsquo;s share of the result.
      </p>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Want the physiology behind VO2 max itself, or how it&rsquo;s used to predict training paces? See{" "}
        <Link href="/exercise-physiology" className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white">
          Exercise Physiology
        </Link>{" "}
        and the{" "}
        <Link href="/cv-threshold-calculator" className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white">
          Threshold, CV &amp; VO2 Max Pace Calculator
        </Link>
        .
      </p>
    </div>
  );
}
