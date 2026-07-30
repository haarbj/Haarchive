"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";

import { ContentCallout } from "@/components/content-callout";
import { FitnessModelComparisonNote } from "@/components/fitness-model-comparison-note";
import { SaveCalculationButton } from "@/components/save-calculation-button";
import { LabeledInput } from "@/components/ui/labeled-input";
import {
  type CvThresholdModel,
  type EstimateMode,
  isWithinModelDomain,
  predictSpeeds,
  selectTrainingPaces,
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
const MODEL_URL = "/data/cv-threshold-model.json";
const STORAGE_KEY = "haarchive-cv-threshold-calculator-state";

type PersistedState = {
  distanceKey: DistanceKey;
  customInput: string;
  customUnit: CustomUnit;
  timeInput: string;
  ageInput: string;
  mode: EstimateMode;
  showUncertainty: boolean;
  outputUnit: PaceUnit;
  showMethodology: boolean;
};

// Fetched once and cached at module scope -- 693KB of pre-fit model
// coefficients has no reason to ever be re-requested within a session, and
// keeping it out of the component's own static imports means it's never
// bundled into the shared client JS every other page on the site would
// otherwise pay for (this tool lives behind the same catch-all route as
// every other Foundations section).
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

function speedToPaceSeconds(speedMS: number, unit: PaceUnit): number {
  return PACE_UNIT_METERS[unit] / speedMS;
}

type PaceRowProps = {
  label: string;
  description: string;
  paceSeconds: number;
  unit: PaceUnit;
  rangeSeconds?: { fastSeconds: number; slowSeconds: number };
  learnMoreHref: string;
  // Threshold and VO2max shift in OPPOSITE directions under "safe estimate"
  // mode (threshold gets slower, VO2max gets faster) -- without calling
  // that out right next to the number, a safe-mode VO2max pace that's
  // faster than the median-mode one reads as a bug, not the deliberately
  // conservative estimate it actually is. CV has no such note: it doesn't
  // change with mode at all.
  safeModeNote?: string;
};

function PaceRow({ label, description, paceSeconds, unit, rangeSeconds, learnMoreHref, safeModeNote }: PaceRowProps) {
  return (
    <div className={statCardClass}>
      <p className={statLabelClass}>{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
        {formatPaceOutput(paceSeconds, unit)}
        {PACE_UNIT_LABEL[unit]}
      </p>
      {rangeSeconds && (
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
          90% range: {formatPaceOutput(rangeSeconds.fastSeconds, unit)}–{formatPaceOutput(rangeSeconds.slowSeconds, unit)}
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
// (github.com/johnjdavisiv/cv-threshold-calculator, MIT licensed). Unlike a
// formula-based pace calculator, this is a statistical model fit on ~8,600
// real race performances (see lib/cv-threshold-math.ts), which is why it
// returns a percentile range rather than one number -- two runners with an
// identical race time genuinely can have different threshold/CV/VO2max
// paces depending on their aerobic/anaerobic orientation.
export function CvThresholdCalculator() {
  const baseId = useId();
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const [model, setModel] = useState<CvThresholdModel | null>(null);
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
  const [ageInput, setAgeInput] = usePersistedField(persisted?.ageInput, "25");
  const [mode, setMode] = usePersistedField<EstimateMode>(persisted?.mode, "safe");
  const [showUncertainty, setShowUncertainty] = usePersistedField(persisted?.showUncertainty, true);
  const [outputUnit, setOutputUnit] = usePersistedField<PaceUnit>(persisted?.outputUnit, "mi");
  const [showMethodology, setShowMethodology] = usePersistedField(persisted?.showMethodology, false);

  useEffect(() => {
    try {
      const state: PersistedState = {
        distanceKey,
        customInput,
        customUnit,
        timeInput,
        ageInput,
        mode,
        showUncertainty,
        outputUnit,
        showMethodology,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage (e.g. private browsing).
    }
  }, [distanceKey, customInput, customUnit, timeInput, ageInput, mode, showUncertainty, outputUnit, showMethodology]);

  const distanceOption = DISTANCE_OPTIONS.find((d) => d.key === distanceKey);
  const customMeters = Number(customInput) * CUSTOM_UNIT_METERS[customUnit];
  const customValid = customInput.trim() !== "" && Number.isFinite(customMeters) && customMeters > 0;
  const distanceMeters = distanceKey === "custom" ? (customValid ? customMeters : null) : (distanceOption?.meters ?? null);

  const timeSeconds = parseTimeToSeconds(timeInput);
  const ageRaw = Number(ageInput);
  const ageValid = ageInput.trim() !== "" && Number.isFinite(ageRaw) && ageRaw > 0;

  const canPredict = model !== null && distanceMeters !== null && timeSeconds !== null && ageValid;
  const prediction = canPredict ? predictSpeeds(model, distanceMeters, timeSeconds, ageRaw) : null;
  const inDomain = canPredict ? isWithinModelDomain(model, distanceMeters, timeSeconds, ageRaw) : true;
  const paces = prediction ? selectTrainingPaces(prediction, mode) : null;
  const ranges = prediction ? uncertaintyRangeMS(prediction) : null;

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

          <div className="flex flex-wrap gap-6">
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
            <LabeledInput
              id={`${baseId}-age`}
              label="Age"
              type="number"
              min={10}
              max={90}
              value={ageInput}
              onChange={(event) => setAgeInput(event.target.value)}
              className="w-20"
            />
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

      {model && !inDomain && canPredict && (
        <ContentCallout
          variant="mistake"
          title="Outside the model's range"
          text="This performance (or age) falls outside the ~800m–12,000m, ~90 second–80 minute, age 10–90 range the model was actually fit on. Treat the result as a rough extrapolation, not a reliable estimate."
        />
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
                <button
                  type="button"
                  onClick={() => setShowUncertainty(true)}
                  aria-pressed={showUncertainty}
                  className={segmentedButtonClass(showUncertainty)}
                >
                  Show
                </button>
                <button
                  type="button"
                  onClick={() => setShowUncertainty(false)}
                  aria-pressed={!showUncertainty}
                  className={segmentedButtonClass(!showUncertainty)}
                >
                  Hide
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <PaceRow
              label="Threshold"
              description="The fastest pace that's still a metabolic steady state: heart rate, lactate, and VO2 hold roughly stable over time."
              paceSeconds={speedToPaceSeconds(paces.thresholdSpeedMS, outputUnit)}
              unit={outputUnit}
              rangeSeconds={
                showUncertainty
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
              rangeSeconds={
                showUncertainty
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
              rangeSeconds={
                showUncertainty
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
            input={{ distanceKey, customInput, customUnit, timeInput, ageInput, mode }}
            output={{
              thresholdPace: `${formatPaceOutput(speedToPaceSeconds(paces.thresholdSpeedMS, outputUnit), outputUnit)}${PACE_UNIT_LABEL[outputUnit]}`,
              cvPace: `${formatPaceOutput(speedToPaceSeconds(paces.cvSpeedMS, outputUnit), outputUnit)}${PACE_UNIT_LABEL[outputUnit]}`,
              vo2maxPace: `${formatPaceOutput(speedToPaceSeconds(paces.vo2maxSpeedMS, outputUnit), outputUnit)}${PACE_UNIT_LABEL[outputUnit]}`,
            }}
            label={`${timeInput} for ${distanceKey === "custom" ? `${customInput}${customUnit}` : distanceOption?.label}`}
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
                  This is a statistical model, not a formula: it was fit on roughly 8,600 real race performances
                  from about 1,600 high school, college, adult, and master&rsquo;s runners, using the critical
                  speed model (the standard physiology method for separating sustainable from unsustainable
                  paces) as its outcome. A quantile regression surface over distance, time, and age predicts the
                  10th, 50th, and 90th percentile of threshold, CV, and VO2 max pace for a given performance,
                  which is why the result is a range, not one number: two runners with an identical race time can
                  have genuinely different training paces depending on how aerobically or anaerobically oriented
                  they are.
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
                  Consider an 18:00 5K runner: the average (median) threshold pace among runners at that level is
                  roughly 6:08/mile, but at that exact pace, any given 18:00 5K runner has close to a 50/50
                  chance of actually being over threshold, not under it. If the goal is a reliable metabolic
                  steady state, a 50/50 shot isn&rsquo;t reliable. That&rsquo;s why threshold pace defaults to a{" "}
                  <strong>safe estimate</strong>: the 10th percentile of the threshold-speed distribution, slow
                  enough that roughly 90% of runners at that performance level are genuinely below threshold at
                  it. VO2 max pace uses the same logic in the other direction (the 90th percentile of speed, fast
                  enough that it reliably is unsustainable). CV pace doesn&rsquo;t get a &ldquo;safe&rdquo;
                  direction: it&rsquo;s defined as the 50/50 boundary itself, so it&rsquo;s always the median in
                  both modes. Switching to median estimate mode gives the 50th percentile for all three, closer
                  to what a traditional (non-uncertainty-aware) calculator would show.
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
                  Every runner in the underlying dataset raced three distances between 800m and 5K in the same
                  season. A &ldquo;true&rdquo; middle-distance specialist who only ever races 400m–800m isn&rsquo;t
                  well represented, so predictions skew &ldquo;too aerobic&rdquo; for that kind of runner; the wide
                  uncertainty range for 800m–1600m performances is the model being honest about that gap, not a
                  flaw to ignore. The model is fit on times roughly equivalent to a 14:00–25:00 5K and doesn&rsquo;t
                  extrapolate well far beyond that, and it&rsquo;s built from high school, college, adult, and
                  master&rsquo;s performances specifically, not elite or true-recreational runners, who aren&rsquo;t
                  well represented in either direction.
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
                    (Running Writings, MIT licensed): same underlying model data, rebuilt with a plain-text
                    entry, an adjustable age input the original tool doesn&rsquo;t expose, and saved-result
                    support.
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

    </div>
  );
}
