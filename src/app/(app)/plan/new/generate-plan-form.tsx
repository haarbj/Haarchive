"use client";

import { useActionState, useId } from "react";

import { generatePlan } from "@/app/(app)/plan/actions";
import { fieldClass, labelClass } from "@/app/(app)/dashboard/form-constants";

type GeneratePlanFormProps = {
  defaultCurrentWeeklyMileage?: number;
  defaultDaysPerWeek?: number;
};

export function GeneratePlanForm({
  defaultCurrentWeeklyMileage,
  defaultDaysPerWeek,
}: GeneratePlanFormProps) {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(generatePlan, {});

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900"
    >
      <div>
        <label htmlFor={`${baseId}-mileage`} className={labelClass}>
          Current weekly mileage
        </label>
        <input
          id={`${baseId}-mileage`}
          name="currentWeeklyMileage"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.1"
          required
          defaultValue={defaultCurrentWeeklyMileage}
          placeholder="e.g. 25"
          className={fieldClass}
        />
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          What you&rsquo;re running most weeks right now, in miles.
        </p>
      </div>

      <div>
        <label htmlFor={`${baseId}-days`} className={labelClass}>
          Days a week you run
        </label>
        <select
          id={`${baseId}-days`}
          name="daysPerWeek"
          defaultValue={defaultDaysPerWeek ?? 5}
          required
          className={fieldClass}
        >
          {[3, 4, 5, 6].map((days) => (
            <option key={days} value={days}>
              {days} days
            </option>
          ))}
        </select>
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
        {isPending ? "Building your plan…" : "Generate my training plan"}
      </button>
    </form>
  );
}
