"use client";

import { useEffect, useId } from "react";
import Link from "next/link";

import { SaveCalculationButton } from "@/components/save-calculation-button";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { RACE_DISTANCES, type RaceCategory } from "@/lib/race-distances";
import { parseTimeToSeconds } from "@/lib/running-format";
import {
  calculateTinman,
  formatTinmanTime,
  type Gender,
  type TinmanResult,
  TRAINING_PACE_COLUMNS,
} from "@/lib/tinman-calculator-math";
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

const CATEGORY_LABEL: Record<RaceCategory, string> = {
  track: "Track",
  xc: "Cross Country",
  road: "Road",
};

const HEADLINE_DISTANCES = ["Mile", "5k", "10k", "Half Marathon", "marathon"];

const STORAGE_KEY = "haarchive-tinman-calculator-state";

type PersistedState = {
  distanceKey: string;
  timeInput: string;
  gender: Gender;
};

// Reverse-engineered from Tom Schwartz's ("Tinman") Running Calculator
// (finalsurge.com/tinman-calculator) via black-box statistical inference
// against the tool's own real, public output -- no source code was read or
// copied. See docs/tinman-reverse-engineering-report.md for the full
// methodology and src/lib/tinman-calculator-math.ts for the model itself.
// Not affiliated with or endorsed by Tom Schwartz or Final Surge.
export function TinmanCalculator() {
  const baseId = useId();
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const [distanceKey, setDistanceKey] = usePersistedField(persisted?.distanceKey, "5k");
  const [timeInput, setTimeInput] = usePersistedField(persisted?.timeInput, "18:00");
  const [gender, setGender] = usePersistedField<Gender>(persisted?.gender, "male");

  useEffect(() => {
    try {
      const state: PersistedState = { distanceKey, timeInput, gender };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage (e.g. private browsing).
    }
  }, [distanceKey, timeInput, gender]);

  const distance = RACE_DISTANCES.find((d) => d.key === distanceKey);
  const timeSeconds = parseTimeToSeconds(timeInput);
  const valid = distance !== undefined && timeSeconds !== null && timeSeconds > 0;

  let result: TinmanResult | null = null;
  if (valid) {
    result = calculateTinman(distance.meters, timeSeconds, gender);
  }

  const categories: RaceCategory[] = ["track", "xc", "road"];

  return (
    <div className="mt-10 space-y-10">
      <p className="rounded-lg border border-black/10 bg-black/[0.02] px-4 py-3 text-xs text-zinc-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300">
        Not affiliated with or endorsed by Tom Schwartz or Final Surge. This model was reverse-engineered
        independently by statistically fitting real, public calculator output — see &ldquo;Behind the
        calculator&rdquo; below for the methodology.
      </p>

      <div>
        <p className={sectionLabelClass}>Race performance</p>
        <div className={`${statCardClass} space-y-4`}>
          <div className="flex flex-wrap gap-4">
            <div>
              <label htmlFor={`${baseId}-distance`} className={labelClass}>
                Distance
              </label>
              <select
                id={`${baseId}-distance`}
                value={distanceKey}
                onChange={(event) => setDistanceKey(event.target.value)}
                className={fieldClass}
              >
                {categories.map((category) => (
                  <optgroup key={category} label={CATEGORY_LABEL[category]}>
                    {RACE_DISTANCES.filter((d) => d.categories.includes(category)).map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${baseId}-time`} className={labelClass}>
                Finish time
              </label>
              <input
                id={`${baseId}-time`}
                type="text"
                value={timeInput}
                onChange={(event) => setTimeInput(event.target.value)}
                placeholder="mm:ss or h:mm:ss"
                autoComplete="off"
                className={`w-32 ${fieldClass}`}
              />
            </div>
          </div>
          {timeSeconds === null && (
            <p className="text-xs text-zinc-600 dark:text-zinc-300">Enter your time as mm:ss or h:mm:ss.</p>
          )}
          <div>
            <p className={labelClass}>Gender (for the Rating value only — every pace below is the same either way)</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setGender("male")}
                aria-pressed={gender === "male"}
                className={segmentedButtonClass(gender === "male")}
              >
                Male
              </button>
              <button
                type="button"
                onClick={() => setGender("female")}
                aria-pressed={gender === "female"}
                className={segmentedButtonClass(gender === "female")}
              >
                Female
              </button>
            </div>
          </div>
        </div>
      </div>

      {result && distance && (
        <>
          <div>
            <p className={sectionLabelClass}>Rating</p>
            <div className={heroCardClass}>
              <p className={statLabelClass}>Performance rating</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
                {result.rating.toFixed(1)}%
              </p>
              <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
                100% is the estimated natural limit of human distance-running performance. Equivalent 3000m time:{" "}
                {formatTinmanTime(result.time3kSeconds)}. Estimated vVO2max:{" "}
                {formatTinmanTime(result.vvo2.paceSecPerKm)}/km ({formatTinmanTime(result.vvo2.paceSecPerMile)}/mi).
              </p>

              <SaveCalculationButton
                calculatorType="tinman-calculator"
                input={{ distanceKey, timeInput, gender }}
                output={{ rating: result.rating.toFixed(1), time3k: formatTinmanTime(result.time3kSeconds) }}
                label={`${distance.label} — ${timeInput}`}
              />
            </div>
          </div>

          <div>
            <p className={sectionLabelClass}>Equivalent race times</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {HEADLINE_DISTANCES.map((label) => {
                const eq = result!.equivalentRaceTimes.find((r) => r.label === label);
                if (!eq) return null;
                return (
                  <div key={label} className={statCardClass}>
                    <p className={statLabelClass}>{label === "marathon" ? "Marathon" : label}</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">
                      {formatTinmanTime(eq.seconds)}
                    </p>
                  </div>
                );
              })}
            </div>

            <details className={`${detailsClass} mt-4`}>
              <summary className={summaryClass}>See all {result.equivalentRaceTimes.length} equivalent race times</summary>
              <div className={detailsBodyClass}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-black/10 dark:border-white/10">
                        <th className="py-2 pr-3 text-left font-semibold text-zinc-900 dark:text-white">Distance</th>
                        <th className="px-3 py-2 text-right font-semibold text-zinc-900 dark:text-white">Time</th>
                        <th className="px-3 py-2 text-right font-semibold text-zinc-900 dark:text-white">Pace/km</th>
                        <th className="py-2 pl-3 text-right font-semibold text-zinc-900 dark:text-white">Pace/mi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.equivalentRaceTimes.map((eq) => (
                        <tr key={eq.label} className="border-b border-black/5 last:border-0 dark:border-white/5">
                          <td className="py-1.5 pr-3 text-zinc-700 dark:text-zinc-200">
                            {eq.label === "marathon" ? "Marathon" : eq.label}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-zinc-900 dark:text-white">
                            {formatTinmanTime(eq.seconds)}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-zinc-700 dark:text-zinc-200">
                            {formatTinmanTime(eq.paceSecPerKm)}
                          </td>
                          <td className="py-1.5 pl-3 text-right tabular-nums text-zinc-700 dark:text-zinc-200">
                            {formatTinmanTime(eq.paceSecPerMile)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          </div>

          <div>
            <p className={sectionLabelClass}>Race splits (even pace)</p>
            <p className="mb-3 text-xs text-zinc-600 dark:text-zinc-300">
              The literal time you&rsquo;d hit at each split running {distance.label} at a perfectly even pace — not a
              fitness-adjusted prediction like the table above.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-black/10 dark:border-white/10">
                    {result.raceSplits.map((split) => (
                      <th key={split.label} className="px-2 py-2 text-right font-semibold text-zinc-900 first:text-left first:pl-0 dark:text-white">
                        {split.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {result.raceSplits.map((split) => (
                      <td key={split.label} className="px-2 py-1.5 text-right tabular-nums text-zinc-700 first:text-left first:pl-0 dark:text-zinc-200">
                        {formatTinmanTime(split.seconds)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className={sectionLabelClass}>Training paces by intensity</p>
            <p className="mb-3 text-xs text-zinc-600 dark:text-zinc-300">
              Each cell is a low-high range for that zone at that distance. &ldquo;—&rdquo; means that zone/distance
              combination isn&rsquo;t a meaningful prescription (e.g. a mile at Speed intensity).
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-black/10 dark:border-white/10">
                    <th className="py-2 pr-3 text-left align-bottom font-semibold text-zinc-900 dark:text-white">Intensity</th>
                    {TRAINING_PACE_COLUMNS.map((col) => (
                      <th key={col.label} className="px-2 py-2 text-right align-bottom font-semibold text-zinc-900 dark:text-white">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.trainingPaces.map((row) => (
                    <tr key={row.zone} className="border-b border-black/5 last:border-0 dark:border-white/5">
                      <td className="py-1.5 pr-3 align-top font-medium whitespace-nowrap text-zinc-900 dark:text-white">{row.zone}</td>
                      {row.cells.map((cell, i) => (
                        <td key={i} className="px-2 py-1.5 text-right leading-tight whitespace-nowrap tabular-nums text-zinc-700 dark:text-zinc-200">
                          {cell ? (
                            <>
                              <div>{formatTinmanTime(cell.high)}</div>
                              <div>{formatTinmanTime(cell.low)}</div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <details className={detailsClass}>
            <summary className={summaryClass}>Behind the calculator</summary>
            <div className={`${detailsBodyClass} space-y-3`}>
              <p>
                This isn&rsquo;t Jack Daniels&rsquo; VDOT — that model was tested directly against real output from
                the source calculator and fit roughly 500x worse than the model actually used here. Instead, every
                performance converts to an equivalent 3000m time via a distance-only fatigue curve (a natural spline
                below 3000m, a power law above it), which is fitness-independent: the same curve shape holds whether
                you&rsquo;re a 3:30 1500m runner or a 5:00:00 marathoner.
              </p>
              <p>
                Your estimated vVO2max is derived from that 3000m-equivalent time with a logarithmic correction
                (slower/longer efforts represent a smaller share of vVO2max), and every training zone is a fixed
                pace ratio to vVO2max, measured directly rather than assumed.
              </p>
              <p>
                This entire model was reverse-engineered independently, by collecting real input/output pairs from
                the public calculator and statistically fitting the relationships above — not by reading or copying
                any of the original tool&rsquo;s code. Validated to a median error under 0.2 seconds and a worst
                case around 1 second against ~3,400 real predictions spanning 100m to the marathon.
              </p>
            </div>
          </details>

          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            Want uncertainty ranges around each pace instead of point estimates, built from a published
            meta-analysis rather than a single calculator&rsquo;s model? See the{" "}
            <Link
              href="/cv-threshold-calculator"
              className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
            >
              Threshold, CV &amp; VO2max Pace Calculator
            </Link>{" "}
            or convert any of these paces to a finish time (or back) with the{" "}
            <Link
              href="/race-pace-calculator"
              className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
            >
              Race Pace Calculator
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
