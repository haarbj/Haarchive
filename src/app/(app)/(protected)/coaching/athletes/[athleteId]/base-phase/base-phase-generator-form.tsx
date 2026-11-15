"use client";

import { useState } from "react";

import { addBasePhaseToSchedule, previewBasePhase, type BasePhaseDefaults } from "./actions";
import {
  DEFAULT_RESTART_STEP_MILES,
  DEFAULT_WORKOUT_DAYS_PER_WEEK,
  INJURY_RETURN_CRITERIA,
  MAX_DAYS_PER_WEEK,
  MIN_DAYS_PER_WEEK,
  type BasePhaseAthleteType,
  type BasePhasePlan,
  type BasePhaseWeek,
} from "@/lib/private-coaching/base-phase-generator";
import type { AcwrZone } from "@/lib/acwr";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

// Same label/tone map as the Training Load Planner's own component
// (src/components/training-load-planner.tsx) -- display-only strings, not
// safety math, so a small local copy here (rather than exporting UI
// constants out of that component file) is the reasonable choice.
const ZONE_LABEL: Record<AcwrZone, string> = {
  undertrained: "Undertraining / losing fitness",
  "sweet-spot": "Safe progression",
  caution: "Caution",
  "high-risk": "High injury risk",
};

const ZONE_TONE: Record<AcwrZone, BadgeTone> = {
  undertrained: "neutral",
  "sweet-spot": "success",
  caution: "warning",
  "high-risk": "error",
};

function mostRecentMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function addWeeksIso(isoDate: string, weeks: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

function weeksBetween(fromIso: string, toIso: string): number {
  const ms = new Date(`${toIso}T00:00:00Z`).getTime() - new Date(`${fromIso}T00:00:00Z`).getTime();
  return Math.max(1, Math.round(ms / (7 * 24 * 60 * 60 * 1000)));
}

type EditableWeek = BasePhaseWeek;

// The coach-facing wizard for base-phase-generator.ts: describe the plan's
// own first workout week (its total mileage and day structure), preview a
// suggested week-by-week base template built backwards from it using the
// coach's percentage method, adjust anything before confirming, then add it
// to the schedule. Nothing is auto-applied -- see that module's own header
// for what's reused from the Training Load Planner vs newly built here.
export function BasePhaseGeneratorForm({ athleteId, defaults }: { athleteId: string; defaults: BasePhaseDefaults }) {
  const [startingWeeklyMiles, setStartingWeeklyMiles] = useState(
    defaults.startingWeeklyMiles != null ? String(defaults.startingWeeklyMiles) : "",
  );
  const [targetTotalMiles, setTargetTotalMiles] = useState("");
  const [targetDaysPerWeek, setTargetDaysPerWeek] = useState(String(MAX_DAYS_PER_WEEK));
  const [workoutDaysPerWeek, setWorkoutDaysPerWeek] = useState(String(DEFAULT_WORKOUT_DAYS_PER_WEEK));
  const [timingMode, setTimingMode] = useState<"weeksAvailable" | "planStartDate">("planStartDate");
  const todayMonday = mostRecentMonday(new Date());
  const [weeksAvailableInput, setWeeksAvailableInput] = useState("6");
  const [planStartDateInput, setPlanStartDateInput] = useState("");
  const [athleteType, setAthleteType] = useState<BasePhaseAthleteType>("restarting");
  const [restartStepMiles, setRestartStepMiles] = useState(String(DEFAULT_RESTART_STEP_MILES));
  const [currentDaysPerWeek, setCurrentDaysPerWeek] = useState(
    defaults.currentDaysPerWeek != null ? String(defaults.currentDaysPerWeek) : String(MIN_DAYS_PER_WEEK),
  );
  const [longestRunInput, setLongestRunInput] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [blockedForInjuryHistory, setBlockedForInjuryHistory] = useState(defaults.hasInjuryHistory);
  const [injuryHistoryText, setInjuryHistoryText] = useState(defaults.injuryHistoryText);
  const [plan, setPlan] = useState<BasePhasePlan | null>(null);
  const [editableWeeks, setEditableWeeks] = useState<EditableWeek[]>([]);
  const [resolvedPlanStartDate, setResolvedPlanStartDate] = useState<string>("");
  const [addResult, setAddResult] = useState<{ daysCreated: number } | null>(null);

  function resolveWeeksAndStart(): { weeksAvailable: number; planStartDate: string } {
    if (timingMode === "planStartDate" && planStartDateInput) {
      return { weeksAvailable: weeksBetween(todayMonday, mostRecentMonday(new Date(`${planStartDateInput}T00:00:00Z`))), planStartDate: planStartDateInput };
    }
    const weeks = Math.max(1, Math.round(Number(weeksAvailableInput) || 1));
    return { weeksAvailable: weeks, planStartDate: addWeeksIso(todayMonday, weeks) };
  }

  async function handlePreview() {
    setError(null);
    const starting = Number(startingWeeklyMiles);
    const target = Number(targetTotalMiles);
    if (!Number.isFinite(starting) || starting < 0) return setError("Enter a starting weekly mileage.");
    if (!Number.isFinite(target) || target <= 0) return setError("Enter the plan's first workout week's total mileage.");
    const { weeksAvailable, planStartDate } = resolveWeeksAndStart();
    if (timingMode === "planStartDate" && !planStartDateInput) return setError("Pick the plan's start date.");

    const targetDays = Math.max(MIN_DAYS_PER_WEEK, Math.min(MAX_DAYS_PER_WEEK, Math.round(Number(targetDaysPerWeek) || MAX_DAYS_PER_WEEK)));
    const currentDays = Math.max(MIN_DAYS_PER_WEEK, Math.min(MAX_DAYS_PER_WEEK, Math.round(Number(currentDaysPerWeek) || MIN_DAYS_PER_WEEK)));
    const workoutDays = Math.max(1, Math.min(targetDays - 1, Math.round(Number(workoutDaysPerWeek) || DEFAULT_WORKOUT_DAYS_PER_WEEK)));
    const longestRun = longestRunInput.trim() ? Number(longestRunInput) : null;

    setIsPending(true);
    const result = await previewBasePhase(athleteId, {
      startingWeeklyMiles: starting,
      targetWeek: { totalMiles: target, daysPerWeek: targetDays, workoutDaysPerWeek: workoutDays },
      weeksAvailable,
      athleteType,
      currentDaysPerWeek: currentDays,
      longestRunInLast30DaysMiles: longestRun,
      restartStepMiles: athleteType === "restarting" ? Math.max(1, Number(restartStepMiles) || DEFAULT_RESTART_STEP_MILES) : undefined,
    });
    setIsPending(false);

    if (result.blockedForInjuryHistory) {
      setBlockedForInjuryHistory(true);
      setInjuryHistoryText(result.injuryHistoryText ?? null);
      return;
    }
    if (result.error || !result.plan) return setError(result.error ?? "Couldn't generate a template.");

    setPlan(result.plan);
    setEditableWeeks(result.plan.weeks);
    setResolvedPlanStartDate(planStartDate);
  }

  function updateWeek(weekNumber: number, patch: Partial<EditableWeek>) {
    setEditableWeeks((prev) => prev.map((w) => (w.weekNumber === weekNumber ? { ...w, ...patch } : w)));
  }

  function updateMlr(weekNumber: number, index: number, value: number) {
    setEditableWeeks((prev) =>
      prev.map((w) => (w.weekNumber === weekNumber ? { ...w, mlrMiles: w.mlrMiles.map((m, i) => (i === index ? value : m)) } : w)),
    );
  }

  function updateEasy(weekNumber: number, index: number, value: number) {
    setEditableWeeks((prev) =>
      prev.map((w) => (w.weekNumber === weekNumber ? { ...w, easyMiles: w.easyMiles.map((m, i) => (i === index ? value : m)) } : w)),
    );
  }

  async function handleConfirm() {
    setError(null);
    setIsPending(true);
    const result = await addBasePhaseToSchedule(
      athleteId,
      resolvedPlanStartDate,
      editableWeeks.map((w) => ({ weekNumber: w.weekNumber, longRunMiles: w.longRunMiles, mlrMiles: w.mlrMiles, easyMiles: w.easyMiles })),
    );
    setIsPending(false);
    if (result.error) return setError(result.error);
    setAddResult({ daysCreated: result.daysCreated ?? 0 });
  }

  if (blockedForInjuryHistory) {
    return (
      <div className="space-y-4 rounded-control border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          This athlete has reported injury history -- the generator won&rsquo;t auto-build a progression.
        </p>
        {injuryHistoryText ? (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            <span className="font-medium">What they&rsquo;ve told their coach:</span> {injuryHistoryText}
          </p>
        ) : null}
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Plan this one by hand, against return-to-running criteria rather than a standard progression:
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
          {INJURY_RETURN_CRITERIA.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (addResult) {
    return (
      <div className="space-y-3 rounded-control border border-black/10 p-4 dark:border-white/10">
        <p className="text-sm font-medium text-zinc-900 dark:text-white">
          Added {addResult.daysCreated} days across {editableWeeks.length} week{editableWeeks.length === 1 ? "" : "s"} as
          unpublished drafts.
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Review them on {defaults.athleteName}&rsquo;s schedule and publish when ready -- nothing here is visible to
          the athlete yet.
        </p>
        <Button href={`/coaching/athletes/${athleteId}/schedule`} size="sm">
          Go to schedule
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-control border border-black/10 p-3 dark:border-white/10">
      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Starting weekly mileage</span>
          <input
            value={startingWeeklyMiles}
            onChange={(e) => {
              setStartingWeeklyMiles(e.target.value);
              setPlan(null);
            }}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Plan&rsquo;s first workout week -- total miles</span>
          <input
            value={targetTotalMiles}
            onChange={(e) => {
              setTargetTotalMiles(e.target.value);
              setPlan(null);
            }}
            className={fieldClass}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
        <label className="block">
          <span className={labelClass}>That week&rsquo;s day count (Sunday always off)</span>
          <input
            type="number"
            min={MIN_DAYS_PER_WEEK}
            max={MAX_DAYS_PER_WEEK}
            value={targetDaysPerWeek}
            onChange={(e) => {
              setTargetDaysPerWeek(e.target.value);
              setPlan(null);
            }}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Workout days in the plan&rsquo;s general phase</span>
          <input
            type="number"
            min={1}
            value={workoutDaysPerWeek}
            onChange={(e) => {
              setWorkoutDaysPerWeek(e.target.value);
              setPlan(null);
            }}
            className={fieldClass}
          />
          <span className="mt-1.5 block text-xs text-zinc-500 dark:text-zinc-400">
            Sets how many medium-long runs the base phase builds toward -- two workouts means two MLRs.
          </span>
        </label>
      </div>

      <div>
        <p className={labelClass}>Timing</p>
        <div className="mt-1.5 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setTimingMode("planStartDate");
              setPlan(null);
            }}
            className={`rounded-control border px-3 py-1.5 text-sm font-medium ${
              timingMode === "planStartDate"
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                : "border-black/10 text-zinc-600 hover:border-black/20 dark:border-white/10 dark:text-zinc-300 dark:hover:border-white/20"
            }`}
          >
            Plan start date
          </button>
          <button
            type="button"
            onClick={() => {
              setTimingMode("weeksAvailable");
              setPlan(null);
            }}
            className={`rounded-control border px-3 py-1.5 text-sm font-medium ${
              timingMode === "weeksAvailable"
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                : "border-black/10 text-zinc-600 hover:border-black/20 dark:border-white/10 dark:text-zinc-300 dark:hover:border-white/20"
            }`}
          >
            Weeks available
          </button>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-3 xs:grid-cols-2">
          {timingMode === "planStartDate" ? (
            <label className="block">
              <span className={labelClass}>Plan start date</span>
              <input
                type="date"
                value={planStartDateInput}
                onChange={(e) => {
                  setPlanStartDateInput(e.target.value);
                  setPlan(null);
                }}
                className={fieldClass}
              />
            </label>
          ) : (
            <label className="block">
              <span className={labelClass}>Weeks available</span>
              <input
                type="number"
                min={1}
                max={52}
                value={weeksAvailableInput}
                onChange={(e) => {
                  setWeeksAvailableInput(e.target.value);
                  setPlan(null);
                }}
                className={fieldClass}
              />
            </label>
          )}
        </div>
      </div>

      <div>
        <p className={labelClass}>Athlete type</p>
        <div className="mt-1.5 space-y-2">
          <label className="flex items-start gap-2 rounded-control border border-black/10 p-2 text-sm text-zinc-700 dark:border-white/10 dark:text-zinc-300">
            <input
              type="radio"
              checked={athleteType === "restarting"}
              onChange={() => {
                setAthleteType("restarting");
                setPlan(null);
              }}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium text-zinc-900 dark:text-white">Restarting</span> -- has run consistently
              before, just currently below the plan&rsquo;s starting mileage. Can close the gap faster than the
              standard 10% rule, which applies once the plan itself starts.
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-control border border-black/10 p-2 text-sm text-zinc-700 dark:border-white/10 dark:text-zinc-300">
            <input
              type="radio"
              checked={athleteType === "beginner"}
              onChange={() => {
                setAthleteType("beginner");
                setPlan(null);
              }}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium text-zinc-900 dark:text-white">True beginner</span> -- no real aerobic
              base. Follows the platform&rsquo;s standard 10% rule, same math as the Training Load Planner, started
              very easy and short, in gradual stages, run-walk as needed.
            </span>
          </label>
        </div>
        {athleteType === "restarting" ? (
          <label className="mt-2 block max-w-[10rem]">
            <span className={labelClass}>Weekly step (mi)</span>
            <input
              value={restartStepMiles}
              onChange={(e) => {
                setRestartStepMiles(e.target.value);
                setPlan(null);
              }}
              className={fieldClass}
            />
          </label>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Current days/week ({MIN_DAYS_PER_WEEK}-{MAX_DAYS_PER_WEEK})</span>
          <input
            type="number"
            min={MIN_DAYS_PER_WEEK}
            max={MAX_DAYS_PER_WEEK}
            value={currentDaysPerWeek}
            onChange={(e) => {
              setCurrentDaysPerWeek(e.target.value);
              setPlan(null);
            }}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Longest run, last 30 days (mi, optional)</span>
          <input
            value={longestRunInput}
            onChange={(e) => {
              setLongestRunInput(e.target.value);
              setPlan(null);
            }}
            className={fieldClass}
          />
        </label>
      </div>

      {error && <FormError>{error}</FormError>}

      {!plan ? (
        <Button type="button" size="sm" disabled={isPending} onClick={handlePreview}>
          {isPending ? "Generating…" : "Generate template"}
        </Button>
      ) : (
        <div className="space-y-4">
          {plan.guardrail.tooAggressive ? (
            <div className="space-y-2 rounded-control border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">This build is too aggressive as entered.</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{plan.guardrail.reason}</p>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-control border border-black/10 dark:border-white/10">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 bg-zinc-900/[0.03] dark:border-white/10 dark:bg-white/[0.04]">
                  <th className="px-3 py-2 font-semibold text-zinc-900 dark:text-white">Week</th>
                  <th className="px-3 py-2 font-semibold text-zinc-900 dark:text-white">Total mi</th>
                  <th className="px-3 py-2 font-semibold text-zinc-900 dark:text-white">Days</th>
                  <th className="px-3 py-2 font-semibold text-zinc-900 dark:text-white">Long run</th>
                  <th className="px-3 py-2 font-semibold text-zinc-900 dark:text-white">MLRs</th>
                  <th className="px-3 py-2 font-semibold text-zinc-900 dark:text-white">Easy days</th>
                  <th className="px-3 py-2 font-semibold text-zinc-900 dark:text-white">Zone</th>
                  <th className="px-3 py-2 font-semibold text-zinc-900 dark:text-white">Notes</th>
                </tr>
              </thead>
              <tbody>
                {editableWeeks.map((week) => (
                  <tr key={week.weekNumber} className="border-b border-black/5 last:border-0 dark:border-white/5 align-top">
                    <td className="px-3 py-2 font-medium text-zinc-900 dark:text-white">{week.weekNumber}</td>
                    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{week.totalMiles}</td>
                    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{week.daysPerWeek}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step={0.5}
                        value={week.longRunMiles}
                        onChange={(e) => updateWeek(week.weekNumber, { longRunMiles: Number(e.target.value) || 0 })}
                        className={`${fieldClass} w-20`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {week.mlrMiles.map((mi, i) => (
                          <input
                            key={i}
                            type="number"
                            step={0.5}
                            value={mi}
                            onChange={(e) => updateMlr(week.weekNumber, i, Number(e.target.value) || 0)}
                            className={`${fieldClass} w-16`}
                          />
                        ))}
                        {week.mlrMiles.length === 0 ? <span className="text-xs text-zinc-400">--</span> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {week.easyMiles.map((mi, i) => (
                          <input
                            key={i}
                            type="number"
                            step={0.5}
                            value={mi}
                            onChange={(e) => updateEasy(week.weekNumber, i, Number(e.target.value) || 0)}
                            className={`${fieldClass} w-16`}
                          />
                        ))}
                        {week.easyMiles.length === 0 ? <span className="text-xs text-zinc-400">none</span> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {week.acwrZone ? <Badge tone={ZONE_TONE[week.acwrZone]}>{ZONE_LABEL[week.acwrZone]}</Badge> : null}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300">
                      {week.notes.map((n, i) => (
                        <p key={i} className={i > 0 ? "mt-1" : undefined}>
                          {n}
                        </p>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Adjust anything above before confirming. The long run and MLRs land on the days that stay structural once
            the plan starts; Sunday is always off. Every day lands as an unpublished draft on {defaults.athleteName}
            &rsquo;s schedule, ending the week before {resolvedPlanStartDate} -- nothing is visible to the athlete
            until you publish it.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" disabled={isPending} onClick={handleConfirm}>
              {isPending ? "Adding…" : `Add ${editableWeeks.length} week${editableWeeks.length === 1 ? "" : "s"} to schedule`}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPlan(null)}>
              Start over
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
