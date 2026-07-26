"use client";

import { useEffect, useId } from "react";
import Link from "next/link";

import { ContentCallout } from "@/components/content-callout";
import { SaveCalculationButton } from "@/components/save-calculation-button";
import { fieldClass, labelClass } from "@/lib/form-styles";
import {
  HR_THRESHOLD_DISTRIBUTIONS,
  VO2MAX_THRESHOLD_ESTIMATE,
  type HrBasis,
  meanPercent,
  referenceRangePercent,
} from "@/lib/hr-threshold-reference";
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

const CONFIDENCE_LEVELS = [0.8, 0.9, 0.95] as const;
const STORAGE_KEY = "haarchive-hr-threshold-calculator-state";

type PersistedState = {
  basis: HrBasis;
  confidenceLevel: number;
  ageInput: string;
  knownMaxHrInput: string;
  restingHrInput: string;
  showMethodology: boolean;
};

function bpmFromPercent(pct: number, basis: HrBasis, maxHr: number, restingHr: number | null): number | null {
  if (basis === "hrmax") return maxHr * (pct / 100);
  if (restingHr === null) return null;
  return restingHr + (pct / 100) * (maxHr - restingHr);
}

type ThresholdCardProps = {
  label: string;
  description: string;
  basis: HrBasis;
  threshold: "lt1" | "lt2";
  confidenceLevel: number;
  maxHr: number | null;
  restingHr: number | null;
  learnMoreHref: string;
};

