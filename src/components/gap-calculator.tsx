"use client";

import { useEffect, useId } from "react";
import Link from "next/link";

import { ContentCallout } from "@/components/content-callout";
import { SaveCalculationButton } from "@/components/save-calculation-button";
import {
  decimalToGradeDegrees,
  decimalToGradePercent,
  equivalentFlatSpeedForGradeMS,
  equivalentFlatSpeedForVerticalSpeedMS,
  equivalentGradeSpeedMS,
  gradeAlert,
  gradeDegreesToDecimal,
  gradePercentToDecimal,
  solveForVerticalSpeed,
  type VerticalDirection,
} from "@/lib/grade-pace-physics";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { formatClock, parseTimeToSeconds } from "@/lib/running-format";
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
import { usePersistedField, usePersistedJSON } from "@/lib/use-persisted-field";

type Mode = "pace" | "effort";
type PaceUnit = "mi" | "km";
type HillInputMode = "grade" | "vertical-speed";
type GradeUnit = "percent" | "degrees";
type VertSpeedUnit = "ft-hr" | "m-hr";

const PACE_UNIT_METERS: Record<PaceUnit, number> = { mi: 1609.344, km: 1000 };
const VERT_SPEED_TO_MS: Record<VertSpeedUnit, number> = {
  "ft-hr": 0.3048 / 3600,
  "m-hr": 1 / 3600,
};
const VERT_SPEED_LABEL: Record<VertSpeedUnit, string> = { "ft-hr": "ft/hr", "m-hr": "m/hr" };

const STORAGE_KEY = "haarchive-gap-calculator-state";

type PersistedState = {
  paceInput: string;
  paceUnit: PaceUnit;
  mode: Mode;
  hillInputMode: HillInputMode;
  direction: VerticalDirection;
  gradeInput: string;
  gradeUnit: GradeUnit;
  vertSpeedInput: string;
  vertSpeedUnit: VertSpeedUnit;
  showMethodology: boolean;
};

function formatSignedSeconds(seconds: number): string {
  const rounded = Math.round(Math.abs(seconds));
  const sign = seconds > 0 ? "+" : seconds < 0 ? "−" : "±";
  return `${sign}${rounded}s`;
}

function formatGrade(grade: number, unit: GradeUnit): string {
  return unit === "percent"
    ? `${decimalToGradePercent(grade).toFixed(1)}%`
    : `${decimalToGradeDegrees(grade).toFixed(1)}°`;
}

