"use client";

import { useActionState } from "react";

import { createGroup } from "@/app/(app)/(protected)/coach/groups-actions";
import { fieldClass } from "@/lib/form-styles";

export function CreateGroupForm() {
  const [state, formAction, isPending] = useActionState(createGroup, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="group-name" className="mb-1 block text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
          New group name
        </label>
        <input
          id="group-name"
          name="name"
          type="text"
          placeholder="e.g. Varsity Boys"
          required
          className={`${fieldClass} w-64`}
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Creating…" : "Create group"}
      </button>
      {state.error && (
        <p role="alert" className="w-full text-sm font-medium text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
