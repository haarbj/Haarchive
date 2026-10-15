"use client";

import { useId } from "react";
import Link from "next/link";

import { SaveCalculationButton } from "@/components/save-calculation-button";
import { LabeledInput } from "@/components/ui/labeled-input";
import {
  buildBreakfastTargets,
  buildCaffeinePlan,
  buildCarbLoadTargets,
  buildCarbRateGuidance,
  buildRaceFuelingSchedule,
  DEFAULT_TARGET_CARB_G_PER_HOUR,
} from "@/lib/fueling-calculator-math";
import { parseTimeToSeconds } from "@/lib/running-format";
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

const STORAGE_KEY = "haarchive-fueling-calculator-state";
const LB_PER_KG = 2.20462;

function lbsToKg(lbs: number): number {
  return lbs / LB_PER_KG;
}

type WeightUnit = "lbs" | "kg";

type PersistedState = {
  weightInput: string;
  weightUnit: WeightUnit;
  goalTimeInput: string;
  gelGramsInput: string;
  targetRateInput: string;
  currentRateInput: string;
};

export function FuelingCalculator() {
  const baseId = useId();
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const [weightInput, setWeightInput] = usePersistedField(persisted?.weightInput, "150");
  const [weightUnit, setWeightUnit] = usePersistedField<WeightUnit>(persisted?.weightUnit, "lbs");
  const [goalTimeInput, setGoalTimeInput] = usePersistedField(persisted?.goalTimeInput, "3:30:00");
  const [gelGramsInput, setGelGramsInput] = usePersistedField(persisted?.gelGramsInput, "25");
  const [targetRateInput, setTargetRateInput] = usePersistedField(persisted?.targetRateInput, String(DEFAULT_TARGET_CARB_G_PER_HOUR));
  const [currentRateInput, setCurrentRateInput] = usePersistedField(persisted?.currentRateInput, "");

  function persistState() {
    try {
      const state: PersistedState = { weightInput, weightUnit, goalTimeInput, gelGramsInput, targetRateInput, currentRateInput };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage (e.g. private browsing).
    }
  }

  const weightRaw = Number(weightInput);
  const weightValid = weightInput.trim() !== "" && Number.isFinite(weightRaw) && weightRaw > 0;
  const weightKg = weightValid ? (weightUnit === "kg" ? weightRaw : lbsToKg(weightRaw)) : null;

  const goalTimeSeconds = parseTimeToSeconds(goalTimeInput);
  const goalDurationMinutes = goalTimeSeconds !== null ? goalTimeSeconds / 60 : null;

  const gelGramsRaw = Number(gelGramsInput);
  const gelGramsValid = Number.isFinite(gelGramsRaw) && gelGramsRaw > 0;

  const targetRateRaw = Number(targetRateInput);
  const targetRateValid = Number.isFinite(targetRateRaw) && targetRateRaw > 0;

  const currentRateRaw = Number(currentRateInput);
  const currentRateValid = currentRateInput.trim() !== "" && Number.isFinite(currentRateRaw) && currentRateRaw > 0;

  const canCompute = weightKg !== null && goalDurationMinutes !== null && goalDurationMinutes > 0 && gelGramsValid && targetRateValid;

  const carbRateGuidance = targetRateValid
    ? buildCarbRateGuidance(currentRateValid ? currentRateRaw : null, targetRateRaw)
    : null;
  const raceFuelingSchedule =
    canCompute && goalDurationMinutes !== null ? buildRaceFuelingSchedule(goalDurationMinutes, targetRateRaw, gelGramsRaw) : null;
  const carbLoadTargets = weightKg !== null ? buildCarbLoadTargets(weightKg) : null;
  const breakfastTargets = weightKg !== null ? buildBreakfastTargets(weightKg) : null;
  const caffeinePlan = weightKg !== null && goalDurationMinutes !== null ? buildCaffeinePlan(weightKg, goalDurationMinutes) : null;

  return (
    <div className="mt-10 space-y-10">
      <div>
        <p className={sectionLabelClass}>You</p>
        <div className={`${statCardClass} space-y-4`}>
          <div className="flex flex-wrap items-end gap-4">
            <LabeledInput
              id={`${baseId}-weight`}
              label="Body weight"
              type="number"
              inputMode="decimal"
              min={0}
              value={weightInput}
              onChange={(event) => {
                setWeightInput(event.target.value);
                persistState();
              }}
              className="w-24"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setWeightUnit("lbs");
                  persistState();
                }}
                aria-pressed={weightUnit === "lbs"}
                className={segmentedButtonClass(weightUnit === "lbs")}
              >
                lbs
              </button>
              <button
                type="button"
                onClick={() => {
                  setWeightUnit("kg");
                  persistState();
                }}
                aria-pressed={weightUnit === "kg"}
                className={segmentedButtonClass(weightUnit === "kg")}
              >
                kg
              </button>
            </div>
            <LabeledInput
              id={`${baseId}-goal-time`}
              label="Goal time / expected duration"
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
        </div>
      </div>

      <div>
        <p className={sectionLabelClass}>Target carb rate</p>
        <div className={`${statCardClass} space-y-4`}>
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
            The gut, not your fitness, is what actually limits how many carbs you can take in during exercise.
            Glucose and fructose use two separate intestinal transporters (SGLT1 and GLUT5), so a glucose+fructose
            mix supports a meaningfully higher total rate than either sugar alone -- which is why {DEFAULT_TARGET_CARB_G_PER_HOUR}g/hr or
            more is a realistic default target for an effort this long, not an upper limit.
          </p>
          <div className="flex flex-wrap gap-4">
            <LabeledInput
              id={`${baseId}-target-rate`}
              label="Target carb rate (g/hr)"
              type="number"
              inputMode="decimal"
              min={1}
              value={targetRateInput}
              onChange={(event) => {
                setTargetRateInput(event.target.value);
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
            <LabeledInput
              id={`${baseId}-current-rate`}
              label="Current comfortable rate (g/hr, optional)"
              type="number"
              inputMode="decimal"
              min={0}
              value={currentRateInput}
              onChange={(event) => {
                setCurrentRateInput(event.target.value);
                persistState();
              }}
              placeholder="e.g. 30"
              className="w-24"
            />
          </div>
          {carbRateGuidance && (
            <div className={heroCardClass}>
              <p className={statLabelClass}>Target</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">{carbRateGuidance.targetGPerHour}g/hr</p>
              {carbRateGuidance.needsProgression ? (
                <>
                  <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-200">
                    Your current comfortable rate is below target -- jumping straight to it on race day risks real GI
                    distress. Train up to it gradually, over weeks, not days:
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-200">
                    {carbRateGuidance.steps.map((step) => (
                      <li key={step.label}>
                        {step.label}: {step.lowGPerHour}-{step.highGPerHour}g/hr, repeated in training until it feels
                        easy before moving on
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                    This is a gut-training progression, not a one-week fix -- the full step-up generally takes
                    several long runs per step, not a single session.
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                  Your current comfortable rate already meets this target, so no step-up protocol is needed -- just
                  keep practicing it in training the way you plan to race it.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {!canCompute && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Enter your weight, goal time, gel size, and target rate above to see your fueling numbers.
        </p>
      )}

      {raceFuelingSchedule && (
        <div>
          <p className={sectionLabelClass}>In-race fueling schedule</p>
          <div className={`${statCardClass} space-y-3 text-sm text-zinc-700 dark:text-zinc-200`}>
            <p>Pre-race gel: ~{raceFuelingSchedule.preRaceGel.minutesBeforeStart} minutes before the start.</p>
            <ul className="space-y-1.5">
              {raceFuelingSchedule.gels.map((gel) => (
                <li key={gel.atMinute}>
                  ~{gel.atMinute} min: ~{gelGramsRaw}g carbs
                  {gel.optional ? " -- optional, skip if your stomach's iffy this late" : ""}
                </li>
              ))}
            </ul>
            {raceFuelingSchedule.mouthRinseInsteadOfFinalGel && (
              <p>
                In the last stretch, too close to the finish for another gel to help, swish a carbohydrate drink and
                spit it out instead -- a real, smaller benefit from the mouth sensing carbs, without the gut having
                to process anything this late.
              </p>
            )}
            <p>Hydration: drink to thirst, don&rsquo;t force fluids -- the electrolytes already in most gels and drinks are sufficient for a single session; you&rsquo;re not trying to fully replace what you&rsquo;re sweating out mid-race.</p>
          </div>

          <SaveCalculationButton
            calculatorType="fueling-calculator"
            input={{ weightInput, weightUnit, goalTimeInput, gelGramsInput, targetRateInput, currentRateInput }}
            output={{ targetRate: `${targetRateRaw}g/hr`, goalTime: goalTimeInput }}
            label={`${goalTimeInput}, ${weightInput}${weightUnit}`}
          />
        </div>
      )}

      {carbLoadTargets && (
        <div>
          <p className={sectionLabelClass}>Carb loading</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={statCardClass}>
              <p className={statLabelClass}>Moderate ({carbLoadTargets.moderate.days} days)</p>
              <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">
                {carbLoadTargets.moderate.lowG}-{carbLoadTargets.moderate.highG}g/day
              </p>
              <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                8-10 g/kg/day -- practice this one first, ideally before a big workout, not for the first time in
                race week.
              </p>
            </div>
            <div className={statCardClass}>
              <p className={statLabelClass}>Aggressive ({carbLoadTargets.aggressive.days} days)</p>
              <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">
                {carbLoadTargets.aggressive.lowG}-{carbLoadTargets.aggressive.highG}g/day
              </p>
              <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                10-12 g/kg/day -- more total carbohydrate over a longer window, worth rehearsing before you rely on
                it.
              </p>
            </div>
          </div>
        </div>
      )}

      {breakfastTargets && (
        <div>
          <p className={sectionLabelClass}>Pre-race breakfast</p>
          <div className={statCardClass}>
            <p className="text-xl font-semibold text-zinc-900 dark:text-white">
              {breakfastTargets.lowG}-{breakfastTargets.highG}g carbs
            </p>
            <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
              1-4 g/kg, eaten within {breakfastTargets.hoursBeforeStart}
              {" hours of the start -- the right number for you is whatever you’ve already rehearsed in training, not automatically the top of this range."}
            </p>
          </div>
        </div>
      )}

      {caffeinePlan && (
        <div>
          <p className={sectionLabelClass}>Caffeine</p>
          <div className={statCardClass}>
            <p className="text-xl font-semibold text-zinc-900 dark:text-white">~{caffeinePlan.totalMg}mg total</p>
            <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-200">
              {caffeinePlan.firstDoseMg}mg 45-60 minutes before the start, then another {caffeinePlan.secondDoseMg}mg
              around {caffeinePlan.secondDoseAtMinute}
              {" minutes into the race. Nothing in the final hour -- it won’t take effect in time to help."}
            </p>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
              ~3mg/kg body weight, a commonly-cited effective dose for endurance performance. Test this in training
              first -- race day is not the time to find out you&rsquo;re sensitive to it.
            </p>
          </div>
        </div>
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
            Where these numbers come from
          </summary>
          <div className={detailsBodyClass}>
            <p>
              The carb-rate target, carb-loading, breakfast, and caffeine ranges above are widely-cited
              sports-nutrition guidance (ACSM/ISSN-consistent), not a number fit to your specific physiology -- the
              right number for you, within each range, is whatever you&rsquo;ve actually rehearsed and tolerated in
              training. For a per-hour target driven by your actual effort intensity and gut-training level instead
              of a flat default, see the{" "}
              <Link
                href="/endurance-fueling-calculator"
                className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
              >
                Endurance Fueling Calculator
              </Link>
              , which also covers fluid and sodium targets and a product/DIY-drink schedule this tool doesn&rsquo;t.
              For this schedule applied to a specific mile-by-mile race plan instead of a flat duration, see the{" "}
              <Link
                href="/race-pace-planner"
                className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
              >
                Race Pace Planner
              </Link>
              .
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
