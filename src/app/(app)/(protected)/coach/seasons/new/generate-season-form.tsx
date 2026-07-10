"use client";

import { useActionState, useId } from "react";

import { generateSeason } from "@/app/(app)/(protected)/coach/actions";
import { GOAL_DISTANCES, dateFieldClass, fieldClass, labelClass } from "@/app/(app)/(protected)/dashboard/form-constants";

export function GenerateSeasonForm() {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(generateSeason, {});

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900"
    >
      <div>
        <label htmlFor={`${baseId}-name`} className={labelClass}>
          Season name
        </label>
        <input
          id={`${baseId}-name`}
          name="name"
          type="text"
          placeholder="e.g. Fall 2026 XC"
          required
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor={`${baseId}-race-name`} className={labelClass}>
          Goal race
        </label>
        <input
          id={`${baseId}-race-name`}
          name="goalRaceName"
          type="text"
          placeholder="e.g. State Meet"
          required
          className={fieldClass}
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <div>
          <label htmlFor={`${baseId}-race-date`} className={labelClass}>
            Goal race date
          </label>
          <input id={`${baseId}-race-date`} name="goalRaceDate" type="date" required className={dateFieldClass} />
        </div>
        <div>
          <label htmlFor={`${baseId}-distance`} className={labelClass}>
            Distance
          </label>
          <select id={`${baseId}-distance`} name="goalDistanceM" defaultValue={5000} required className={fieldClass}>
            {GOAL_DISTANCES.map((d) => (
              <option key={d.meters} value={d.meters}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div>
          <label htmlFor={`${baseId}-mileage`} className={labelClass}>
            Representative current weekly mileage
          </label>
          <input
            id={`${baseId}-mileage`}
            name="currentWeeklyMileage"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            required
            placeholder="e.g. 25"
            className={fieldClass}
          />
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            A typical varsity runner&rsquo;s mileage right now, in miles — used to shape the season&rsquo;s
            volume. Each athlete&rsquo;s own plan is generated from their own numbers later.
          </p>
        </div>
        <div>
          <label htmlFor={`${baseId}-days`} className={labelClass}>
            Days a week
          </label>
          <select id={`${baseId}-days`} name="daysPerWeek" defaultValue={5} required className={fieldClass}>
            {[3, 4, 5, 6].map((days) => (
              <option key={days} value={days}>
                {days} days
              </option>
            ))}
          </select>
        </div>
      </div>

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
        {isPending ? "Building your season…" : "Generate season"}
      </button>
    </form>
  );
}
