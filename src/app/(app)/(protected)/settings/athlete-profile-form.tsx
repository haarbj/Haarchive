"use client";

import { useActionState, useId } from "react";

import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { updateAthleteProfile } from "./actions";
import { ATHLETE_LEVELS, ATHLETE_LEVEL_LABELS, SEXES } from "@/lib/validation/athlete-profile";
import { Button } from "@/components/ui/button";

const fieldClass = `w-full ${baseFieldClass}`;

const SEX_LABELS: Record<(typeof SEXES)[number], string> = {
  male: "Male",
  female: "Female",
  unspecified: "Prefer not to say",
};

type AthleteProfileFormProps = {
  initialBirthYear: number | null;
  initialWeightLb: number | null;
  initialCurrentWeeklyMileage: number | null;
  initialDaysPerWeek: number | null;
  initialSex: (typeof SEXES)[number] | null;
  initialHeightIn: number | null;
  initialYearsRunning: number | null;
  initialCurrentLevel: (typeof ATHLETE_LEVELS)[number] | null;
  initialPrimaryEvent: string | null;
};

export function AthleteProfileForm({
  initialBirthYear,
  initialWeightLb,
  initialCurrentWeeklyMileage,
  initialDaysPerWeek,
  initialSex,
  initialHeightIn,
  initialYearsRunning,
  initialCurrentLevel,
  initialPrimaryEvent,
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

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${baseId}-sex`} className={labelClass}>
            Sex
          </label>
          <select id={`${baseId}-sex`} name="sex" defaultValue={initialSex ?? ""} className={fieldClass}>
            <option value="">Not set</option>
            {SEXES.map((s) => (
              <option key={s} value={s}>
                {SEX_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${baseId}-height`} className={labelClass}>
            Height (in)
          </label>
          <input
            id={`${baseId}-height`}
            name="heightIn"
            type="number"
            inputMode="decimal"
            step="0.1"
            defaultValue={initialHeightIn ?? undefined}
            placeholder="e.g. 68"
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor={`${baseId}-years-running`} className={labelClass}>
            Years running
          </label>
          <input
            id={`${baseId}-years-running`}
            name="yearsRunning"
            type="number"
            inputMode="numeric"
            defaultValue={initialYearsRunning ?? undefined}
            placeholder="e.g. 3"
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor={`${baseId}-level`} className={labelClass}>
            Current level
          </label>
          <select id={`${baseId}-level`} name="currentLevel" defaultValue={initialCurrentLevel ?? ""} className={fieldClass}>
            <option value="">Not set</option>
            {ATHLETE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {ATHLETE_LEVEL_LABELS[level]}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor={`${baseId}-primary-event`} className={labelClass}>
            Primary event (optional)
          </label>
          <input
            id={`${baseId}-primary-event`}
            name="primaryEvent"
            type="text"
            defaultValue={initialPrimaryEvent ?? ""}
            placeholder="e.g. 5000m, Marathon"
            className={fieldClass}
          />
        </div>
      </div>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Birth year, weight, mileage, and days/week prefill your fitness on Marathon Pacing Calculator and estimate
        training load on your dashboard. Everything on this page stays private -- visible only to you and, for
        athletes on a team, your coach.
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
