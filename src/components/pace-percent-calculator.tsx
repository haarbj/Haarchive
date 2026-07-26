"use client";

import { useEffect, useId } from "react";
import Link from "next/link";

import { SaveCalculationButton } from "@/components/save-calculation-button";
import { fieldClass, labelClass } from "@/lib/form-styles";
import {
  type PaceUnit,
  type PercentBasis,
  type SpeedUnit,
  PACE_UNIT_LABEL,
  SPEED_UNIT_LABEL,
  computeReferencePaceSeconds,
  computeWorkoutPaceSeconds,
  convertPaceSeconds,
  formatPaceOutput as formatPace,
  paceSecondsToSpeed,
  parsePaceInput as parsePace,
} from "@/lib/pace-percent-math";
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

type Mode = "forward" | "reverse";
type ConvertTarget = "none" | PaceUnit | SpeedUnit;

const PACE_UNITS: PaceUnit[] = ["mi", "km", "400m"];
const SPEED_UNITS: SpeedUnit[] = ["mph", "kph", "mps"];
const PERCENT_NUDGES = [-5, -1, 1, 5];
const STORAGE_KEY = "haarchive-pace-percent-calculator-state";

const nudgeButtonClass =
  "rounded-lg border border-black/10 px-2.5 py-1.5 text-sm font-semibold text-zinc-700 transition hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10";

type PersistedState = {
  mode: Mode;
  basis: PercentBasis;
  paceUnit: PaceUnit;
  paceInput: string;
  percentInput: string;
  convertTo: ConvertTarget;
  showMethodology: boolean;
};