function ThresholdCard({ label, description, basis, threshold, confidenceLevel, maxHr, restingHr, learnMoreHref }: ThresholdCardProps) {
  const mean = meanPercent(basis, threshold);
  const range = referenceRangePercent(basis, threshold, confidenceLevel);
  const meanBpm = maxHr !== null ? bpmFromPercent(mean, basis, maxHr, restingHr) : null;
  const lowBpm = maxHr !== null ? bpmFromPercent(range.low, basis, maxHr, restingHr) : null;
  const highBpm = maxHr !== null ? bpmFromPercent(range.high, basis, maxHr, restingHr) : null;
  const basisLabel = basis === "hrmax" ? "max HR" : "HR reserve";

  return (
    <div className={statCardClass}>
      <p className={statLabelClass}>{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
        {mean.toFixed(0)}% <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">of {basisLabel}</span>
      </p>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
        {Math.round(confidenceLevel * 100)}% range: {range.low.toFixed(0)}–{range.high.toFixed(0)}%
      </p>
      {meanBpm !== null && lowBpm !== null && highBpm !== null && (
        <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-white">
          ≈{Math.round(meanBpm)} bpm
          <span className="ml-1.5 text-sm font-normal text-zinc-600 dark:text-zinc-300">
            ({Math.round(lowBpm)}–{Math.round(highBpm)} bpm)
          </span>
        </p>
      )}
      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">{description}</p>
      <Link
        href={learnMoreHref}
        className="mt-2 inline-block text-xs font-semibold text-zinc-700 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-zinc-200 dark:decoration-white/30 dark:hover:decoration-white"
      >
        Learn why →
      </Link>
    </div>
  );
}

// Where LT1 (aerobic threshold) and LT2 (lactate/anaerobic threshold -- the
// same physiological point this site calls "Threshold" elsewhere) actually
// fall on a heart rate monitor, drawn from a real meta-analysis rather than
// a single fixed rule of thumb. Adapted from John Davis's
// lt1-lt2-hr-reference-ranges repository (github.com/johnjdavisiv/
// lt1-lt2-hr-reference-ranges, MIT licensed) -- that repo is a dataset and
// an R analysis script, not a web app, so this interface is new; only the
// underlying statistics are ported (see lib/hr-threshold-reference.ts for
// how they were verified).
export function HrThresholdCalculator() {
  const baseId = useId();
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const [basis, setBasis] = usePersistedField<HrBasis>(persisted?.basis, "hrmax");
  const [confidenceLevel, setConfidenceLevel] = usePersistedField(persisted?.confidenceLevel, 0.9);
  const [ageInput, setAgeInput] = usePersistedField(persisted?.ageInput, "30");
  const [knownMaxHrInput, setKnownMaxHrInput] = usePersistedField(persisted?.knownMaxHrInput, "");
  const [restingHrInput, setRestingHrInput] = usePersistedField(persisted?.restingHrInput, "60");
  const [showMethodology, setShowMethodology] = usePersistedField(persisted?.showMethodology, false);

  useEffect(() => {
    try {
      const state: PersistedState = { basis, confidenceLevel, ageInput, knownMaxHrInput, restingHrInput, showMethodology };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage (e.g. private browsing).
    }
  }, [basis, confidenceLevel, ageInput, knownMaxHrInput, restingHrInput, showMethodology]);

  const age = Number(ageInput);
  const ageValid = ageInput.trim() !== "" && Number.isFinite(age) && age > 0;
  const knownMaxHr = Number(knownMaxHrInput);
  const knownMaxHrValid = knownMaxHrInput.trim() !== "" && Number.isFinite(knownMaxHr) && knownMaxHr > 0;
  const restingHr = Number(restingHrInput);
  const restingHrValid = restingHrInput.trim() !== "" && Number.isFinite(restingHr) && restingHr > 0;

  const effectiveMaxHr = knownMaxHrValid ? knownMaxHr : ageValid ? 220 - age : null;
  const effectiveRestingHr = basis === "hrreserve" && restingHrValid ? restingHr : null;
  const needsRestingHr = basis === "hrreserve" && !restingHrValid;
  const canShowSave = effectiveMaxHr !== null && (basis === "hrmax" || effectiveRestingHr !== null);

  const hrrSource = HR_THRESHOLD_DISTRIBUTIONS.hrreserve.lt1;

  return (
    <div className="mt-10 space-y-10">
      <div>
        <p className={sectionLabelClass}>Your heart rate</p>
        <div className={`${statCardClass} flex flex-wrap gap-6`}>
          <div>
            <label htmlFor={`${baseId}-age`} className={labelClass}>
              Age
            </label>
            <input
              id={`${baseId}-age`}
              type="number"
              min={1}
              value={ageInput}
              onChange={(event) => setAgeInput(event.target.value)}
              className={`w-20 ${fieldClass}`}
            />
          </div>
          <div>
            <label htmlFor={`${baseId}-maxhr`} className={labelClass}>
              Known max HR (optional)
            </label>
            <input
              id={`${baseId}-maxhr`}
              type="number"
              min={1}
              value={knownMaxHrInput}
              onChange={(event) => setKnownMaxHrInput(event.target.value)}
              placeholder="e.g. 190"
              className={`w-28 ${fieldClass}`}
            />
          </div>
          {basis === "hrreserve" && (
            <div>
              <label htmlFor={`${baseId}-resting`} className={labelClass}>
                Resting HR
              </label>
              <input
                id={`${baseId}-resting`}
                type="number"
                min={1}
                value={restingHrInput}
                onChange={(event) => setRestingHrInput(event.target.value)}
                className={`w-24 ${fieldClass}`}
              />
            </div>
          )}
        </div>
        {knownMaxHrValid && (
          <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
            Using your entered max HR instead of the 220-minus-age estimate.
          </p>
        )}
      </div>

      <div>
        <p className={sectionLabelClass}>Reference basis</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setBasis("hrmax")}
            aria-pressed={basis === "hrmax"}
            className={segmentedButtonClass(basis === "hrmax")}
          >
            % of max HR
          </button>
          <button
            type="button"
            onClick={() => setBasis("hrreserve")}
            aria-pressed={basis === "hrreserve"}
            className={segmentedButtonClass(basis === "hrreserve")}
          >
            % of HR reserve
          </button>
        </div>
        <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
          HR reserve (the Karvonen method) is resting HR plus a percentage of the gap up to max HR, rather than a
          straight percentage of max HR itself.
        </p>
        {basis === "hrreserve" && (
          <div className="mt-3">
            <ContentCallout
              variant="mistake"
              title="Lower confidence: single study"
              text={`The %HR reserve figures below come from just one study (Weltman 1990, n=${hrrSource.subjects} runners) -- there's no meta-analysis to pool across studies the way the %HRmax figures below have. Treat this as illustrative, not a well-established population reference range.`}
            />
          </div>
        )}
      </div>

      <div>
        <p className={sectionLabelClass}>Reference range width</p>
        <div className="flex flex-wrap gap-2">
          {CONFIDENCE_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setConfidenceLevel(level)}
              aria-pressed={confidenceLevel === level}
              className={segmentedButtonClass(confidenceLevel === level)}
            >
              {Math.round(level * 100)}%
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
          This is how much of the population the range below is built to cover. At 90%, the range shown is wide
          enough that only about 1 in 20 runners would have a true LT1/LT2 below the bottom of it, and about 1 in
          20 above the top — the middle 90% fall somewhere inside. Widen it to 95% to be more inclusive of
          outliers, or narrow it to 80% for a tighter, more typical-runner estimate; 90% is a reasonable default.
        </p>
      </div>

      <div>
        <p className={sectionLabelClass}>Where LT1 and LT2 typically fall</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ThresholdCard
            label="LT1 (Aerobic Threshold)"
            description="The upper edge of genuinely easy running -- below this, lactate and effort stay essentially flat for a long time."
            basis={basis}
            threshold="lt1"
            confidenceLevel={confidenceLevel}
            maxHr={effectiveMaxHr}
            restingHr={effectiveRestingHr}
            learnMoreHref="/exercise-physiology"
          />
          <ThresholdCard
            label="LT2 (Lactate Threshold)"
            description="Maximal lactate steady state -- the same 'Threshold' pace this site's other pace tools are built around."
            basis={basis}
            threshold="lt2"
            confidenceLevel={confidenceLevel}
            maxHr={effectiveMaxHr}
            restingHr={effectiveRestingHr}
            learnMoreHref="/cv-threshold-calculator"
          />
        </div>
        {effectiveMaxHr === null && (
          <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">Enter your age or a known max HR to see BPM values.</p>
        )}
        {needsRestingHr && (
          <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">Enter a resting HR to see BPM values for HR reserve.</p>
        )}
        {canShowSave && (
          <SaveCalculationButton
            calculatorType="hr-threshold-calculator"
            input={{ basis, confidenceLevel, ageInput, knownMaxHrInput, restingHrInput }}
            output={{
              lt1Percent: meanPercent(basis, "lt1").toFixed(0),
              lt2Percent: meanPercent(basis, "lt2").toFixed(0),
            }}
            label={`LT1/LT2 as % of ${basis === "hrmax" ? "max HR" : "HR reserve"}`}
          />
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowMethodology((value) => !value)}
          aria-expanded={showMethodology}
          className="flex items-center gap-2 py-1 text-lg font-semibold text-zinc-900 dark:text-white"
        >
          Behind the calculator: methodology, assumptions, and limitations
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
                How the reference ranges were built
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  The %HRmax figures come from a proper random-effects meta-analysis across published studies (7
                  studies / 140 subjects for LT1, 9 groups from 7 studies / 162 subjects for LT2), fit on a
                  log(100 − x) transformed scale to correct for the fact percentages are bounded at 100% and get
                  skewed as they approach it. That produces a pooled mean and a total variance combining both
                  between-study and between-individual variation, which is what the reference range above is
                  drawn from — not just one study&rsquo;s numbers, and not a made-up rule of thumb.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span aria-hidden="true" className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400">
                  ▶
                </span>
                Why %HR reserve is flagged as lower confidence
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Only one study in the underlying dataset (Weltman et al. 1990, 31 recreational runners) reports
                  LT1 or LT2 as a percentage of HR reserve at all, so there&rsquo;s no between-study variance to pool —
                  the range shown is that single study&rsquo;s own individual-level variability, treated as if it were
                  a population estimate. It&rsquo;s included because it&rsquo;s still real data, not a guess, but it doesn&rsquo;t
                  carry the same weight as the multi-study %HRmax figures.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span aria-hidden="true" className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400">
                  ▶
                </span>
                For context: as a percentage of VO2max
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  The same meta-analysis also estimated these thresholds as a percentage of VO2max: LT1 averages
                  about {VO2MAX_THRESHOLD_ESTIMATE.lt1.meanPct.toFixed(0)}% ({VO2MAX_THRESHOLD_ESTIMATE.lt1.lowPct.toFixed(0)}–
                  {VO2MAX_THRESHOLD_ESTIMATE.lt1.highPct.toFixed(0)}% range, {VO2MAX_THRESHOLD_ESTIMATE.lt1.studies} studies),
                  and LT2 averages about {VO2MAX_THRESHOLD_ESTIMATE.lt2.meanPct.toFixed(0)}% (
                  {VO2MAX_THRESHOLD_ESTIMATE.lt2.lowPct.toFixed(0)}–{VO2MAX_THRESHOLD_ESTIMATE.lt2.highPct.toFixed(0)}%
                  range, {VO2MAX_THRESHOLD_ESTIMATE.lt2.studies} studies). This calculator doesn&rsquo;t turn that into a
                  pace directly — see the{" "}
                  <Link href="/cv-threshold-calculator" className="underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white">
                    Threshold, CV &amp; VO2max Pace Calculator
                  </Link>{" "}
                  for pace-based threshold estimates instead.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span aria-hidden="true" className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400">
                  ▶
                </span>
                Source and limitations
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Adapted from John Davis&rsquo;s{" "}
                  <a
                    href="https://github.com/johnjdavisiv/lt1-lt2-hr-reference-ranges"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-900 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
                  >
                    LT1/LT2 heart rate meta-analysis
                  </a>{" "}
                  (MIT licensed) — that repository is a dataset and R analysis script, not a web app, so this
                  interface was built new around its verified statistics. Max HR uses the standard
                  220-minus-age population estimate unless you enter a known value, which is always more
                  trustworthy than a population formula. These are population reference ranges, not a
                  personalized lab test — an individual&rsquo;s real LT1/LT2 can sit outside even a wide range,
                  especially given how much fast-twitch/slow-twitch orientation affects where these thresholds
                  land.
                </p>
              </div>
            </details>
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        For Karvonen training zones built around a race performance instead of population reference ranges, see
        the{" "}
        <Link
          href="/pace-calculator"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Pace &amp; Heart Rate Calculator
        </Link>
        . For the pace-based version of these same thresholds, see the{" "}
        <Link
          href="/cv-threshold-calculator"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Threshold, CV &amp; VO2max Pace Calculator
        </Link>
        .
      </p>
    </div>
  );
}
