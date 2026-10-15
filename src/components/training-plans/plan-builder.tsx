"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";

import {
  generateTrainingPlan,
  describePrescription,
  workoutTypeLabel,
  diffDays,
  type WorkoutDraft,
  type MesocycleDraft,
} from "@/lib/coaching-engine";
import { parseTimeToSeconds } from "@/lib/running-format";
import { formatDate, titleCase } from "@/lib/format";
import { MILE_METERS, raceDistanceMap } from "@/lib/race-distances";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { LabeledInput } from "@/components/ui/labeled-input";
import { fieldClass, labelClass } from "@/lib/form-styles";
import {
  detailsBodyClass,
  detailsClass,
  heroCardClass,
  sectionLabelClass,
  statLabelClass,
  summaryClass,
} from "@/lib/tool-styles";

// A deliberately narrower set than the full RACE_DISTANCES catalog those
// calculators offer -- this tool builds a multi-week periodized plan, which
// only makes sense for the handful of distances people actually structure
// a training block around. Anything shorter (a mile, an 800m) would route
// through the exact same engine but produce a plan shape nobody searches
// for.
const GOAL_DISTANCE_KEYS = ["5k", "10k", "half", "marathon"];
const DAYS_PER_WEEK_OPTIONS = [3, 4, 5, 6];

type GeneratedPlan = {
  startDate: string;
  workouts: WorkoutDraft[];
  mesocycles: MesocycleDraft[];
};

function groupWorkoutsByWeek(plan: GeneratedPlan): { weekIndex: number; phase: string; workouts: WorkoutDraft[] }[] {
  const byWeek = new Map<number, WorkoutDraft[]>();
  for (const workout of plan.workouts) {
    const weekIndex = Math.floor(diffDays(plan.startDate, workout.scheduledDate) / 7);
    const bucket = byWeek.get(weekIndex) ?? [];
    bucket.push(workout);
    byWeek.set(weekIndex, bucket);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([weekIndex, workouts]) => ({
      weekIndex,
      phase: titleCase(plan.mesocycles[workouts[0].mesocycleIndex]?.phase ?? ""),
      workouts: workouts.slice().sort((a, b) => (a.scheduledDate < b.scheduledDate ? -1 : 1)),
    }));
}