// Percentage-based interval training (the method Renato Canova and other
// coaches use to prescribe workout paces as a percentage of a reference
// race pace) -- adapted from John Davis's pace-percents calculator
// (github.com/johnjdavisiv/pace-percents, MIT licensed). See
// lib/pace-percent-math.ts for the core formulas and why percent-of-pace
// and percent-of-speed genuinely differ.
export function PacePercentCalculator() {
  const baseId = useId();
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const [mode, setMode] = usePersistedField<Mode>(persisted?.mode, "forward");
  const [basis, setBasis] = usePersistedField<PercentBasis>(persisted?.basis, "pace");
  const [paceUnit, setPaceUnit] = usePersistedField<PaceUnit>(persisted?.paceUnit, "mi");
  const [paceInput, setPaceInput] = usePersistedField(persisted?.paceInput, "5:00");
  const [percentInput, setPercentInput] = usePersistedField(persisted?.percentInput, "95");
  const [convertTo, setConvertTo] = usePersistedField<ConvertTarget>(persisted?.convertTo, "none");
  const [showMethodology, setShowMethodology] = usePersistedField(persisted?.showMethodology, false);

  useEffect(() => {
    try {
      const state: PersistedState = { mode, basis, paceUnit, paceInput, percentInput, convertTo, showMethodology };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage (e.g. private browsing).
    }
  }, [mode, basis, paceUnit, paceInput, percentInput, convertTo, showMethodology]);

  function nudgePercent(delta: number) {
    const current = percentValid ? percentRaw : 100;
    setPercentInput(String(Math.min(300, Math.max(1, current + delta))));
  }

  const knownSeconds = parsePace(paceInput, paceUnit);
  const percentRaw = Number(percentInput);
  const percentValid = percentInput.trim() !== "" && Number.isFinite(percentRaw) && percentRaw > 0 && percentRaw <= 300;

  const resultSeconds =
    knownSeconds !== null && percentValid
      ? mode === "forward"
        ? computeWorkoutPaceSeconds(knownSeconds, percentRaw, basis)
        : computeReferencePaceSeconds(knownSeconds, percentRaw, basis)
      : null;
  const resultValid = resultSeconds !== null && Number.isFinite(resultSeconds) && resultSeconds > 0;

  const convertedValue =
    resultValid && convertTo !== "none"
      ? PACE_UNITS.includes(convertTo as PaceUnit)
        ? formatPace(convertPaceSeconds(resultSeconds, paceUnit, convertTo as PaceUnit), convertTo as PaceUnit)
        : paceSecondsToSpeed(resultSeconds, paceUnit, convertTo as SpeedUnit).toFixed(
            convertTo === "mps" ? 2 : 1,
          )
      : null;

  return (
    <div className="mt-10 space-y-10">
      <div>
        <p className={sectionLabelClass}>Setup</p>
        <div className={`${statCardClass} flex flex-wrap gap-6`}>
          <div className="min-w-[220px]">
            <p className={labelClass}>What are you solving for?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("forward")}
                aria-pressed={mode === "forward"}
                className={segmentedButtonClass(mode === "forward")}
              >
                Workout pace
              </button>
              <button
                type="button"
                onClick={() => setMode("reverse")}
                aria-pressed={mode === "reverse"}
                className={segmentedButtonClass(mode === "reverse")}
              >
                Reference pace
              </button>
            </div>
            <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
              {mode === "forward"
                ? "Find the workout pace that's a given percentage of a reference pace (e.g. 5K pace)."
                : "You ran a workout at a known percentage — back-solve what reference pace that implies."}
            </p>
          </div>

          <div className="min-w-[220px]">
            <p className={labelClass}>Percent of pace, or percent of speed?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBasis("pace")}
                aria-pressed={basis === "pace"}
                className={segmentedButtonClass(basis === "pace")}
              >
                % of pace
              </button>
              <button
                type="button"
                onClick={() => setBasis("speed")}
                aria-pressed={basis === "speed"}
                className={segmentedButtonClass(basis === "speed")}
              >
                % of speed
              </button>
            </div>
            <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
              {basis === "pace"
                ? "Canova's own convention — evenly spaced in pace, e.g. every 10% step from a 5:00 pace is a fixed 30 seconds."
                : "The inverse-proportion version most exercise science uses — evenly spaced in speed instead."}
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className={sectionLabelClass}>Your numbers</p>
        <div className={`${statCardClass} flex flex-wrap gap-6`}>
          <div className="min-w-0">
            <label htmlFor={`${baseId}-pace`} className={labelClass}>
              {mode === "forward" ? "Reference pace" : "Pace you actually ran"}
            </label>
            <div className="flex gap-2">
              <input
                id={`${baseId}-pace`}
                type="text"
                value={paceInput}
                onChange={(event) => setPaceInput(event.target.value)}
                placeholder={paceUnit === "400m" ? "seconds or mm:ss" : "mm:ss"}
                autoComplete="off"
                className={`w-32 ${fieldClass}`}
              />
              <select
                aria-label="Pace unit"
                value={paceUnit}
                onChange={(event) => setPaceUnit(event.target.value as PaceUnit)}
                className={fieldClass}
              >
                {PACE_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {PACE_UNIT_LABEL[unit]}
                  </option>
                ))}
              </select>
            </div>
            {knownSeconds === null && (
              <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                {paceUnit === "400m" ? "Enter as seconds (e.g. 78) or mm:ss." : "Enter as mm:ss, e.g. 5:00."}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={`${baseId}-percent`} className={labelClass}>
              Percent
            </label>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {PERCENT_NUDGES.filter((delta) => delta < 0).map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => nudgePercent(delta)}
                    className={nudgeButtonClass}
                    title={`${delta}%`}
                  >
                    {delta}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  id={`${baseId}-percent`}
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={300}
                  value={percentInput}
                  onChange={(event) => setPercentInput(event.target.value)}
                  className={`w-20 ${fieldClass}`}
                />
                <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">%</span>
              </div>
              <div className="flex gap-1">
                {PERCENT_NUDGES.filter((delta) => delta > 0).map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => nudgePercent(delta)}
                    className={nudgeButtonClass}
                    title={`+${delta}%`}
                  >
                    +{delta}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className={sectionLabelClass}>Result</p>
        <div className={heroCardClass}>
          {resultValid ? (
            <>
              <p className={statLabelClass}>
                {mode === "forward" ? `${percentInput}% of your reference pace` : "Implied reference pace"}
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
                {formatPace(resultSeconds, paceUnit)}
                {PACE_UNIT_LABEL[paceUnit]}
              </p>
              <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
                {mode === "forward"
                  ? `${percentInput}% of ${formatPace(knownSeconds!, paceUnit)}${PACE_UNIT_LABEL[paceUnit]} (${basis === "pace" ? "percent of pace" : "percent of speed"}) is ${formatPace(resultSeconds, paceUnit)}${PACE_UNIT_LABEL[paceUnit]}.`
                  : `${formatPace(knownSeconds!, paceUnit)}${PACE_UNIT_LABEL[paceUnit]} is ${percentInput}% (${basis === "pace" ? "percent of pace" : "percent of speed"}) of ${formatPace(resultSeconds, paceUnit)}${PACE_UNIT_LABEL[paceUnit]}.`}
              </p>

              <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/10">
                <label htmlFor={`${baseId}-convert`} className={labelClass}>
                  Also show this pace as
                </label>
                <select
                  id={`${baseId}-convert`}
                  value={convertTo}
                  onChange={(event) => setConvertTo(event.target.value as ConvertTarget)}
                  className={fieldClass}
                >
                  <option value="none">—</option>
                  {PACE_UNITS.filter((unit) => unit !== paceUnit).map((unit) => (
                    <option key={unit} value={unit}>
                      {PACE_UNIT_LABEL[unit]}
                    </option>
                  ))}
                  {SPEED_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {SPEED_UNIT_LABEL[unit]}
                    </option>
                  ))}
                </select>
                {convertedValue && (
                  <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">
                    {convertedValue}
                    {PACE_UNITS.includes(convertTo as PaceUnit) ? PACE_UNIT_LABEL[convertTo as PaceUnit] : ` ${SPEED_UNIT_LABEL[convertTo as SpeedUnit]}`}
                  </p>
                )}
                <p className="mt-1.5 text-[10.5px] text-zinc-600 dark:text-zinc-300">
                  Unit conversion never changes the percentage math above — 90% of 5:00/mi is 5:30/mi regardless
                  of which unit it&rsquo;s displayed in.
                </p>
              </div>

              <SaveCalculationButton
                calculatorType="pace-percent-calculator"
                input={{ mode, basis, paceUnit, paceInput, percentInput }}
                output={{ resultSeconds, resultPace: `${formatPace(resultSeconds, paceUnit)}${PACE_UNIT_LABEL[paceUnit]}` }}
                label={`${percentInput}% ${basis === "pace" ? "of pace" : "of speed"} — ${formatPace(knownSeconds!, paceUnit)}${PACE_UNIT_LABEL[paceUnit]}`}
              />
            </>
          ) : (
            <p className="text-sm text-zinc-700 dark:text-zinc-200">
              Enter a valid pace and a percentage between 1 and 300 to see a result.
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
                Percent of pace vs. percent of speed
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Pace and speed are inverses of each other, so these are genuinely different formulas, not two
                  ways of writing the same math. Percent of pace is defined to be linear and symmetric in pace
                  units — 90% of a 5:00 pace is 5:30, and 80% is 6:00, a fixed 30-second step each time regardless
                  of the reference pace. That symmetry is why Renato Canova and other coaches who use
                  percentage-based workouts default to percent of pace: a given percentage gap feels like a
                  consistent effort jump whether the reference pace is fast or slow. Percent of speed is the
                  more intuitive inverse-proportion version (resultPace = referencePace ÷ percent) — evenly
                  spaced in speed instead, which is closer to how exercise-science research usually expresses
                  intensity.
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
                Reference benchmarks
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  A few approximate, physiologically-based markers worth knowing (all as a percent of 5K pace,
                  percent-of-pace basis): critical velocity is roughly 95%, lactate threshold is roughly 91–92%,
                  and aerobic threshold is roughly 85%. The &ldquo;5% rule&rdquo; is a related rule of thumb — a
                  well-trained runner slows by roughly 5% for every doubling of race distance, so 10K pace is
                  about 95% of 5K pace, half marathon pace is about 90% of 5K pace (95% of 10K pace), and
                  marathon pace is about 95% of half marathon pace (90% of 10K pace). All of these shift with
                  individual training status and event specialization — treat them as reference points, not
                  fixed rules.
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
                Source and limitations
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Adapted from John Davis&rsquo;s{" "}
                  <a
                    href="https://apps.runningwritings.com/pace-percent/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-900 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
                  >
                    pace percentage calculator
                  </a>{" "}
                  (Running Writings, MIT licensed), rebuilt for Haarchive with a plain-text pace entry, direct
                  percent entry, and saved-result support. This tool only does the arithmetic — it doesn&rsquo;t
                  know your training history, so a percentage that&rsquo;s appropriate for one runner&rsquo;s
                  reference pace may be too hard or too easy for another&rsquo;s, especially at the extremes
                  (below about 80% or above about 105%).
                </p>
              </div>
            </details>
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Want to see how percentage-based training fits into a whole system? Renato Canova&rsquo;s marathon
        &ldquo;special blocks&rdquo; in the{" "}
        <Link
          href="/coaching-library/canova"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Coaching Library
        </Link>{" "}
        are built almost entirely around this kind of percentage-of-pace prescription, and{" "}
        <Link
          href="/exercise-physiology"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Exercise Physiology
        </Link>{" "}
        has a similar percent-of-threshold table for race-pace prediction.
      </p>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Not sure what your actual reference pace should be? The{" "}
        <Link
          href="/cv-threshold-calculator"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Threshold, CV &amp; VO2max Pace Calculator
        </Link>{" "}
        predicts threshold, CV, and VO2max paces (with uncertainty ranges) from a single race performance.
      </p>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Need a plain pace-to-time conversion first? The{" "}
        <Link
          href="/race-pace-calculator"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Race Pace Calculator
        </Link>{" "}
        converts between a goal race time and the pace required to run it.
      </p>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Looking for a full marathon build using this kind of percentage-based prescription? See the{" "}
        <Link
          href="/training-plans"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Training Plans
        </Link>{" "}
        library.
      </p>
    </div>
  );
}
