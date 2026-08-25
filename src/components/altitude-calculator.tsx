"use client";

import { useEffect, useId } from "react";
import Link from "next/link";
import { AlertTriangle, Calculator, Dna, Gauge, Mountain, Sigma } from "lucide-react";

import { SaveCalculationButton } from "@/components/save-calculation-button";
import { fieldClass, labelClass } from "@/lib/form-styles";
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
  isAltitudeInModelDomain,
  kmToAltitude,
  kmToMeters,
} from "@/lib/altitude-vo2max-math";
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

type RunMode = "pace" | "time";

type PersistedState = {
  altitudeUnit: AltitudeUnit;
  altitudeInput: string;
  acclimatization: AcclimatizationState;
  targetAltitudeInput: string;
  vo2MaxInput: string;
  runMode: RunMode;
  runPaceInput: string;
  runPaceUnit: PaceUnit;
  runDistanceKey: string;
  runTimeInput: string;
  showMethodology: boolean;
};

function formatAltitude(value: number, unit: AltitudeUnit): string {
  return `${Math.round(value).toLocaleString()} ${ALTITUDE_UNIT_LABEL[unit]}`;
}

// Two independent features, two deliberately different sources: available
// aerobic capacity / VO2 max conversion uses acclimatization-aware
// population regressions (Bassett et al. 1999; Peronnet et al. 1991, via
// TrainingPeaks's synthesis of both), since nothing else on the site models
// acclimatization at all. Run pace/time conversion instead reuses the
// Environmental Performance Calculator's own altitude-engine.ts (Jack
// Daniels' altitude tables, duration-scaled) directly -- the same functions,
// not a second independently-sourced model -- so the two tools agree on
// what a given altitude costs a given run. See lib/altitude-vo2max-math.ts
// for the full reasoning and citations.
export function AltitudeCalculator() {
  const baseId = useId();
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const [altitudeUnit, setAltitudeUnit] = usePersistedField<AltitudeUnit>(persisted?.altitudeUnit, "ft");
  const [altitudeInput, setAltitudeInput] = usePersistedField(persisted?.altitudeInput, "7000");
  const [acclimatization, setAcclimatization] = usePersistedField<AcclimatizationState>(
    persisted?.acclimatization,
    "acclimatized",
  );
  const [targetAltitudeInput, setTargetAltitudeInput] = usePersistedField(persisted?.targetAltitudeInput, "");
  const [vo2MaxInput, setVo2MaxInput] = usePersistedField(persisted?.vo2MaxInput, "");
  const [runMode, setRunMode] = usePersistedField<RunMode>(persisted?.runMode, "pace");
  const [runPaceInput, setRunPaceInput] = usePersistedField(persisted?.runPaceInput, "");
  const [runPaceUnit, setRunPaceUnit] = usePersistedField<PaceUnit>(persisted?.runPaceUnit, "mi");
  const [runDistanceKey, setRunDistanceKey] = usePersistedField(persisted?.runDistanceKey, "5k");
  const [runTimeInput, setRunTimeInput] = usePersistedField(persisted?.runTimeInput, "");
  const [showMethodology, setShowMethodology] = usePersistedField(persisted?.showMethodology, false);

  useEffect(() => {
    try {
      const state: PersistedState = {
        altitudeUnit,
        altitudeInput,
        acclimatization,
        targetAltitudeInput,
        vo2MaxInput,
        runMode,
        runPaceInput,
        runPaceUnit,
        runDistanceKey,
        runTimeInput,
        showMethodology,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage (e.g. private browsing).
    }
  }, [
    altitudeUnit,
    altitudeInput,
    acclimatization,
    targetAltitudeInput,
    vo2MaxInput,
    runMode,
    runPaceInput,
    runPaceUnit,
    runDistanceKey,
    runTimeInput,
    showMethodology,
  ]);

  const altitudeRaw = Number(altitudeInput);
  const altitudeValid = altitudeInput.trim() !== "" && Number.isFinite(altitudeRaw);
  const altitudeKm = altitudeValid ? altitudeToKm(altitudeRaw, altitudeUnit) : null;
  const altitudeInDomain = altitudeKm !== null && isAltitudeInModelDomain(altitudeKm);

  const vo2MaxRaw = Number(vo2MaxInput);
  const vo2MaxValid = vo2MaxInput.trim() !== "" && Number.isFinite(vo2MaxRaw) && vo2MaxRaw > 0;

  const targetAltitudeRaw = Number(targetAltitudeInput);
  const targetAltitudeValid = targetAltitudeInput.trim() !== "" && Number.isFinite(targetAltitudeRaw);
  const targetAltitudeKm = targetAltitudeValid ? altitudeToKm(targetAltitudeRaw, altitudeUnit) : null;
  const targetAltitudeInDomain = targetAltitudeKm !== null && isAltitudeInModelDomain(targetAltitudeKm);

  const capacityPercent =
    altitudeKm !== null && altitudeInDomain ? capacityPercentAtAltitude(altitudeKm, acclimatization) : null;

  const conversion =
    altitudeKm !== null && altitudeInDomain && vo2MaxValid
      ? convertVo2MaxBetweenAltitudes(
          vo2MaxRaw,
          altitudeKm,
          targetAltitudeKm !== null && targetAltitudeInDomain ? targetAltitudeKm : altitudeKm,
          acclimatization,
        )
      : null;

  const showTargetResult = conversion !== null && targetAltitudeKm !== null && targetAltitudeInDomain;

  // A real race distance is required now, in both modes -- it's what lets
  // the shared Daniels-table engine duration-scale the altitude cost the
  // same way the Environmental Performance Calculator does, which a bare
  // pace (a rate, with no duration) can't support on its own.
  const runDistance = raceDistanceMap.get(runDistanceKey);
  const runPaceSeconds = parsePaceInput(runPaceInput, runPaceUnit);
  const runPaceValid = runPaceSeconds !== null && runPaceSeconds > 0;
  const runTimeSeconds = parseTimeToSeconds(runTimeInput);
  const runTimeValid = runTimeSeconds !== null && runTimeSeconds > 0;

  const actualTimeSeconds =
    runDistance === undefined
      ? null
      : runMode === "pace"
        ? runPaceValid
          ? (runPaceSeconds! / PACE_UNIT_METERS[runPaceUnit]) * runDistance.meters
          : null
        : runTimeValid
          ? runTimeSeconds!
          : null;

  const timeConversion =
    altitudeKm !== null && altitudeInDomain && actualTimeSeconds !== null
      ? convertTimeBetweenAltitudes(
          actualTimeSeconds,
          kmToMeters(altitudeKm),
          kmToMeters(targetAltitudeKm !== null && targetAltitudeInDomain ? targetAltitudeKm : altitudeKm),
        )
      : null;

  const showRunTargetResult = timeConversion !== null && targetAltitudeKm !== null && targetAltitudeInDomain;

  // Pace mode still lets the user pick a display unit for entry/output;
  // race-time mode has no unit of its own (the user picked a distance, not
  // a pace unit), so it defaults to miles, matching the site's
  // default-imperial convention (see altitude's own ft default).
  const paceDisplayUnit: PaceUnit = runMode === "pace" ? runPaceUnit : "mi";
  const seaLevelPaceSecondsPerMeter =
    timeConversion && runDistance ? timeConversion.seaLevelTimeSeconds / runDistance.meters : null;
  const targetPaceSecondsPerMeter =
    timeConversion && showRunTargetResult && runDistance ? timeConversion.targetTimeSeconds / runDistance.meters : null;
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

  const acclimatizationLabel = acclimatization === "acclimatized" ? "an acclimatized" : "an unacclimatized";

  return (
    <div className="mt-10 space-y-10">
      <div>
        <p className={sectionLabelClass}>Setup</p>
        <div className={`${statCardClass} flex flex-wrap gap-6`}>
          <div className="min-w-0">
            <label htmlFor={`${baseId}-altitude`} className={labelClass}>
              Altitude
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
                : "1-7 days at this altitude -- not yet adapted."}
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className={sectionLabelClass}>Convert to altitude (optional)</p>
        <div className={`${statCardClass} flex flex-wrap gap-6`}>
          <div className="min-w-0">
            <label htmlFor={`${baseId}-target`} className={labelClass}>
              Target altitude ({ALTITUDE_UNIT_LABEL[altitudeUnit]})
            </label>
            <input
              id={`${baseId}-target`}
              type="number"
              inputMode="decimal"
              placeholder="e.g. 1000"
              value={targetAltitudeInput}
              onChange={(event) => setTargetAltitudeInput(event.target.value)}
              autoComplete="off"
              className={`w-28 ${fieldClass}`}
            />
          </div>
        </div>
        <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
          Shared by both conversions below. Leave it blank to only see a sea-level-equivalent baseline; fill it in
          to convert your VO2 max and/or run to that specific elevation too.
        </p>
      </div>

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

      <div>
        <p className={sectionLabelClass}>Your run (optional)</p>
        <div className={`${statCardClass} flex flex-wrap gap-6`}>
          <div className="min-w-0">
            <label htmlFor={`${baseId}-run-distance`} className={labelClass}>
              Distance
            </label>
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
          </div>

          <div className="min-w-[220px]">
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
            </div>
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
        </div>
        <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
          Distance is required in both modes because Jack Daniels&rsquo; altitude tables scale the cost by how long
          the effort actually lasts, and a bare pace -- a rate, not a duration -- can&rsquo;t supply that on its
          own. Pace + distance derives a duration the same way distance + race time does; either way you get a
          real effort length to scale by. This is the same altitude model the Environmental Performance Calculator
          uses, so the two tools agree on what this altitude costs -- but it has no acclimatized/unacclimatized
          distinction, so this result doesn&rsquo;t change with the Acclimatization toggle above (see Behind the
          calculator).
        </p>
      </div>

      <div>
        <p className={sectionLabelClass}>Result</p>
        <div className={heroCardClass}>
          {altitudeValid && altitudeInDomain && capacityPercent !== null ? (
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
                  <p className={statLabelClass}>
                    Estimated VO2 max at {formatAltitude(targetAltitudeRaw, altitudeUnit)}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">
                    {conversion.targetVo2Max.toFixed(1)}
                  </p>
                </div>
              )}

              {timeConversion && (
                <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/10">
                  <p className={statLabelClass}>Estimated sea-level-equivalent pace</p>
                  <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">
                    {seaLevelPaceDisplay}
                    {PACE_UNIT_LABEL[paceDisplayUnit]}
                  </p>
                  {seaLevelTimeDisplay && runDistance && (
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                      {seaLevelTimeDisplay} for {runDistance.label}
                    </p>
                  )}
                </div>
              )}

              {showRunTargetResult && timeConversion && (
                <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/10">
                  <p className={statLabelClass}>
                    Estimated pace at {formatAltitude(targetAltitudeRaw, altitudeUnit)}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">
                    {targetPaceDisplay}
                    {PACE_UNIT_LABEL[paceDisplayUnit]}
                  </p>
                  {targetTimeDisplay && runDistance && (
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                      {targetTimeDisplay} for {runDistance.label} at {formatAltitude(targetAltitudeRaw, altitudeUnit)}
                    </p>
                  )}
                </div>
              )}

              {targetAltitudeValid && !targetAltitudeInDomain && (vo2MaxValid || actualTimeSeconds !== null) && (
                <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
                  Target altitude is outside the model&rsquo;s supported range ({MIN_ALTITUDE_FT.toLocaleString()}
                  –{MAX_ALTITUDE_FT.toLocaleString()} ft), so no target result is shown for it.
                </p>
              )}

              <p className="mt-4 text-xs text-zinc-600 dark:text-zinc-300">
                At {formatAltitude(altitudeRaw, altitudeUnit)}, the model estimates that approximately{" "}
                {capacityPercent.toFixed(1)}% of sea-level aerobic capacity is available for {acclimatizationLabel}{" "}
                athlete. This is a population-level estimate, not a personalized measurement -- see Confidence and
                limitations below.
              </p>

              <SaveCalculationButton
                calculatorType="altitude-calculator"
                input={{
                  altitudeUnit,
                  altitudeInput,
                  acclimatization,
                  targetAltitudeInput,
                  vo2MaxInput,
                  runMode,
                  runPaceInput,
                  runPaceUnit,
                  runDistanceKey,
                  runTimeInput,
                }}
                output={{
                  currentCapacityPercent: capacityPercent,
                  seaLevelVo2Max: conversion?.seaLevelVo2Max ?? null,
                  targetVo2Max: showTargetResult ? conversion!.targetVo2Max : null,
                  seaLevelPace: seaLevelPaceDisplay ? `${seaLevelPaceDisplay}${PACE_UNIT_LABEL[paceDisplayUnit]}` : null,
                  targetPace: showRunTargetResult ? `${targetPaceDisplay}${PACE_UNIT_LABEL[paceDisplayUnit]}` : null,
                }}
                label={`${formatAltitude(altitudeRaw, altitudeUnit)}, ${acclimatization}`}
              />
            </>
          ) : (
            <p className="text-sm text-zinc-700 dark:text-zinc-200">
              Enter an altitude between {MIN_ALTITUDE_FT.toLocaleString()} and {MAX_ALTITUDE_FT.toLocaleString()} ft
              (or the meters equivalent) to see a result.
            </p>
          )}
        </div>
      </div>

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
                <span
                  aria-hidden="true"
                  className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                >
                  ▶
                </span>
                <span className="inline-flex items-center gap-1.5"><Mountain className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />Altitude and aerobic capacity</span>
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Air gets thinner as altitude increases -- barometric pressure drops, so each breath delivers
                  fewer oxygen molecules even though the percentage of oxygen in the air (about 21%) doesn&rsquo;t
                  change. Less oxygen reaching working muscle means a lower ceiling on how much aerobic energy the
                  body can produce, which shows up as a reduced maximal aerobic capacity -- the same mechanism
                  behind altitude&rsquo;s effect on marathon-pace multipliers covered in{" "}
                  <Link
                    href="/exercise-physiology"
                    className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
                  >
                    Exercise Physiology
                  </Link>
                  . This effect is present from the moment you arrive at altitude and never fully disappears, even
                  after full acclimatization -- acclimatization narrows the gap, it doesn&rsquo;t close it.
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
                <span className="inline-flex items-center gap-1.5"><Dna className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />Acclimatization</span>
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Given enough time at altitude, the body partially compensates -- increased red blood cell
                  production and other adaptations improve oxygen delivery, which is why the acclimatized curve
                  sits above the unacclimatized one at every altitude in this calculator. The source model defines
                  &ldquo;acclimatized&rdquo; as several weeks at altitude and &ldquo;unacclimatized&rdquo; as 1-7
                  days -- this calculator uses those same two states rather than inventing a more precise cutoff,
                  since the underlying research doesn&rsquo;t support a sharper one. Where an athlete falls in
                  between (say, 2-3 weeks in) isn&rsquo;t modeled here; treat the two options as bounds, not a
                  precise timeline.
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
                <span className="inline-flex items-center gap-1.5"><Sigma className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />The equations</span>
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
                  runs (1,000 ft ≈ 0.3048 km), then converted back for display -- the unit toggle only changes how
                  the number is shown, never the math. Both curves decrease as altitude increases; the
                  unacclimatized curve&rsquo;s own cubic term means it mathematically turns back upward past about
                  6.5 km (21,400 ft), which the source data doesn&rsquo;t support as a real recovery in capacity --
                  this calculator caps altitude input at 20,000 ft, safely below that point, for exactly that
                  reason (see Confidence and limitations).
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
                <span className="inline-flex items-center gap-1.5"><Calculator className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />VO2 max conversion</span>
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Converting a VO2 max between two altitudes is three steps: (1) estimate the capacity percentage
                  at the altitude your VO2 max was measured at, (2) divide your VO2 max by that percentage to
                  recover an implied sea-level baseline, and (3) multiply that baseline by the capacity percentage
                  at your target altitude. This treats the model&rsquo;s percentage as directly applicable to a
                  VO2 max value -- a reasonable practical use of the model, but still a population-level estimate
                  layered onto a single self-reported or lab-measured number, not a new measurement in its own
                  right.
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
                <span className="inline-flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />Pace and time conversion</span>
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Unlike the VO2 max conversion above, pace/time conversion doesn&rsquo;t use the Bassett/Péronnet
                  capacity-percentage model at all -- it reuses the{" "}
                  <Link
                    href="/environmental-calculator"
                    className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
                  >
                    Environmental Performance Calculator
                  </Link>
                  &rsquo;s own altitude model directly: a quadratic fit to Jack Daniels&rsquo; published Altitude
                  Adjustment Tables (marathon multipliers), scaled down for shorter efforts using Daniels&rsquo;
                  separate Mile/5K/Marathon table columns. Concretely: (1) the marathon-equivalent impairment
                  fraction at your altitude is scaled by how long your entered distance takes, giving a real cost
                  fraction for that specific effort; (2) your entered time is reduced by that fraction to recover a
                  sea-level-equivalent time; (3) the same duration is run back through the target altitude&rsquo;s
                  own fraction to get the converted time. Both tools now call the exact same two functions
                  (<code className="rounded bg-black/5 px-1 py-0.5 text-[0.85em] dark:bg-white/10">
                    marathonImpairmentFraction
                  </code>
                  ,{" "}
                  <code className="rounded bg-black/5 px-1 py-0.5 text-[0.85em] dark:bg-white/10">
                    altitudeDurationScale
                  </code>
                  ) with the same inputs, so they agree on what a given altitude costs a given run rather than
                  merely landing close.
                </p>
                <p className="mt-2">
                  This is why a distance is required for pace entry now, not just race-time entry -- Daniels&rsquo;
                  duration scaling needs a real effort length to work from, which a bare pace (a rate, not a
                  duration) can&rsquo;t supply on its own. The trade-off for reusing this model: Daniels&rsquo;
                  tables have no acclimatized/unacclimatized distinction at all, so this result is the same
                  regardless of which Acclimatization option is selected above -- only the VO2 max conversion
                  varies with it. Daniels&rsquo; tables are also only calibrated up to 8,000 ft (this engine clamps
                  its extrapolation at 14,000 ft), a narrower range than the 20,000 ft this page otherwise allows
                  for the capacity/VO2 max model above.
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
                <span className="inline-flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />Confidence and limitations</span>
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  The available-capacity and VO2 max results above come from population-level regressions
                  popularized by TrainingPeaks (trainingpeaks.com/blog/the-effect-of-racing-at-altitude), tracing
                  to two underlying studies. The acclimatized curve is described by Bassett et al. as adapted from
                  earlier research on highly trained/elite runners at altitude, reproduced inside a paper primarily
                  about track-cycling hour-record modeling (Bassett et al., Medicine &amp; Science in Sports &amp;
                  Exercise, 1999) -- worth knowing since the paper&rsquo;s own subject is cycling even though this
                  specific curve is runner-derived. The unacclimatized curve comes from a running-specific model
                  (Péronnet et al., Journal of Applied Physiology, 1991). Neither source calls its output
                  &ldquo;VO2 max&rdquo; specifically -- both describe it as aerobic power/capacity, which this
                  calculator treats as applicable to a VO2 max value.
                </p>
                <p className="mt-2">
                  The pace/time results above use a completely different, separately-sourced model (Jack
                  Daniels&rsquo; Altitude Adjustment Tables -- see Pace and time conversion above), so this
                  page&rsquo;s own capacity percentage and its pace/time conversion can put a genuinely different
                  size on the altitude effect at the same altitude -- both are legitimate, published sources
                  measuring related but distinct things (a capacity percentage vs. an empirical race-time cost),
                  not an error in either one. What pace/time conversion no longer does is disagree with the{" "}
                  <Link
                    href="/environmental-calculator"
                    className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
                  >
                    Environmental Performance Calculator
                  </Link>
                  : the two tools now share the exact same altitude functions, so a run entered into both with the
                  same altitude and duration gets the same answer.
                </p>
                <p className="mt-2">
                  Individual response to altitude varies -- genetics, fitness, hydration, and prior altitude
                  exposure all matter, and none of that is captured by either model. VO2 max itself is also not the
                  same thing as race performance: pacing, fueling, and mechanical efficiency all still matter
                  independently of aerobic capacity. Treat every result here as a population-level estimate from a
                  published model, not a laboratory measurement or a personalized physiological assessment.
                </p>
              </div>
            </details>
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Planning pace or fueling for a specific race that happens to be at altitude, and want heat, humidity, wind,
        and elevation change accounted for too, not just altitude on its own? The{" "}
        <Link
          href="/environmental-calculator"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Environmental Performance Calculator
        </Link>{" "}
        combines all of those into one equivalent time for an actual course -- and shares this page&rsquo;s own
        pace/time altitude model, so the two agree on altitude&rsquo;s share of the result.
      </p>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Want the physiology behind VO2 max itself, or how it&rsquo;s used to predict training paces? See{" "}
        <Link
          href="/exercise-physiology"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Exercise Physiology
        </Link>{" "}
        and the{" "}
        <Link
          href="/cv-threshold-calculator"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Threshold, CV &amp; VO2 Max Pace Calculator
        </Link>
        .
      </p>
    </div>
  );
}
