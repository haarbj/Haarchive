"use client";

import { useActionState, useId, useState } from "react";

import { saveOnboarding } from "./actions";
import {
  COURSE_TYPES,
  GOAL_DISTANCES,
  dateFieldClass,
  fieldClass,
  labelClass,
} from "./form-constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type OnboardingFormProps = {
  // Team-connected athletes get their training plan from their coach, not
  // from this goal -- the copy here shifts from "this drives your plan" to
  // a purely psychological framing (why the goal matters to you, not what
  // it unlocks) so it doesn't imply something that isn't true for them.
  teamConnected?: boolean;
};

export function OnboardingForm({ teamConnected = false }: OnboardingFormProps) {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(saveOnboarding, {});
  const [includeResult, setIncludeResult] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  if (dismissed) return null;

  return (
    <Card padding="md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {teamConnected ? "Set a goal for yourself" : "Set your first goal"}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            {teamConnected
              ? "Your coach builds your actual training -- this is just for you: something to aim for, and a reason to care about the work each day. Why does this goal matter to you?"
              : "One goal race, and optionally your most recent result. That’s all it takes to start personalizing things — nothing else is collected yet."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        >
          Maybe later
        </button>
      </div>

      <form action={formAction} className="mt-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${baseId}-goal-race-name`} className={labelClass}>
              Goal race
            </label>
            <input
              id={`${baseId}-goal-race-name`}
              name="goalRaceName"
              type="text"
              placeholder="e.g. City Half Marathon"
              required
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor={`${baseId}-goal-distance`} className={labelClass}>
              Distance
            </label>
            <select
              id={`${baseId}-goal-distance`}
              name="goalDistanceM"
              defaultValue={GOAL_DISTANCES[3].meters}
              required
              className={fieldClass}
            >
              {GOAL_DISTANCES.map((d) => (
                <option key={d.label} value={d.meters}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${baseId}-goal-time`} className={labelClass}>
              Goal time (optional)
            </label>
            <input
              id={`${baseId}-goal-time`}
              name="goalTimeInput"
              type="text"
              placeholder="mm:ss or h:mm:ss"
              autoComplete="off"
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor={`${baseId}-goal-date`} className={labelClass}>
              Race date (optional)
            </label>
            <input
              id={`${baseId}-goal-date`}
              name="goalDate"
              type="date"
              min={today}
              className={dateFieldClass}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={includeResult}
            onChange={(event) => setIncludeResult(event.target.checked)}
            className="h-4 w-4 rounded border-black/20 dark:border-white/20"
          />
          Also add your most recent race result
        </label>

        {includeResult && (
          <div className="grid gap-4 rounded-xl bg-black/[0.02] p-4 sm:grid-cols-2 dark:bg-white/[0.03]">
            <div>
              <label htmlFor={`${baseId}-result-race-name`} className={labelClass}>
                Race name
              </label>
              <input
                id={`${baseId}-result-race-name`}
                name="resultRaceName"
                type="text"
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor={`${baseId}-result-race-date`} className={labelClass}>
                Race date
              </label>
              <input
                id={`${baseId}-result-race-date`}
                name="resultRaceDate"
                type="date"
                max={today}
                className={dateFieldClass}
              />
            </div>
            <div>
              <label htmlFor={`${baseId}-result-distance`} className={labelClass}>
                Distance
              </label>
              <select
                id={`${baseId}-result-distance`}
                name="resultDistanceM"
                defaultValue={GOAL_DISTANCES[1].meters}
                className={fieldClass}
              >
                {GOAL_DISTANCES.map((d) => (
                  <option key={d.label} value={d.meters}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${baseId}-result-time`} className={labelClass}>
                Finish time
              </label>
              <input
                id={`${baseId}-result-time`}
                name="resultFinishTimeInput"
                type="text"
                placeholder="mm:ss or h:mm:ss"
                autoComplete="off"
                className={fieldClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor={`${baseId}-result-course`} className={labelClass}>
                Course
              </label>
              <select
                id={`${baseId}-result-course`}
                name="resultCourseType"
                defaultValue="road"
                className={fieldClass}
              >
                {COURSE_TYPES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {state.error && (
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
            {state.error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </form>
    </Card>
  );
}