// The public, no-account entry point into the same engine
// src/app/(app)/(protected)/plan/actions.ts's generatePlan already calls
// for a signed-in athlete with a saved goal/profile -- generateTrainingPlan
// itself is a pure function with zero I/O, so this calls it directly,
// client-side, with the form's own ephemeral inputs instead of a database
// round trip. Nothing entered here is sent anywhere or persisted; the two
// CTAs below a generated plan (save it, or get a coach to adjust it) are
// the only places this intentionally hands off to an account/coaching
// surface -- see CLAUDE.md §2's "editorial pages never sell; tools pages
// always offer a next step" rule, which this page is the concrete
// expression of on the tools side.
export function PlanBuilder() {
  const baseId = useId();
  const [distanceKey, setDistanceKey] = useState("marathon");
  const [goalTimeInput, setGoalTimeInput] = useState("");
  const [goalDateInput, setGoalDateInput] = useState("");
  const [mileageInput, setMileageInput] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPlan(null);

    const distance = raceDistanceMap.get(distanceKey);
    if (!distance) return setError("Pick a race distance.");

    const timeS = parseTimeToSeconds(goalTimeInput);
    if (timeS === null || timeS <= 0) return setError("Enter your goal time as mm:ss or h:mm:ss, e.g. 3:45:00.");

    if (!goalDateInput) return setError("Pick your race date.");

    const mileageMi = Number(mileageInput);
    if (!Number.isFinite(mileageMi) || mileageMi < 0) {
      return setError("Enter your current weekly mileage as a number, e.g. 25.");
    }

    const today = new Date().toISOString().slice(0, 10);
    const result = generateTrainingPlan({
      goal: { raceName: distance.label, distanceM: distance.meters, timeS, date: goalDateInput },
      athlete: { currentWeeklyMileageM: mileageMi * MILE_METERS, daysPerWeek },
      today,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPlan({ startDate: result.plan.startDate, workouts: result.workouts, mesocycles: result.mesocycles });
  }

  const weeks = plan ? groupWorkoutsByWeek(plan) : [];

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className={`${heroCardClass} space-y-5`}>
        <div className="grid grid-cols-1 gap-4 xs:grid-cols-2">
          <div>
            <label htmlFor={`${baseId}-distance`} className={labelClass}>
              Goal race
            </label>
            <select
              id={`${baseId}-distance`}
              value={distanceKey}
              onChange={(event) => setDistanceKey(event.target.value)}
              className={fieldClass}
            >
              {GOAL_DISTANCE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {raceDistanceMap.get(key)?.label}
                </option>
              ))}
            </select>
          </div>
          <LabeledInput
            id={`${baseId}-time`}
            label="Goal time"
            type="text"
            inputMode="numeric"
            placeholder="e.g. 3:45:00"
            value={goalTimeInput}
            onChange={(event) => setGoalTimeInput(event.target.value)}
          />
          <LabeledInput
            id={`${baseId}-date`}
            label="Race date"
            type="date"
            value={goalDateInput}
            onChange={(event) => setGoalDateInput(event.target.value)}
          />
          <LabeledInput
            id={`${baseId}-mileage`}
            label="Current weekly mileage"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            placeholder="e.g. 25"
            value={mileageInput}
            onChange={(event) => setMileageInput(event.target.value)}
          />
          <div>
            <label htmlFor={`${baseId}-days`} className={labelClass}>
              Days a week you run
            </label>
            <select
              id={`${baseId}-days`}
              value={daysPerWeek}
              onChange={(event) => setDaysPerWeek(Number(event.target.value))}
              className={fieldClass}
            >
              {DAYS_PER_WEEK_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {days} days
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <FormError>{error}</FormError>}

        <Button type="submit" size="lg">
          Build my plan
        </Button>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Nothing you enter here is sent anywhere or saved -- this runs entirely in your browser.
        </p>
      </form>

      {plan && (
        <div className="space-y-6">
          <div>
            <p className={sectionLabelClass}>Your plan</p>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
              {weeks.length} weeks, {plan.workouts.length} workouts, starting {formatDate(plan.startDate)}
            </h2>
          </div>

          <div className="space-y-3">
            {weeks.map((week) => (
              <details key={week.weekIndex} className={detailsClass} open={week.weekIndex === 0}>
                <summary className={summaryClass}>
                  <span className="flex-1">Week {week.weekIndex + 1}</span>
                  <span className={statLabelClass}>{week.phase}</span>
                </summary>
                <div className={detailsBodyClass}>
                  <ul className="space-y-3">
                    {week.workouts.map((workout) => (
                      <li key={workout.scheduledDate} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-semibold text-zinc-900 dark:text-white">
                          {formatDate(workout.scheduledDate)}
                        </span>
                        <span className={statLabelClass}>{workoutTypeLabel(workout.workoutType)}</span>
                        <span className="text-zinc-600 dark:text-zinc-300">
                          {describePrescription(workout.prescription)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            ))}
          </div>

          {/* Tools-layer conversion, not an editorial pitch -- see CLAUDE.md
              §2. Two real next steps, each honestly matched to what
              actually exists today: an account genuinely does save/track
              this (see dashboard/page.tsx's own race-history work), and
              /contact is the real, current way to start a coaching
              conversation -- there's no dedicated public coaching-sales
              page yet, so this links to what's actually there rather than
              a page that doesn't exist. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={`${heroCardClass} text-center`}>
              <p className="font-semibold text-zinc-900 dark:text-white">Want to save this and track it over time?</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                A free account keeps this plan, logs what you actually run, and adapts as your fitness changes.
              </p>
              <Button href="/signup" size="lg" className="mt-4">
                Create a free account
              </Button>
            </div>
            <div className={`${heroCardClass} text-center`}>
              <p className="font-semibold text-zinc-900 dark:text-white">Want a human adjusting this weekly?</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                This plan is a fixed starting point. A coach adjusts it as you actually respond to training.
              </p>
              <Button href="/contact" variant="outline" size="lg" className="mt-4">
                Get in touch about coaching
              </Button>
            </div>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            This plan is generated, not hand-written -- the same deterministic engine (periodization, mileage
            progression, pace zones) that builds a plan for a signed-in athlete, run here with the numbers you just
            entered. Paces are given as ranges because a single target number is rarely how real training paces are
            prescribed. Everything resets if you leave this page; create an account to keep it.
          </p>
        </div>
      )}

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Looking for a pre-written plan instead of a generated one?{" "}
        <Link
          href="/training-plans"
          className="font-semibold text-zinc-700 underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:text-zinc-200 dark:decoration-white/30 dark:hover:decoration-white/70"
        >
          See the five real marathon plans
        </Link>{" "}
        from John Davis&rsquo;s <em>Marathon Excellence for Everyone</em> instead.
      </p>
    </div>
  );
}
