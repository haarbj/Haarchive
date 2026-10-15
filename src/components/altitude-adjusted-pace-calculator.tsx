"use client";

import { useId } from "react";
import Link from "next/link";

import { ContentCallout } from "@/components/content-callout";
import { SaveCalculationButton } from "@/components/save-calculation-button";
import { convertPerformanceBetweenAltitudes, feetToMeters, metersToFeet } from "@/lib/altitude-adjusted-pace-math";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { formatPaceOutput, PACE_UNIT_LABEL, PACE_UNIT_METERS, parsePaceInput, type PaceUnit } from "@/lib/pace-percent-math";
import { MILE_METERS, RACE_DISTANCES } from "@/lib/race-distances";
import { formatClock, parseTimeToSeconds } from "@/lib/running-format";
import {
  detailsBodyClass,
  detailsClass,
  heroCardClass,
  segmentedButtonClass,
  statLabelClass,
  summaryClass,
} from "@/lib/tool-styles";
import { usePersistedField, usePersistedJSON } from "@/lib/use-persisted-field";

const STORAGE_KEY = "haarchive-altitude-adjusted-pace-calculator-state";

type EntryMode = "result" | "pace";
type AltUnit = "ft" | "m";
type HomeMode = "sea" | "same" | "other";
type TargetMode = "sea" | "home" | "other";

// The tool's own extrapolation warning applies beyond its real fitted
// range (see docs/altitude-adjusted-pace-reverse-engineering-report.md
// Step 2/4 -- the model is fit against 5,000m+ distances and holds flat
// beyond that, but this matches the source calculator's own stated
// caution threshold for how far a short-distance input is being
// projected).
const EXTRAPOLATION_DISTANCE_METERS = 10000;
const HIGH_ALTITUDE_FT = 8000;

type PersistedState = {
  distanceKey: string;
  customDistanceInput: string;
  useCustomDistance: boolean;
  entryMode: EntryMode;
  timeInput: string;
  paceInput: string;
  paceUnit: PaceUnit;
  altUnit: AltUnit;
  venueInput: string;
  homeMode: HomeMode;
  homeInput: string;
  targetMode: TargetMode;
  targetInput: string;
  showMethodology: boolean;
};

const DEFAULT_DISTANCE_KEY = "5k";
const DEFAULT_TIME = "18:40";
const DEFAULT_VENUE_FT = "5000";

