"use client";

import { useId } from "react";

import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { useAutoSaveForm } from "@/lib/use-auto-save-form";
import { updateProfile } from "./actions";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";

const fieldClass = `w-full ${baseFieldClass}`;

type SettingsFormProps = {
  initialDisplayName: string;
  initialUnits: "mi" | "km";
  initialEmailUnsubscribed: boolean;
  email: string;
};

export function SettingsForm({ initialDisplayName, initialUnits, initialEmailUnsubscribed, email }: SettingsFormProps) {
  const baseId = useId();
  const { state, formRef, isPending, scheduleSave, saveNow } = useAutoSaveForm(updateProfile, {});

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
        <p className={labelClass}>Email</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{email}</p>
      </div>

      <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input type="hidden" name="wasEmailUnsubscribed" value={initialEmailUnsubscribed ? "true" : "false"} />
        <input
          type="checkbox"
          name="emailUnsubscribed"
          defaultChecked={initialEmailUnsubscribed}
          onChange={scheduleSave}
          className="mt-0.5 accent-zinc-900 dark:accent-white"
        />
        <span>
          Don&rsquo;t email me about new articles, tools, or site updates
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
            The Haarchive doesn&rsquo;t send automated emails today -- this only controls whether you&rsquo;d be
            included if that ever changes.
          </span>
        </span>
      </label>

      <div>
        <label htmlFor={`${baseId}-display-name`} className={labelClass}>
          Display name
        </label>
        <input
          id={`${baseId}-display-name`}
          name="displayName"
          type="text"
          defaultValue={initialDisplayName}
          onBlur={scheduleSave}
          required
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor={`${baseId}-units`} className={labelClass}>
          Units
        </label>
        <select
          id={`${baseId}-units`}
          name="units"
          defaultValue={initialUnits}
          onChange={scheduleSave}
          className={fieldClass}
        >
          <option value="mi">Miles</option>
          <option value="km">Kilometers</option>
        </select>
      </div>

      <AutoSaveStatus isPending={isPending} error={state.error} success={state.success} />
    </form>
  );
}
