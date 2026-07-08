"use client";

import { useActionState, useId, useState } from "react";

import { saveOnboarding } from "./actions";

const GOAL_DISTANCES = [
  { label: "1 Mile", meters: 1609 },
  { label: "5K", meters: 5000 },
  { label: "8K", meters: 8000 },
  { label: "10K", meters: 10000 },
  { label: "Half Marathon", meters: 21097 },
  { label: "Marathon", meters: 42195 },
];

const COURSE_TYPES = [
  { label: "Road", value: "road" },
  { label: "Track", value: "track" },
  { label: "Cross Country", value: "xc" },
  { label: "Trail", value: "trail" },
];

const fieldClass =
  "w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm text-zinc-900 transition focus:ring-2 focus:ring-zinc-900 focus:outline-none dark:border-white/10 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";
const labelClass =
  "mb-1 block text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300";

export function OnboardingForm() {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(saveOnboarding, {});
  const [includeResult, setIncludeResult] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Set your first goal
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            One goal race, and optionally your most recent result. That&rsquo;s
            all it takes to start personalizing things — nothing else is
            collected yet.
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
              className={fieldClass}
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
                className={fieldClass}
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

        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
