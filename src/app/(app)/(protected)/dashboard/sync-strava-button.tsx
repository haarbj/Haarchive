"use client";

import { useActionState } from "react";

import { syncStravaActivities } from "@/app/(app)/(protected)/dashboard/strava-actions";

export function SyncStravaButton() {
  const [state, formAction, isPending] = useActionState(syncStravaActivities, {});

  return (
    <form action={formAction} className="flex items-center gap-3">
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
      >
        {isPending ? "Syncing…" : "Sync now"}
      </button>
      {state.error && (
        <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.syncedCount !== undefined && !state.error && (
        <p className="text-xs text-zinc-600 dark:text-zinc-300">
          {state.syncedCount === 0
            ? "No new runs matched a scheduled workout."
            : `Matched ${state.syncedCount} run${state.syncedCount === 1 ? "" : "s"} to scheduled workouts.`}
        </p>
      )}
    </form>
  );
}
