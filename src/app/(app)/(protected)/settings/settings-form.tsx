"use client";

import { useActionState, useId } from "react";

import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { updateProfile } from "./actions";

const fieldClass = `w-full ${baseFieldClass}`;

type SettingsFormProps = {
  initialDisplayName: string;
  initialUnits: "mi" | "km";
  email: string;
};

export function SettingsForm({ initialDisplayName, initialUnits, email }: SettingsFormProps) {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(updateProfile, {});

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <p className={labelClass}>Email</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{email}</p>
      </div>

      <div>
        <label htmlFor={`${baseId}-display-name`} className={labelClass}>
          Display name
        </label>
        <input
          id={`${baseId}-display-name`}
          name="displayName"
          type="text"
          defaultValue={initialDisplayName}
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
          className={fieldClass}
        >
          <option value="mi">Miles</option>
          <option value="km">Kilometers</option>
        </select>
      </div>

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

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