export function GapCalculator() {
  const baseId = useId();
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const [paceInput, setPaceInput] = usePersistedField(persisted?.paceInput, "7:00");
  const [paceUnit, setPaceUnit] = usePersistedField<PaceUnit>(persisted?.paceUnit, "mi");
  const [mode, setMode] = usePersistedField<Mode>(persisted?.mode, "pace");

  const [hillInputMode, setHillInputMode] = usePersistedField<HillInputMode>(persisted?.hillInputMode, "grade");
  const [direction, setDirection] = usePersistedField<VerticalDirection>(persisted?.direction, "uphill");
  const [gradeInput, setGradeInput] = usePersistedField(persisted?.gradeInput, "6");
  const [gradeUnit, setGradeUnit] = usePersistedField<GradeUnit>(persisted?.gradeUnit, "percent");
  const [vertSpeedInput, setVertSpeedInput] = usePersistedField(persisted?.vertSpeedInput, "1000");
  const [vertSpeedUnit, setVertSpeedUnit] = usePersistedField<VertSpeedUnit>(persisted?.vertSpeedUnit, "ft-hr");

  const [showMethodology, setShowMethodology] = usePersistedField(persisted?.showMethodology, false);

  useEffect(() => {
    try {
      const state: PersistedState = {
        paceInput,
        paceUnit,
        mode,
        hillInputMode,
        direction,
        gradeInput,
        gradeUnit,
        vertSpeedInput,
        vertSpeedUnit,
        showMethodology,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage.
    }
  }, [
    paceInput,
    paceUnit,
    mode,
    hillInputMode,
    direction,
    gradeInput,
    gradeUnit,
    vertSpeedInput,
    vertSpeedUnit,
    showMethodology,
  ]);

  const paceSeconds = parseTimeToSeconds(paceInput);
  const inputSpeedMS = paceSeconds ? PACE_UNIT_METERS[paceUnit] / paceSeconds : null;

  const gradeRaw = Number(gradeInput);
  const gradeValid = Number.isFinite(gradeRaw) && gradeRaw >= 0;
  const gradeMagnitude = gradeUnit === "percent" ? gradePercentToDecimal(gradeRaw) : gradeDegreesToDecimal(gradeRaw);
  const enteredGrade = gradeValid ? (direction === "uphill" ? gradeMagnitude : -gradeMagnitude) : null;

  const vertSpeedRaw = Number(vertSpeedInput);
  const vertSpeedValid = Number.isFinite(vertSpeedRaw) && vertSpeedRaw > 0;
  const vertSpeedMS = vertSpeedValid ? vertSpeedRaw * VERT_SPEED_TO_MS[vertSpeedUnit] : null;

  let equivalentSpeedMS: number | null = null;
  let resolvedGrade: number | null = null;

  if (inputSpeedMS !== null) {
    if (hillInputMode === "grade" && enteredGrade !== null) {
      resolvedGrade = enteredGrade;
      equivalentSpeedMS =
        mode === "pace"
          ? equivalentFlatSpeedForGradeMS(inputSpeedMS, enteredGrade)
          : equivalentGradeSpeedMS(inputSpeedMS, enteredGrade);
    } else if (hillInputMode === "vertical-speed" && vertSpeedMS !== null) {
      if (mode === "pace") {
        const result = equivalentFlatSpeedForVerticalSpeedMS(inputSpeedMS, vertSpeedMS, direction);
        equivalentSpeedMS = result.flatSpeedMS;
        resolvedGrade = result.grade;
      } else {
        const result = solveForVerticalSpeed(inputSpeedMS, vertSpeedMS, direction);
        equivalentSpeedMS = result?.speedMS ?? null;
        resolvedGrade = result?.grade ?? null;
      }
    }
  }

  const equivalentPaceSeconds =
    equivalentSpeedMS && equivalentSpeedMS > 0 ? PACE_UNIT_METERS[paceUnit] / equivalentSpeedMS : null;

  const deltaSeconds =
    equivalentPaceSeconds !== null && paceSeconds !== null
      ? mode === "pace"
        ? paceSeconds - equivalentPaceSeconds
        : equivalentPaceSeconds - paceSeconds
      : null;

  const unitLabel = paceUnit === "mi" ? "/mi" : "/km";
  const alert = resolvedGrade !== null ? gradeAlert(resolvedGrade) : null;
  const canSolve = paceSeconds !== null && equivalentPaceSeconds !== null;

  return (
    <div className="mt-10 space-y-10">
      <div>
        <p className={sectionLabelClass}>Pace &amp; effort</p>
        <div className={`${statCardClass} flex flex-wrap gap-6`}>
          <div className="min-w-0">
            <label htmlFor={`${baseId}-pace`} className={labelClass}>
              {mode === "pace" ? "Pace you actually ran on the hill" : "Your flat-ground goal pace"}
            </label>
            <div className="flex gap-2">
              <input
                id={`${baseId}-pace`}
                type="text"
                value={paceInput}
                onChange={(event) => setPaceInput(event.target.value)}
                placeholder="mm:ss"
                autoComplete="off"
                className={`w-28 ${fieldClass}`}
              />
              <select
                aria-label="Pace unit"
                value={paceUnit}
                onChange={(event) => setPaceUnit(event.target.value as PaceUnit)}
                className={fieldClass}
              >
                <option value="mi">/mi</option>
                <option value="km">/km</option>
              </select>
            </div>
            {paceSeconds === null && (
              <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">Enter as mm:ss, e.g. 7:00.</p>
            )}
          </div>

          <div className="min-w-[240px]">
            <p className={labelClass}>Mode</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("pace")}
                aria-pressed={mode === "pace"}
                className={segmentedButtonClass(mode === "pace")}
              >
                I ran this pace
              </button>
              <button
                type="button"
                onClick={() => setMode("effort")}
                aria-pressed={mode === "effort"}
                className={segmentedButtonClass(mode === "effort")}
              >
                I want this effort
              </button>
            </div>
            <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
              {mode === "pace"
                ? "Find the flat-ground effort your hill pace was worth."
                : "Find the pace to target on the hill for an even effort."}
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className={sectionLabelClass}>Hill</p>
        <div className={`${statCardClass} space-y-4`}>
          <div className="flex flex-wrap items-start gap-6">
            <div>
              <p className={labelClass}>Direction</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDirection("uphill")}
                  aria-pressed={direction === "uphill"}
                  className={segmentedButtonClass(direction === "uphill")}
                >
                  ⬈ Uphill
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("downhill")}
                  aria-pressed={direction === "downhill"}
                  className={segmentedButtonClass(direction === "downhill")}
                >
                  ⬊ Downhill
                </button>
              </div>
            </div>

            <div>
              <p className={labelClass}>Describe the hill by</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setHillInputMode("grade")}
                  aria-pressed={hillInputMode === "grade"}
                  className={segmentedButtonClass(hillInputMode === "grade")}
                >
                  Grade
                </button>
                <button
                  type="button"
                  onClick={() => setHillInputMode("vertical-speed")}
                  aria-pressed={hillInputMode === "vertical-speed"}
                  className={segmentedButtonClass(hillInputMode === "vertical-speed")}
                  title="Target a climbing/descending rate instead, e.g. for vert-focused trail training"
                >
                  Vertical speed
                </button>
              </div>
            </div>
          </div>

          {hillInputMode === "grade" ? (
            <div>
              <label htmlFor={`${baseId}-grade`} className={labelClass}>
                Grade
              </label>
              <div className="flex gap-2">
                <input
                  id={`${baseId}-grade`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.5}
                  value={gradeInput}
                  onChange={(event) => setGradeInput(event.target.value)}
                  className={`w-24 ${fieldClass}`}
                />
                <select
                  aria-label="Grade unit"
                  value={gradeUnit}
                  onChange={(event) => setGradeUnit(event.target.value as GradeUnit)}
                  className={fieldClass}
                >
                  <option value="percent">% grade</option>
                  <option value="degrees">degrees</option>
                </select>
              </div>
              <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                A 6% grade means 6 meters of rise (or fall) for every 100 meters covered horizontally -- a
                noticeable, sustained hill, not a steep pitch.
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor={`${baseId}-vert-speed`} className={labelClass}>
                Target {direction === "uphill" ? "climbing" : "descending"} rate
              </label>
              <div className="flex gap-2">
                <input
                  id={`${baseId}-vert-speed`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={50}
                  value={vertSpeedInput}
                  onChange={(event) => setVertSpeedInput(event.target.value)}
                  className={`w-24 ${fieldClass}`}
                />
                <select
                  aria-label="Vertical speed unit"
                  value={vertSpeedUnit}
                  onChange={(event) => setVertSpeedUnit(event.target.value as VertSpeedUnit)}
                  className={fieldClass}
                >
                  {(Object.keys(VERT_SPEED_LABEL) as VertSpeedUnit[]).map((unit) => (
                    <option key={unit} value={unit}>
                      {VERT_SPEED_LABEL[unit]}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                Common for vert-focused trail training (e.g. targeting 1000 ft/hr of gain) -- the grade that
                produces this climbing rate at your pace is worked out for you, and it isn&rsquo;t always the same
                grade at every pace.
              </p>
            </div>
          )}
        </div>
      </div>

      {canSolve && (
        <div>
          <p className={sectionLabelClass}>Result</p>
          <div className={heroCardClass}>
            {equivalentPaceSeconds !== null ? (
              <>
                <p className={statLabelClass}>
                  {mode === "pace" ? "Flat-ground equivalent effort" : "Target pace on this hill"}
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
                  {formatClock(equivalentPaceSeconds)}
                  {unitLabel}
                </p>
                {hillInputMode === "vertical-speed" && resolvedGrade !== null && (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    Works out to about {formatGrade(Math.abs(resolvedGrade), gradeUnit)} grade at this pace.
                  </p>
                )}
                {deltaSeconds !== null && Math.abs(deltaSeconds) >= 1 && (
                  <p className="mt-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                    {formatSignedSeconds(deltaSeconds)} {unitLabel} from the {direction} —{" "}
                    {deltaSeconds > 0
                      ? mode === "pace"
                        ? "the hill cost you this much per unit distance."
                        : "run this much slower per unit distance to match your goal effort."
                      : mode === "pace"
                        ? "the hill was actually helping you by this much."
                        : "you can afford to run this much faster and still match your goal effort."}
                  </p>
                )}
                <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
                  {mode === "pace"
                    ? `Running ${formatClock(paceSeconds!)}${unitLabel} on this ${direction} took the same effort as running ${formatClock(equivalentPaceSeconds)}${unitLabel} on flat ground.`
                    : `To match a ${formatClock(paceSeconds!)}${unitLabel} flat-ground effort, aim for ${formatClock(equivalentPaceSeconds)}${unitLabel} on this ${direction}.`}
                </p>
                <SaveCalculationButton
                  calculatorType="gap-calculator"
                  input={{ paceInput, paceUnit, mode, hillInputMode, direction, gradeInput, gradeUnit, vertSpeedInput, vertSpeedUnit }}
                  output={{ equivalentPaceSeconds, deltaSeconds, resolvedGrade }}
                  label={`${formatClock(paceSeconds!)}${unitLabel} on a ${direction} hill`}
                />
              </>
            ) : (
              <p className="text-sm text-zinc-700 dark:text-zinc-200">
                This combination is too extreme for a reliable estimate. Try a shallower grade, a slower vertical
                speed, or a more realistic pace.
              </p>
            )}
          </div>

          {alert && (
            <div className="mt-4">
              <ContentCallout
                variant="mistake"
                title={alert === "steep-downhill" ? "Steep downhill" : "Steep uphill"}
                text={
                  alert === "steep-downhill"
                    ? "Beyond roughly -8% grade, downhill running may not deliver the full energetic benefit this estimate predicts -- braking effort and control start working against the free speed a gentler downhill gives you."
                    : "Beyond roughly 25% grade, walking may actually be more energy-efficient than running -- this estimate is still computed, but treat it as a reference point rather than a running target that steep."
                }
              />
            </div>
          )}
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
                <span
                  aria-hidden="true"
                  className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                >
                  ▶
                </span>
                How the flat-ground cost is calculated
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Flat-ground running cost comes from a smoothed regression fit directly to Black et al.&rsquo;s 2018
                  digitized treadmill data (elite-runner category) -- a curve of energy cost (in joules per
                  kilogram) as a function of speed. Because everything here is expressed per kilogram of body
                  weight, your own weight cancels out of the comparison and isn&rsquo;t needed as an input.
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
                How the grade is factored in
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Minetti et al. (Journal of Applied Physiology, 2002) fit a quintic polynomial to the <em>added</em>{" "}
                  energy cost of running at a grade, from steep uphill through steep downhill, based on their own
                  treadmill testing. Adding that added cost to the flat-ground cost at your speed gives the total
                  cost of running this hill -- the calculator then finds whichever flat-ground speed would produce
                  that same total cost, which is the &ldquo;equivalent&rdquo; pace or effort shown above.
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
                Vertical speed mode
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Targeting a vertical speed (rather than a fixed grade) is genuinely different math: at a fixed
                  climbing rate, metabolic cost isn&rsquo;t monotonic in grade -- too shallow a grade demands
                  excessive horizontal speed to hit the target climb rate, while too steep runs straight up
                  Minetti&rsquo;s polynomial, so there&rsquo;s a real cost-minimizing grade in between. In &ldquo;I want this
                  effort&rdquo; mode, this is found with a numeric search rather than a closed-form formula.
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
                  This models a single, constant grade for the whole distance -- real trails and hill repeats often
                  have variable grades, which this doesn&rsquo;t capture segment by segment. Extremely fast paces
                  (faster than roughly a 5-minute mile) extrapolate beyond the range Black et al.&rsquo;s data
                  directly measured, so treat those results with more caution. Footing, fatigue, and
                  downhill-braking technique all affect real-world hill performance beyond what any energy-cost
                  model captures.
                </p>
              </div>
            </details>
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Analyzing a whole race or workout&rsquo;s total elevation profile, alongside heat, humidity, and wind? The{" "}
        <Link
          href="/environmental-calculator"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Environmental Performance Calculator
        </Link>{" "}
        handles that; this tool is for a single, known grade -- a treadmill incline, a specific hill repeat, or a
        segment of trail.
      </p>
    </div>
  );
}
