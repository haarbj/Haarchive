"use client";

import { useActionState, useId } from "react";

import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { updateAthleteProfile } from "./actions";
import { Button } from "@/components/ui/button";

const fieldClass = `w-full ${baseFieldClass}`;

type AthleteProfileFormProps = {
  initialBirthYear: number | null;
  initialWeightLb: number | null;
  initialCurrentWeeklyMileage: number | null;
  initialDaysPerWeek: number | null;
};

export function AthleteProfileForm({
  initialBirthYear,
  initialWeightLb,
  initialCurrentWeeklyMileage,
  initialDaysPerWeek,
}: AthleteProfileFormProps) {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(updateAthleteProfile, {});

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${baseId}-birth-year`} className={labelClass}>
            Birth year
          </label>
          <input
            id={`${baseId}-birth-year`}
            name="birthYear"
            type="number"
            inputMode="numeric"
            defaultValue={initialBirthYear ?? undefined}
            placeholder="e.g. 1990"
            required
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor={`${baseId}-weight`} className={labelClass}>
            Weight (lb)
          </label>
          <input
            id={`${baseId}-weight`}
            name="weightLb"
            type="number"
            inputMode="decimal"
            step="0.1"
            defaultValue={initialWeightLb ?? undefined}
            placeholder="e.g. 155"
            required
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor={`${baseId}-mileage`} className={labelClass}>
            Current weekly mileage
          </label>
          <input
            id={`${baseId}-mileage`}
            name="currentWeeklyMileage"
            type="number"
            inputMode="decimal"
            step="0.1"
            defaultValue={initialCurrentWeeklyMileage ?? undefined}
            placeholder="e.g. 25"
            required
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor={`${baseId}-days`} className={labelClass}>
            Running days per week
          </label>
          <select id={`${baseId}-days`} name="daysPerWeek" defaultValue={initialDaysPerWeek ?? 5} className={fieldClass}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Used to prefill your fitness on Marathon Pacing Calculator and to estimate training load on your dashboard --
        never shown to anyone else.
      </p>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Saved.
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
