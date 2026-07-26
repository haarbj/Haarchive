"use client";

import { useEffect, useId } from "react";
import Link from "next/link";

import { fieldClass, labelClass } from "@/lib/form-styles";
import { segmentedButtonClass, sectionLabelClass, statCardClass } from "@/lib/tool-styles";
import {
  type DistanceUnit,
  hasDistancePlaceholder,
  renderDescription,
  scaleDistance,
  scaleForTargetPeak,
} from "@/lib/training-plans/template";
import type { RawWorkout, TrainingPlan } from "@/lib/training-plans/types";
import { usePersistedField, usePersistedJSON } from "@/lib/use-persisted-field";

type PersistedState = {
  targetPeakInput: string;
  unit: DistanceUnit;
};

function formatDistance(miles: number): string {
  const rounded = Math.round(miles * 10) / 10;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
}

// A single training plan's full week-by-week schedule, rescaled live to a
// target peak weekly mileage. Adapted from John Davis's mee-expl repository
// (github.com/johnjdavisiv/mee-expl) -- that repo is 10 JSON plan exports
// with no app code at all, so the scaling mechanism itself (target peak
// mileage, not an abstract multiplier) and this whole interface are new;
// only the plans' real workout content is ported. See
// lib/training-plans/template.ts for why the mi/km toggle needs no
// separate unit-conversion step.
export function PlanPage({ plan }: { plan: TrainingPlan }) {
  const baseId = useId();
  const storageKey = `haarchive-training-plan-${plan.slug}-state`;
  const persisted = usePersistedJSON<PersistedState>(storageKey);

  const [targetPeakInput, setTargetPeakInput] = usePersistedField(
    persisted?.targetPeakInput,
    String(Math.round(plan.referencePeakWeeklyMiles)),
  );
  const [unit, setUnit] = usePersistedField<DistanceUnit>(persisted?.unit, "mi");

  useEffect(() => {
    try {
      const state: PersistedState = { targetPeakInput, unit };
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage (e.g. private browsing).
    }
  }, [targetPeakInput, unit, storageKey]);

  const targetPeak = Number(targetPeakInput);
  const targetPeakValid = targetPeakInput.trim() !== "" && Number.isFinite(targetPeak) && targetPeak > 0;
  const scale = targetPeakValid ? scaleForTargetPeak(plan.referencePeakWeeklyMiles, targetPeak) : 1;

  const weeks: RawWorkout[][] = [];
  for (let i = 0; i < plan.workouts.length; i += 7) {
    weeks.push(plan.workouts.slice(i, i + 7));
  }

  return (
    <div className="mt-10 space-y-10">
      <div>
        <p className={sectionLabelClass}>Scale this plan</p>
        <div className={`${statCardClass} flex flex-wrap items-end gap-6`}>
          <div>
            <label htmlFor={`${baseId}-peak`} className={labelClass}>
              Target peak weekly {unit === "mi" ? "mileage" : "distance"}
            </label>
            <input
              id={`${baseId}-peak`}
              type="number"
              inputMode="decimal"
              min={0}
              value={targetPeakInput}
              onChange={(event) => setTargetPeakInput(event.target.value)}
              className={`w-28 ${fieldClass}`}
            />
          </div>
          <div>
            <p className={labelClass}>Units</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUnit("mi")}
                aria-pressed={unit === "mi"}
                className={segmentedButtonClass(unit === "mi")}
              >
                Miles
              </button>
              <button
                type="button"
                onClick={() => setUnit("km")}
                aria-pressed={unit === "km"}
                className={segmentedButtonClass(unit === "km")}
              >
                Kilometers
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTargetPeakInput(String(Math.round(plan.referencePeakWeeklyMiles)))}
            className="text-xs font-semibold text-zinc-600 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-zinc-300 dark:decoration-white/30 dark:hover:decoration-white"
          >
            Reset to this plan&rsquo;s own default ({formatDistance(plan.referencePeakWeeklyMiles)} mi peak)
          </button>
        </div>
        {!targetPeakValid && (
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">Enter a target peak week above zero.</p>
        )}
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
          Every mileage-based day below scales to hold the same proportion of peak week it has in the original
          plan. Quality sessions already written as a percentage of pace (e.g. &ldquo;90% 5K&rdquo;) never change
          — see the{" "}
          <Link
            href="/pace-percent-calculator"
            className="underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
          >
            Pace Percent Calculator
          </Link>{" "}
          to turn one into an actual pace.
        </p>
      </div>

      <div className="space-y-8">
        {weeks.map((week, weekIndex) => {
          const weekTotal = week.reduce((sum, day) => sum + scaleDistance(day.totalDistance, scale), 0);
          return (
            <div key={weekIndex}>
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Week {weekIndex + 1}</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  {formatDistance(weekTotal)} {unit}
                </p>
              </div>
              <div className="mt-3 divide-y divide-black/5 overflow-hidden rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
                {week.map((day, dayIndex) => {
                  const isQuality = day.description !== "Rest" && !hasDistancePlaceholder(day.description);
                  const dayDistance = scaleDistance(day.totalDistance, scale);
                  return (
                    <div
                      key={dayIndex}
                      className="flex flex-col gap-1 bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 dark:bg-zinc-900"
                    >
                      <div className="flex items-baseline gap-3">
                        <span className="w-14 shrink-0 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                          Day {dayIndex + 1}
                        </span>
                        <span className="text-sm text-zinc-700 dark:text-zinc-200">
                          {renderDescription(day.description, scale, unit)}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 pl-14 sm:pl-0">
                        {dayDistance > 0 && (
                          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            {formatDistance(dayDistance)} {unit}
                          </span>
                        )}
                        {isQuality && (
                          <Link
                            href="/pace-percent-calculator"
                            className="text-xs font-semibold text-zinc-600 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-zinc-300 dark:decoration-white/30 dark:hover:decoration-white"
                          >
                            Calculate this pace →
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Not sure what your 5K pace (the anchor most quality sessions in this plan are built from) actually is?
        The{" "}
        <Link
          href="/pace-calculator"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Pace &amp; Heart Rate Calculator
        </Link>{" "}
        and{" "}
        <Link
          href="/cv-threshold-calculator"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Threshold, CV &amp; VO2max Pace Calculator
        </Link>{" "}
        can both help establish it.
      </p>
    </div>
  );
}
