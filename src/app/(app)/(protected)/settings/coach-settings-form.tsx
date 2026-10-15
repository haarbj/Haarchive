"use client";

import { useId } from "react";

import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { useAutoSaveForm } from "@/lib/use-auto-save-form";
import { updateCoachSettings } from "./actions";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";

const fieldClass = `w-full ${baseFieldClass}`;

type CoachSettingsFormProps = {
  initialCoachDisplayName: string;
  initialCoachTrainsSelf: boolean | null;
  initialCoachBio: string;
  initialCoachPhilosophy: string;
  initialCoachDefaultVolumeUnit: "miles" | "minutes";
};

export function CoachSettingsForm({
  initialCoachDisplayName,
  initialCoachTrainsSelf,
  initialCoachBio,
  initialCoachPhilosophy,
  initialCoachDefaultVolumeUnit,
}: CoachSettingsFormProps) {
  const baseId = useId();
  const { state, formRef, isPending, scheduleSave, saveNow } = useAutoSaveForm(updateCoachSettings, {});

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        saveNow();
      }}
      className="space-y-5"
    >
      <div>
        <label htmlFor={`${baseId}-coach-display-name`} className={labelClass}>
          Coach display name (optional)
        </label>
        <input
          id={`${baseId}-coach-display-name`}
          name="coachDisplayName"
          type="text"
          placeholder="e.g. Coach Haar"
          defaultValue={initialCoachDisplayName}
          onBlur={scheduleSave}
          className={fieldClass}
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Shown to your athletes instead of your regular display name -- everywhere else on the site (comments,
          questions) still shows your regular name. Leave blank to use your regular display name everywhere.
        </p>
      </div>

      <div>
        <label htmlFor={`${baseId}-trains-self`} className={labelClass}>
          Do you also train and race yourself?
        </label>
        <select
          id={`${baseId}-trains-self`}
          name="coachTrainsSelf"
          defaultValue={initialCoachTrainsSelf === null ? "true" : String(initialCoachTrainsSelf)}
          onChange={scheduleSave}
          className={fieldClass}
        >
          <option value="true">Yes -- I train too</option>
          <option value="false">No -- coaching only</option>
        </select>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Decides whether Athlete Profile, Race Results, and Injuries show up below. Switching to &ldquo;Yes&rdquo;
          also sets you up to plan and track your own training -- schedule, check-ins, and coaching tools. Change
          this anytime.
        </p>
      </div>

      <div>
        <label htmlFor={`${baseId}-coach-bio`} className={labelClass}>
          Short bio (optional)
        </label>
        <input
          id={`${baseId}-coach-bio`}
          name="coachBio"
          type="text"
          maxLength={300}
          placeholder="e.g. Distance running coach, 10 years working with high school and masters athletes."
          defaultValue={initialCoachBio}
          onBlur={scheduleSave}
          className={fieldClass}
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          A one-line introduction your athletes see on your coach profile.
        </p>
      </div>

      <div>
        <label htmlFor={`${baseId}-coach-philosophy`} className={labelClass}>
          Training philosophy (optional)
        </label>
        <textarea
          id={`${baseId}-coach-philosophy`}
          name="coachPhilosophy"
          rows={8}
          maxLength={5000}
          placeholder="How you approach training -- mileage, intensity, recovery, race preparation, what you expect from athletes you coach..."
          defaultValue={initialCoachPhilosophy}
          onBlur={scheduleSave}
          className={fieldClass}
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          The longer explanation your athletes can read on your coach profile -- the reasoning behind how you coach,
          not just the workouts themselves.
        </p>
      </div>

      <div>
        <label htmlFor={`${baseId}-default-volume-unit`} className={labelClass}>
          Weekly Load unit
        </label>
        <select
          id={`${baseId}-default-volume-unit`}
          name="coachDefaultVolumeUnit"
          defaultValue={initialCoachDefaultVolumeUnit}
          onChange={scheduleSave}
          className={fieldClass}
        >
          <option value="miles">Miles</option>
          <option value="minutes">Minutes</option>
        </select>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Which figure the Weekly Load summary on an athlete&rsquo;s schedule leads with. Cross-training always shows
          separately in minutes either way.
        </p>
      </div>

      <AutoSaveStatus isPending={isPending} error={state.error} success={state.success} />
    </form>
  );
}