export function AltitudeAdjustedPaceCalculator() {
  const baseId = useId();
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const [distanceKey, setDistanceKey] = usePersistedField(persisted?.distanceKey, DEFAULT_DISTANCE_KEY);
  const [customDistanceInput, setCustomDistanceInput] = usePersistedField(persisted?.customDistanceInput, "5000");
  const [useCustomDistance, setUseCustomDistance] = usePersistedField(persisted?.useCustomDistance, false);
  const [entryMode, setEntryMode] = usePersistedField<EntryMode>(persisted?.entryMode, "result");
  const [timeInput, setTimeInput] = usePersistedField(persisted?.timeInput, DEFAULT_TIME);
  const [paceInput, setPaceInput] = usePersistedField(persisted?.paceInput, "6:00");
  const [paceUnit, setPaceUnit] = usePersistedField<PaceUnit>(persisted?.paceUnit, "mi");
  const [altUnit, setAltUnit] = usePersistedField<AltUnit>(persisted?.altUnit, "ft");
  const [venueInput, setVenueInput] = usePersistedField(persisted?.venueInput, DEFAULT_VENUE_FT);
  const [homeMode, setHomeMode] = usePersistedField<HomeMode>(persisted?.homeMode, "sea");
  const [homeInput, setHomeInput] = usePersistedField(persisted?.homeInput, "0");
  const [targetMode, setTargetMode] = usePersistedField<TargetMode>(persisted?.targetMode, "sea");
  const [targetInput, setTargetInput] = usePersistedField(persisted?.targetInput, "0");
  const [showMethodology, setShowMethodology] = usePersistedField(persisted?.showMethodology, false);

  function handleAltUnitChange(next: AltUnit) {
    if (next === altUnit) return;
    const convert = (input: string, setInput: (v: string) => void) => {
      const parsed = Number(input);
      if (Number.isFinite(parsed)) {
        const converted = next === "m" ? feetToMeters(parsed) : metersToFeet(parsed);
        setInput(String(Math.round(converted)));
      }
    };
    convert(venueInput, setVenueInput);
    convert(homeInput, setHomeInput);
    convert(targetInput, setTargetInput);
    setAltUnit(next);
  }

  const namedDistance = RACE_DISTANCES.find((d) => d.key === distanceKey) ?? RACE_DISTANCES.find((d) => d.key === "5k")!;
  const customDistanceMeters = Math.max(1, Number(customDistanceInput) || 0);
  const distanceMeters = useCustomDistance ? customDistanceMeters : namedDistance.meters;
  const distanceLabel = useCustomDistance ? `${customDistanceInput}m` : namedDistance.label;

  const resultTimeSeconds = parseTimeToSeconds(timeInput);
  const paceSeconds = parsePaceInput(paceInput, paceUnit);
  const timeFromPace = paceSeconds !== null ? paceSeconds * (distanceMeters / PACE_UNIT_METERS[paceUnit]) : null;
  const timeSeconds = entryMode === "result" ? resultTimeSeconds : timeFromPace;

  const toMeters = (v: string) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return NaN;
    return altUnit === "ft" ? feetToMeters(n) : n;
  };
  const venueAltitudeMeters = toMeters(venueInput);
  const homeAltitudeMeters = homeMode === "sea" ? 0 : homeMode === "same" ? venueAltitudeMeters : toMeters(homeInput);
  const targetAltitudeMeters =
    targetMode === "sea" ? 0 : targetMode === "home" ? homeAltitudeMeters : toMeters(targetInput);

  const inputsValid =
    timeSeconds !== null &&
    timeSeconds > 0 &&
    Number.isFinite(venueAltitudeMeters) &&
    Number.isFinite(homeAltitudeMeters) &&
    Number.isFinite(targetAltitudeMeters);

  const predictedSeconds = inputsValid
    ? convertPerformanceBetweenAltitudes({
        distanceMeters,
        timeSeconds: timeSeconds!,
        venueAltitudeMeters,
        homeAltitudeMeters,
        targetAltitudeMeters,
      })
    : null;

  const predictedPaceMi = predictedSeconds !== null ? predictedSeconds / (distanceMeters / MILE_METERS) : null;
  const predictedPaceKm = predictedSeconds !== null ? predictedSeconds / (distanceMeters / PACE_UNIT_METERS.km) : null;

  const unitLabel = altUnit === "ft" ? "ft" : "m";
  const targetAltLabel =
    targetMode === "sea"
      ? "sea level"
      : targetMode === "home"
        ? "your home altitude"
        : `${targetInput || 0} ${unitLabel}`;

  const venueFtForWarning = altUnit === "ft" ? Number(venueInput) : metersToFeet(Number(venueInput) || 0);
  const targetFtForWarning =
    targetMode === "other" ? (altUnit === "ft" ? Number(targetInput) : metersToFeet(Number(targetInput) || 0)) : 0;
  const showHighAltitudeWarning =
    Number.isFinite(venueFtForWarning) &&
    (venueFtForWarning > HIGH_ALTITUDE_FT || (targetMode === "other" && targetFtForWarning > HIGH_ALTITUDE_FT));
  const showExtrapolationWarning = distanceMeters > EXTRAPOLATION_DISTANCE_METERS;

  return (
    <div className="mt-10 space-y-10">
      <div className="flex flex-wrap gap-6">
        <div>
          <label htmlFor={`${baseId}-distance`} className={labelClass}>
            Distance
          </label>
          {!useCustomDistance ? (
            <select
              id={`${baseId}-distance`}
              value={distanceKey}
              onChange={(event) => setDistanceKey(event.target.value)}
              className={`mt-1 w-40 ${fieldClass}`}
            >
              {RACE_DISTANCES.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <input
                id={`${baseId}-distance`}
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

        <div>
          <div className="flex items-center gap-3">
            <label className={labelClass}>Performance</label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setEntryMode("result")}
                aria-pressed={entryMode === "result"}
                className={segmentedButtonClass(entryMode === "result")}
              >
                Result
              </button>
              <button
                type="button"
                onClick={() => setEntryMode("pace")}
                aria-pressed={entryMode === "pace"}
                className={segmentedButtonClass(entryMode === "pace")}
              >
                Pace
              </button>
            </div>
          </div>
          {entryMode === "result" ? (
            <input
              id={`${baseId}-time`}
              type="text"
              value={timeInput}
              onChange={(event) => setTimeInput(event.target.value)}
              placeholder="mm:ss"
              autoComplete="off"
              className={`mt-1 w-28 ${fieldClass}`}
            />
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <input
                id={`${baseId}-pace`}
                type="text"
                value={paceInput}
                onChange={(event) => setPaceInput(event.target.value)}
                placeholder="mm:ss"
                autoComplete="off"
                className={`w-24 ${fieldClass}`}
              />
              <div className="flex gap-1">
                {(["mi", "km", "400m", "200m"] as PaceUnit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setPaceUnit(u)}
                    aria-pressed={paceUnit === u}
                    className={segmentedButtonClass(paceUnit === u)}
                  >
                    {PACE_UNIT_LABEL[u]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={labelClass}>Altitude unit</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => handleAltUnitChange("ft")}
            aria-pressed={altUnit === "ft"}
            className={segmentedButtonClass(altUnit === "ft")}
          >
            feet
          </button>
          <button
            type="button"
            onClick={() => handleAltUnitChange("m")}
            aria-pressed={altUnit === "m"}
            className={segmentedButtonClass(altUnit === "m")}
          >
            meters
          </button>
        </div>
      </div>

      <div>
        <label htmlFor={`${baseId}-venue`} className={labelClass}>
          Altitude where this performance was run
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id={`${baseId}-venue`}
            type="number"
            inputMode="numeric"
            value={venueInput}
            onChange={(event) => setVenueInput(event.target.value)}
            className={`w-28 ${fieldClass}`}
          />
          <span className="text-sm text-zinc-600 dark:text-zinc-300">{unitLabel}</span>
        </div>
      </div>

      <div>
        <p className={labelClass}>Your home (living) altitude</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
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
            Same as venue
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
                inputMode="numeric"
                value={homeInput}
                onChange={(event) => setHomeInput(event.target.value)}
                className={`w-24 ${fieldClass}`}
              />
              <span className="text-sm text-zinc-600 dark:text-zinc-300">{unitLabel}</span>
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
          Acclimation to where you actually live reduces (but never fully removes) altitude&rsquo;s effect.
          &ldquo;Same as venue&rdquo; models a full-time local resident, fully acclimated to this altitude.
        </p>
      </div>

      <div>
        <p className={labelClass}>Convert to</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
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
                inputMode="numeric"
                value={targetInput}
                onChange={(event) => setTargetInput(event.target.value)}
                className={`w-24 ${fieldClass}`}
              />
              <span className="text-sm text-zinc-600 dark:text-zinc-300">{unitLabel}</span>
            </div>
          )}
        </div>
      </div>

      {(showHighAltitudeWarning || showExtrapolationWarning) && (
        <div className="space-y-3">
          {showHighAltitudeWarning && (
            <ContentCallout
              variant="mistake"
              title="High altitude"
              text="Altitudes above 8,000ft are rare in the data this model was fit on. Results at this altitude may be less accurate."
            />
          )}
          {showExtrapolationWarning && (
            <ContentCallout
              variant="mistake"
              title="Extrapolated distance"
              text="Altitude effects for races longer than 10km are extrapolated from shorter races. Results may be less reliable."
            />
          )}
        </div>
      )}

      {predictedSeconds !== null ? (
        <div>
          <p className={statLabelClass}>Equivalent effort at {targetAltLabel}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div className={heroCardClass}>
              <p className={statLabelClass}>{distanceLabel} time</p>
              <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-white">
                {formatClock(predictedSeconds)}
              </p>
            </div>
            <div className={heroCardClass}>
              <p className={statLabelClass}>Pace</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
                {formatPaceOutput(predictedPaceMi!, "mi")}
                {PACE_UNIT_LABEL.mi}
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                {formatPaceOutput(predictedPaceKm!, "km")}
                {PACE_UNIT_LABEL.km}
              </p>
            </div>
          </div>

          <SaveCalculationButton
            calculatorType="altitude-adjusted-pace"
            input={{
              distanceMeters,
              entryMode,
              timeSeconds,
              venueAltitudeMeters,
              homeMode,
              homeAltitudeMeters,
              targetMode,
              targetAltitudeMeters,
            }}
            output={{ predictedSeconds, predictedPaceMi, predictedPaceKm }}
            label={`${distanceLabel} at ${Math.round(metersToFeet(venueAltitudeMeters))}ft -> ${targetAltLabel}`}
          />
        </div>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Enter a valid {entryMode === "result" ? "time (mm:ss)" : "pace (mm:ss)"} to see a conversion.
        </p>
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
                <span
                  aria-hidden="true"
                  className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                >
                  ▶
                </span>
                How this differs from the site&rsquo;s Altitude Calculator
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  This tool converts one specific performance between two altitudes, using a model fit directly
                  from real collected outputs of a specific third-party calculator (see Source below). The{" "}
                  <Link href="/altitude-calculator" className="underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white">
                    Altitude Calculator
                  </Link>{" "}
                  elsewhere on this site answers a related but different question &mdash; what percentage of
                  sea-level VO2 max/aerobic capacity is available at a given altitude &mdash; from cited,
                  published exercise-physiology research. They&rsquo;re both legitimate, genuinely different
                  models; use whichever answers the question you actually have.
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
                Limitations
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Validated to a median error under 1 second and worst-case error around 100 seconds (under 1%)
                  across 825 real collected performances spanning 400m to the marathon and 0&ndash;12,000ft.
                  The single worst-case errors are extreme, rare combinations &mdash; a multi-hour effort at a
                  very high (10,000ft+) altitude for a runner who also lives at that altitude. Above 8,000ft or
                  beyond a 10km input distance, the source calculator itself flags results as less reliable
                  (extrapolated beyond its own real fitted range) &mdash; this tool surfaces the same warnings.
                </p>
                <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
                  <h3 className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
                    Source
                  </h3>
                  <p className="mt-2 text-xs">
                    Independently reverse-engineered from John J. Davis&rsquo;s{" "}
                    <a
                      href="https://apps.runningwritings.com/altitude-adjusted-pace/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-900 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
                    >
                      Altitude-Adjusted Pace calculator
                    </a>{" "}
                    (Running Writings): every value above was fit from real collected inputs and outputs, not
                    read from source code.
                  </p>
                </div>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
