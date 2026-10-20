"use client";

import { useId } from "react";

import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { useAutoSaveForm } from "@/lib/use-auto-save-form";
import { updateAthleteProfile } from "./actions";
import {
  ATHLETE_LEVELS,
  ATHLETE_LEVEL_LABELS,
  SEXES,
  TRAINING_FACILITIES,
  TRAINING_FACILITY_LABELS,
  WEEKDAYS,
} from "@/lib/validation/athlete-profile";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";

const fieldClass = `w-full ${baseFieldClass}`;

const currentYear = new Date().getFullYear();

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
  initialTrainingFacilities: string[] | null;
  initialHomeAltitudeM: number | null;
  initialRecentTrainingDetail: string | null;
  initialLongRunDay: string | null;
  initialBlackoutDays: string[] | null;
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
  initialTrainingFacilities,
  initialHomeAltitudeM,
  initialRecentTrainingDetail,
  initialLongRunDay,
  initialBlackoutDays,
}: AthleteProfileFormProps) {
  const baseId = useId();
  const { state, formRef, isPending, scheduleSave, saveNow } = useAutoSaveForm(updateAthleteProfile, {});

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        saveNow();
      }}
      className="space-y-5"
    >
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
            min={currentYear - 100}
            max={currentYear - 5}
            defaultValue={initialBirthYear ?? undefined}
            placeholder="e.g. 1990"
            onBlur={scheduleSave}
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
            min={1}
            max={600}
            defaultValue={initialWeightLb ?? undefined}
            placeholder="e.g. 155"
            onBlur={scheduleSave}
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
            min={0.1}
            max={200}
            defaultValue={initialCurrentWeeklyMileage ?? undefined}
            placeholder="e.g. 25"
            onBlur={scheduleSave}
            required
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor={`${baseId}-days`} className={labelClass}>
            Running days per week
          </label>
          <select
            id={`${baseId}-days`}
            name="daysPerWeek"
            defaultValue={initialDaysPerWeek ?? 5}
            onChange={scheduleSave}
            className={fieldClass}
          >
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
          <select id={`${baseId}-sex`} name="sex" defaultValue={initialSex ?? ""} onChange={scheduleSave} className={fieldClass}>
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
            min={0.1}
            max={96}
            defaultValue={initialHeightIn ?? undefined}
            placeholder="e.g. 68"
            onBlur={scheduleSave}
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
            min={0}
            max={90}
            defaultValue={initialYearsRunning ?? undefined}
            placeholder="e.g. 3"
            onBlur={scheduleSave}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor={`${baseId}-level`} className={labelClass}>
            Current level
          </label>
          <select
            id={`${baseId}-level`}
            name="currentLevel"
            defaultValue={initialCurrentLevel ?? ""}
            onChange={scheduleSave}
            className={fieldClass}
          >
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
            onBlur={scheduleSave}
            className={fieldClass}
          />
        </div>
      </div>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Birth year, weight, mileage, and days/week prefill your fitness on Marathon Pacing Calculator and estimate
        training load on your dashboard. Everything on this page stays private -- visible only to you and, for
        athletes on a team, your coach.
      </p>

      {/* Intake gap-check (see intake-gaps.ts): what a coach needs to
          know before planning, beyond the fitness basics above. Nothing
          here is required -- a coach sees exactly what's missing and can
          proceed anyway. */}
      <div className="border-t border-black/10 pt-5 dark:border-white/10">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">Training environment &amp; schedule</p>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
          What your coach needs to plan around -- what you have access to, where you train, and how your week
          actually fits together.
        </p>

        <div className="mt-4">
          <p className={labelClass}>What do you have access to?</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {TRAINING_FACILITIES.map((facility) => (
              <label key={facility} className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-200">
                <input
                  type="checkbox"
                  name="trainingFacilities"
                  value={facility}
                  defaultChecked={initialTrainingFacilities?.includes(facility) ?? false}
                  onChange={scheduleSave}
                  className="h-4 w-4 rounded border-black/20 dark:border-white/20"
                />
                {TRAINING_FACILITY_LABELS[facility]}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${baseId}-altitude`} className={labelClass}>
              Home training altitude (meters)
            </label>
            <input
              id={`${baseId}-altitude`}
              name="homeAltitudeM"
              type="number"
              inputMode="numeric"
              min={0}
              max={6000}
              defaultValue={initialHomeAltitudeM ?? undefined}
              placeholder="e.g. 0 for sea level"
              onBlur={scheduleSave}
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor={`${baseId}-long-run-day`} className={labelClass}>
              Long-run day
            </label>
            <select
              id={`${baseId}-long-run-day`}
              name="longRunDay"
              defaultValue={initialLongRunDay ?? ""}
              onChange={scheduleSave}
              className={fieldClass}
            >
              <option value="">Not set</option>
              {WEEKDAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <p className={labelClass}>Blackout days (optional -- any day you&rsquo;re never available to train)</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {WEEKDAYS.map((day) => (
              <label key={day} className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-200">
                <input
                  type="checkbox"
                  name="blackoutDays"
                  value={day}
                  defaultChecked={initialBlackoutDays?.includes(day) ?? false}
                  onChange={scheduleSave}
                  className="h-4 w-4 rounded border-black/20 dark:border-white/20"
                />
                {day}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor={`${baseId}-recent-training`} className={labelClass}>
            Your last 2-4 weeks of training
          </label>
          <textarea
            id={`${baseId}-recent-training`}
            name="recentTrainingDetail"
            rows={4}
            defaultValue={initialRecentTrainingDetail ?? ""}
            placeholder="What does a typical week look like, what's your long run distance, and describe one recent key workout (type, distance, effort)."
            onBlur={scheduleSave}
            className={fieldClass}
          />
        </div>
      </div>

      <AutoSaveStatus isPending={isPending} error={state.error} success={state.success} />
    </form>
  );
}
