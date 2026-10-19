"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";

import { ContentCallout } from "@/components/content-callout";
import { FitnessModelComparisonNote } from "@/components/fitness-model-comparison-note";
import { SaveCalculationButton } from "@/components/save-calculation-button";
import { LabeledInput } from "@/components/ui/labeled-input";
import {
  type CvPiecesModel,
  type EstimateMode,
  extrapolationNote,
  predictSpeeds,
  type RangeLevel,
  selectTrainingPaces,
  speedInModelRange,
  uncertaintyRangeMS,
} from "@/lib/cv-threshold-math";
import { fieldClass, labelClass } from "@/lib/form-styles";
import {
  PACE_UNIT_LABEL,
  PACE_UNIT_METERS,
  formatPaceOutput,
  type PaceUnit,
} from "@/lib/pace-percent-math";
import { parseTimeToSeconds } from "@/lib/running-format";
import { usePersistedField, usePersistedJSON } from "@/lib/use-persisted-field";
import {
  detailsBodyClass,
  detailsClass,
  sectionLabelClass,
  segmentedButtonClass,
  statCardClass,
  statLabelClass,
  summaryClass,
} from "@/lib/tool-styles";

type DistanceKey = "800m" | "1000m" | "1200m" | "1500m" | "1600m" | "mile" | "3000m" | "3200m" | "2mile" | "4k" | "5k" | "6k" | "8k" | "10k" | "custom";
type CustomUnit = "m" | "mi" | "km";

type DistanceOption = { key: DistanceKey; label: string; meters: number };

const DISTANCE_OPTIONS: DistanceOption[] = [
  { key: "800m", label: "800m", meters: 800 },
  { key: "1000m", label: "1000m", meters: 1000 },
  { key: "1200m", label: "1200m", meters: 1200 },
  { key: "1500m", label: "1500m", meters: 1500 },
  { key: "1600m", label: "1600m", meters: 1600 },
  { key: "mile", label: "1 Mile", meters: 1609.344 },
  { key: "3000m", label: "3000m", meters: 3000 },
  { key: "3200m", label: "3200m", meters: 3200 },
  { key: "2mile", label: "2 Mile", meters: 3218.688 },
  { key: "4k", label: "4K", meters: 4000 },
  { key: "5k", label: "5K", meters: 5000 },
  { key: "6k", label: "6K", meters: 6000 },
  { key: "8k", label: "8K", meters: 8000 },
  { key: "10k", label: "10K", meters: 10000 },
];

const CUSTOM_UNIT_METERS: Record<CustomUnit, number> = { m: 1, mi: 1609.344, km: 1000 };
const OUTPUT_UNITS: PaceUnit[] = ["mi", "km", "400m", "200m"];
const MODEL_URL = "/data/cv-threshold-pieces-v2026-09-05.json";
const STORAGE_KEY = "haarchive-cv-threshold-calculator-state";
const RANGE_OPTIONS: (RangeLevel | "off")[] = [80, 90, 95, "off"];

type PersistedState = {
  distanceKey: DistanceKey;
  customInput: string;
  customUnit: CustomUnit;
  timeInput: string;
  mode: EstimateMode;
  rangeLevel: RangeLevel | "off";
  outputUnit: PaceUnit;
  showMethodology: boolean;
};

// Fetched once and cached at module scope -- 210KB of pre-fit spline
// coefficients has no reason to ever be re-requested within a session, and
// keeping it out of the component's own static imports means it's never
// bundled into the shared client JS every other page on the site would
// otherwise pay for (this tool lives behind the same catch-all route as
// every other Foundations section).
let modelPromise: Promise<CvPiecesModel> | null = null;
function loadModel(): Promise<CvPiecesModel> {
  if (!modelPromise) {
    modelPromise = fetch(MODEL_URL).then((res) => {
      if (!res.ok) throw new Error(`Failed to load model data (${res.status})`);
      return res.json() as Promise<CvPiecesModel>;
    });
  }
  return modelPromise;
}

function speedToPaceSeconds(speedMS: number, unit: PaceUnit): number {
  return PACE_UNIT_METERS[unit] / speedMS;
}

type PaceRowProps = {
  label: string;
  description: string;
  paceSeconds: number;
  unit: PaceUnit;
  rangeSeconds?: { fastSeconds: number; slowSeconds: number };
  rangeLevel: RangeLevel;
  learnMoreHref: string;
  // Threshold and VO2max shift in OPPOSITE directions under "safe estimate"
  // mode (threshold gets slower, VO2max gets faster) -- without calling
  // that out right next to the number, a safe-mode VO2max pace that's
  // faster than the median-mode one reads as a bug, not the deliberately
  // conservative estimate it actually is. CV has no such note: it doesn't
  // change with mode at all.
  safeModeNote?: string;
};

function PaceRow({ label, description, paceSeconds, unit, rangeSeconds, rangeLevel, learnMoreHref, safeModeNote }: PaceRowProps) {
  return (
    <div className={statCardClass}>
      <p className={statLabelClass}>{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
        {formatPaceOutput(paceSeconds, unit)}
        {PACE_UNIT_LABEL[unit]}
      </p>
      {rangeSeconds && (
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
          {rangeLevel}% range: {formatPaceOutput(rangeSeconds.fastSeconds, unit)}–{formatPaceOutput(rangeSeconds.slowSeconds, unit)}
          {PACE_UNIT_LABEL[unit]}
        </p>
      )}
      {safeModeNote && (
        <p className="mt-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">{safeModeNote}</p>
      )}
      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">{description}</p>
      <Link href={learnMoreHref} className="mt-2 inline-block text-xs font-semibold text-zinc-700 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-zinc-200 dark:decoration-white/30 dark:hover:decoration-white">
        Learn why →
      </Link>
    </div>
  );
}

// Threshold, CV, and VO2max training paces predicted from a single race
// performance -- adapted from John Davis's cv-threshold-calculator
// (github.com/johnjdavisiv/cv-threshold-calculator, MIT licensed). This is
// the v2 (2026-09-05) model: a sinh-arcsinh distributional GAM fit on
// 613,889 real race performances (see lib/cv-threshold-math.ts for the
// full model description), which is why it returns a percentile range
// rather than one number -- two runners with an identical race time
// genuinely can have different threshold/CV/VO2max paces depending on
// their aerobic/anaerobic orientation.
export function CvThresholdCalculator() {
  const baseId = useId();
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const [model, setModel] = useState<CvPiecesModel | null>(null);
  const [modelError, setModelError] = useState(false);

  useEffect(() => {
    loadModel()
      .then(setModel)
      .catch(() => setModelError(true));
  }, []);

  const [distanceKey, setDistanceKey] = usePersistedField<DistanceKey>(persisted?.distanceKey, "5k");
  const [customInput, setCustomInput] = usePersistedField(persisted?.customInput, "5000");
  const [customUnit, setCustomUnit] = usePersistedField<CustomUnit>(persisted?.customUnit, "m");
  const [timeInput, setTimeInput] = usePersistedField(persisted?.timeInput, "18:00");
  const [mode, setMode] = usePersistedField<EstimateMode>(persisted?.mode, "safe");
  const [rangeLevel, setRangeLevel] = usePersistedField<RangeLevel | "off">(persisted?.rangeLevel, 90);
  const [outputUnit, setOutputUnit] = usePersistedField<PaceUnit>(persisted?.outputUnit, "mi");
  const [showMethodology, setShowMethodology] = usePersistedField(persisted?.showMethodology, false);

  useEffect(() => {
    try {
      const state: PersistedState = {
        distanceKey,
        customInput,
        customUnit,
        timeInput,
        mode,
        rangeLevel,
        outputUnit,
        showMethodology,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage (e.g. private browsing).
    }
  }, [distanceKey, customInput, customUnit, timeInput, mode, rangeLevel, outputUnit, showMethodology]);

  const distanceOption = DISTANCE_OPTIONS.find((d) => d.key === distanceKey);
  const customMeters = Number(customInput) * CUSTOM_UNIT_METERS[customUnit];
  const customValid = customInput.trim() !== "" && Number.isFinite(customMeters) && customMeters > 0;
  const distanceMeters = distanceKey === "custom" ? (customValid ? customMeters : null) : (distanceOption?.meters ?? null);
  const distanceLabel = distanceKey === "custom" ? `${customInput}${customUnit}` : (distanceOption?.label ?? "");

  const timeSeconds = parseTimeToSeconds(timeInput);

  const raceSpeedMS = distanceMeters !== null && timeSeconds !== null && timeSeconds > 0 ? distanceMeters / timeSeconds : null;
  const canPredict = model !== null && raceSpeedMS !== null && speedInModelRange(raceSpeedMS);
  const prediction = canPredict ? predictSpeeds(model, distanceMeters!, timeSeconds!) : null;
  const note = canPredict ? extrapolationNote(model, distanceMeters!, timeSeconds!, distanceLabel) : null;
  const paces = prediction ? selectTrainingPaces(prediction, mode) : null;
  const effectiveRangeLevel: RangeLevel = rangeLevel === "off" ? 90 : rangeLevel;
  const ranges = prediction ? uncertaintyRangeMS(prediction, effectiveRangeLevel) : null;

  return (
    <div className="mt-10 space-y-10">
      <div>
        <p className={sectionLabelClass}>Race performance</p>
        <div className={`${statCardClass} space-y-4`}>
          <div>
            <p className={labelClass}>Distance</p>
            <div className="flex flex-wrap gap-2">
              {DISTANCE_OPTIONS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDistanceKey(d.key)}
                  aria-pressed={distanceKey === d.key}
                  className={segmentedButtonClass(distanceKey === d.key)}
                >
                  {d.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDistanceKey("custom")}
                aria-pressed={distanceKey === "custom"}
                className={segmentedButtonClass(distanceKey === "custom")}
              >
                Custom
              </button>
            </div>
          </div>

          {distanceKey === "custom" && (
            <div>
              <label htmlFor={`${baseId}-custom-dist`} className={labelClass}>
                Custom distance
              </label>
              <div className="flex gap-2">
                <input
                  id={`${baseId}-custom-dist`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={customInput}
                  onChange={(event) => setCustomInput(event.target.value)}
                  className={`w-28 ${fieldClass}`}
                />
                <select
                  aria-label="Custom distance unit"
                  value={customUnit}
                  onChange={(event) => setCustomUnit(event.target.value as CustomUnit)}
                  className={fieldClass}
                >
                  <option value="m">meters</option>
                  <option value="mi">miles</option>
                  <option value="km">kilometers</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <LabeledInput
              id={`${baseId}-time`}
              label="Finish time"
              type="text"
              value={timeInput}
              onChange={(event) => setTimeInput(event.target.value)}
              placeholder="mm:ss"
              autoComplete="off"
              className="w-28"
            />
            {timeSeconds === null && (
              <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">Enter as mm:ss, e.g. 18:00.</p>
            )}
          </div>
        </div>
      </div>

      {modelError && (
        <ContentCallout
          variant="mistake"
          title="Couldn't load the model data"
          text="This calculator depends on a data file that didn't load. Try refreshing the page."
        />
      )}

      {!model && !modelError && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Loading model data…</p>
      )}

      {model && distanceMeters !== null && timeSeconds !== null && !canPredict && (
        <ContentCallout
          variant="mistake"
          title="Outside the model's range"
          text="This performance implies an average speed outside the 2.1-10 m/s range the model can evaluate at all. Double-check the distance and time."
        />
      )}

      {note && (
        <ContentCallout variant="mistake" title="Extrapolated" text={note} />
      )}

      {paces && ranges && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className={sectionLabelClass}>Training paces</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {OUTPUT_UNITS.map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => setOutputUnit(unit)}
                  aria-pressed={outputUnit === unit}
                  className={segmentedButtonClass(outputUnit === unit)}
                >
                  {PACE_UNIT_LABEL[unit]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <div>
              <p className={labelClass}>Estimate</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("safe")}
                  aria-pressed={mode === "safe"}
                  className={segmentedButtonClass(mode === "safe")}
                >
                  Safe estimate
                </button>
                <button
                  type="button"
                  onClick={() => setMode("median")}
                  aria-pressed={mode === "median"}
                  className={segmentedButtonClass(mode === "median")}
                >
                  Median estimate
                </button>
              </div>
            </div>
            <div>
              <p className={labelClass}>Uncertainty range</p>
              <div className="flex gap-2">
                {RANGE_OPTIONS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setRangeLevel(level)}
                    aria-pressed={rangeLevel === level}
                    className={segmentedButtonClass(rangeLevel === level)}
                  >
                    {level === "off" ? "Off" : `${level}%`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <PaceRow
              label="Threshold"
              description="The fastest pace that's still a metabolic steady state: heart rate, lactate, and VO2 hold roughly stable over time."
              paceSeconds={speedToPaceSeconds(paces.thresholdSpeedMS, outputUnit)}
              unit={outputUnit}
              rangeLevel={effectiveRangeLevel}
              rangeSeconds={
                rangeLevel !== "off"
                  ? {
                      fastSeconds: speedToPaceSeconds(ranges.threshold.fastMS, outputUnit),
                      slowSeconds: speedToPaceSeconds(ranges.threshold.slowMS, outputUnit),
                    }
                  : undefined
              }
              learnMoreHref="/exercise-physiology"
              safeModeNote={mode === "safe" ? "Safe estimate: intentionally slower, to reliably stay under threshold." : undefined}
            />
            <PaceRow
              label="CV"
              description="Critical velocity: the exact boundary between sustainable and unsustainable. Always the median estimate, in both modes."
              paceSeconds={speedToPaceSeconds(paces.cvSpeedMS, outputUnit)}
              unit={outputUnit}
              rangeLevel={effectiveRangeLevel}
              rangeSeconds={
                rangeLevel !== "off"
                  ? {
                      fastSeconds: speedToPaceSeconds(ranges.cv.fastMS, outputUnit),
                      slowSeconds: speedToPaceSeconds(ranges.cv.slowMS, outputUnit),
                    }
                  : undefined
              }
              learnMoreHref="/coaching-library/tom-schwartz"
            />
            <PaceRow
              label="VO2 Max"
              description="The slowest pace that reliably drives VO2 up to its max, not a sprint, just the pace where the clock inevitably runs out."
              paceSeconds={speedToPaceSeconds(paces.vo2maxSpeedMS, outputUnit)}
              unit={outputUnit}
              rangeLevel={effectiveRangeLevel}
              rangeSeconds={
                rangeLevel !== "off"
                  ? {
                      fastSeconds: speedToPaceSeconds(ranges.vo2max.fastMS, outputUnit),
                      slowSeconds: speedToPaceSeconds(ranges.vo2max.slowMS, outputUnit),
                    }
                  : undefined
              }
              learnMoreHref="/exercise-physiology#vo2-max-is-two-adaptations-sharing-one-name"
              safeModeNote={mode === "safe" ? "Safe estimate: intentionally faster, to reliably exceed VO2 max." : undefined}
            />
          </div>

          <SaveCalculationButton
            calculatorType="cv-threshold-calculator"
            input={{ distanceKey, customInput, customUnit, timeInput, mode, rangeLevel }}
            output={{
              thresholdPace: `${formatPaceOutput(speedToPaceSeconds(paces.thresholdSpeedMS, outputUnit), outputUnit)}${PACE_UNIT_LABEL[outputUnit]}`,
              cvPace: `${formatPaceOutput(speedToPaceSeconds(paces.cvSpeedMS, outputUnit), outputUnit)}${PACE_UNIT_LABEL[outputUnit]}`,
              vo2maxPace: `${formatPaceOutput(speedToPaceSeconds(paces.vo2maxSpeedMS, outputUnit), outputUnit)}${PACE_UNIT_LABEL[outputUnit]}`,
            }}
            label={`${timeInput} for ${distanceLabel}`}
          />
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
                How the prediction works
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  This is a statistical model, not a formula: a distributional model (one that predicts a full
                  shape, not just an average) fit on 613,889 real race performances across 185,965 athlete
                  seasons, using the critical speed model (the standard physiology method for separating
                  sustainable from unsustainable paces) as its outcome. A surface over distance and time predicts
                  the threshold, CV, and VO2 max pace distribution for a given performance, which is why the
                  result is a range, not one number: two runners with an identical race time can have genuinely
                  different training paces depending on how aerobically or anaerobically oriented they are.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span aria-hidden="true" className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400">
                  ▶
                </span>
                Safe estimate vs. median estimate
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Consider an 18:00 5K runner: the average (median) threshold pace among runners at that level
                  isn&rsquo;t a pace any specific runner is guaranteed to hit, and at that exact pace, any given
                  18:00 5K runner has close to a 50/50 chance of actually being over threshold, not under it. If
                  the goal is a reliable metabolic steady state, a 50/50 shot isn&rsquo;t reliable. That&rsquo;s
                  why threshold pace defaults to a <strong>safe estimate</strong>: the 10th percentile of the
                  threshold-speed distribution, slow enough that roughly 90% of runners at that performance level
                  are genuinely below threshold at it. VO2 max pace uses the same logic in the other direction
                  (the 90th percentile of speed, fast enough that it reliably is unsustainable). CV pace
                  doesn&rsquo;t get a &ldquo;safe&rdquo; direction: it&rsquo;s defined as the 50/50 boundary
                  itself, so it&rsquo;s always the median in both modes. Switching to median estimate mode gives
                  the 50th percentile for all three, closer to what a traditional (non-uncertainty-aware)
                  calculator would show. The uncertainty range shown alongside each pace (80/90/95%, or hidden
                  entirely) is a separate choice from safe/median: it&rsquo;s how wide a band to display, not which
                  point estimate to use.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span aria-hidden="true" className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400">
                  ▶
                </span>
                Why VO2 Max pace is slower than you might expect
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Older calculators define &ldquo;VO2 max pace&rdquo; as the speed reached at the end of a
                  lab-based treadmill ramp test, but that number is heavily dependent on the specific ramp
                  protocol used, and around half of runners (even elite ones) never actually reach a true VO2
                  plateau during one at all. Any pace faster than steady-state max will eventually drive VO2 to
                  its ceiling: it&rsquo;s just a question of how long that takes (a mile at mile pace, five kilometers
                  at 5K pace). This calculator instead defines VO2 max pace as the <em>slowest</em> pace that
                  reliably produces that outcome, which in practice comes out close to 5K pace rather than a much
                  faster, ramp-test-specific number.
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
                  The model&rsquo;s real fitted range spans 800m to 10K, at times from about 2:00 (a fast 800m)
                  out to 60:00 (a slow 10K) -- outside that, results are extrapolated, and this calculator flags
                  it by name (e.g. &ldquo;few runners in our dataset ran slower than 30:00 for 5 km&rdquo;) rather
                  than a generic warning. Unlike the version of this model this codebase originally ported, the
                  current one (2026-09-05) doesn&rsquo;t take age as an input at all -- it&rsquo;s fit at a fixed
                  &ldquo;college&rdquo; competitive level, so an age-adjustable prediction genuinely isn&rsquo;t
                  something this model (or the source calculator) offers anymore.
                </p>
                <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
                  <h3 className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
                    Source
                  </h3>
                  <p className="mt-2 text-xs">
                    Adapted from John Davis&rsquo;s{" "}
                    <a
                      href="https://apps.runningwritings.com/cv-threshold-calculator/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-900 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
                    >
                      threshold/CV/VO2 max pace calculator
                    </a>{" "}
                    (Running Writings, MIT licensed): same underlying model data, rebuilt with a plain-text entry
                    and saved-result support.
                  </p>
                </div>
              </div>
            </details>
          </div>
        )}
      </div>

      <FitnessModelComparisonNote current="cv-threshold" />

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Following a percentage-based plan instead? The{" "}
        <Link
          href="/pace-percent-calculator"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Pace Percent Calculator
        </Link>{" "}
        turns any of these paces into a percentage-based workout target.
      </p>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Want to convert one of these paces into a race time (or the reverse)? The{" "}
        <Link
          href="/race-pace-calculator"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Race Pace Calculator
        </Link>{" "}
        handles that conversion for any distance.
      </p>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        These predictions come from your own race performance. For population-level reference ranges of where
        LT1 and LT2 fall on a heart rate monitor instead, see the{" "}
        <Link
          href="/hr-threshold-calculator"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          LT1 &amp; LT2 Heart Rate Reference Ranges
        </Link>
        .
      </p>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Ready to put these paces into a full marathon build? See the{" "}
        <Link
          href="/training-plans"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Training Plans
        </Link>{" "}
        library.
      </p>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Want to see your critical speed play out mile-by-mile on race day (terrain, weather, and fueling durability
        included), rather than another set of training paces? The{" "}
        <Link
          href="/marathon-pacing-calculator"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Marathon Pacing Calculator
        </Link>{" "}
        uses this same fitness model to build a full race-day pacing plan.
      </p>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        <Link
          href="/workout-builder"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Build a workout with these paces →
        </Link>
      </p>

    </div>
  );
}
