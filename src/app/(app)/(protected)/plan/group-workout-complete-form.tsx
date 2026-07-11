"use client";

import { useActionState, useId, useState, useTransition } from "react";

import { deleteGroupWorkoutCompletion, logGroupWorkoutCompletion } from "./actions";
import { fieldClass, labelClass } from "@/app/(app)/(protected)/dashboard/form-constants";

// Mirrors WorkoutCard's completion form exactly (distance/time/HR/RPE/
// notes) -- a coach-authored group session has no prescription to compare
// actuals against, but the log matters just as much as it does for a
// self-generated plan.
//
// Collapsed by default: a week view can have several of these stacked, one
// per incomplete day, and showing all 5 inputs unconditionally for every
// one of them was a lot of visual weight before an athlete has decided to
// log anything -- the same "reveal on demand" pattern already used for
// "+ Add entry" and "Add a distance or pace" on the coach side.
export function GroupWorkoutCompleteForm({ workoutId, isRace = false }: { workoutId: string; isRace?: boolean }) {
  const baseId = useId();
  const [expanded, setExpanded] = useState(false);
  const [state, formAction, isPending] = useActionState(
    (_prevState: { error?: string }, formData: FormData) => logGroupWorkoutCompletion(workoutId, formData),
    {},
  );

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-3 inline-flex min-h-12 items-center text-sm font-semibold text-zinc-700 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-200 dark:decoration-white/20 dark:hover:decoration-white"
      >
        {isRace ? "Log your race result" : "Log this workout"}
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor={`${baseId}-distance`} className={labelClass}>
          Distance (mi)
        </label>
        <input id={`${baseId}-distance`} name="actualDistanceInput" type="text" inputMode="decimal" placeholder="optional" className={`${fieldClass} w-28`} />
      </div>
      <div>
        <label htmlFor={`${baseId}-time`} className={labelClass}>
          Time
        </label>
        <input id={`${baseId}-time`} name="actualTimeInput" type="text" placeholder="mm:ss" autoComplete="off" className={`${fieldClass} w-28`} />
      </div>
      <div>
        <label htmlFor={`${baseId}-hr`} className={labelClass}>
          Avg HR
        </label>
        <input id={`${baseId}-hr`} name="avgHeartRateInput" type="text" inputMode="numeric" placeholder="optional" className={`${fieldClass} w-24`} />
      </div>
      <div>
        <label htmlFor={`${baseId}-rpe`} className={labelClass}>
          RPE
        </label>
        <select id={`${baseId}-rpe`} name="rpeInput" defaultValue="" className={`${fieldClass} w-20`}>
          <option value="">—</option>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="w-full">
        <label htmlFor={`${baseId}-notes`} className={labelClass}>
          Notes
        </label>
        <input id={`${baseId}-notes`} name="notesInput" type="text" placeholder="How did it feel? Anything worth remembering?" className={fieldClass} />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? "Saving…" : isRace ? "Log your race result" : "Mark complete"}
        </button>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="min-h-12 rounded-lg px-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400"
        >
          Cancel
        </button>
      </div>
      {state.error && (
        <p role="alert" className="w-full text-sm font-medium text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function UndoGroupCompletionButton({ workoutId }: { workoutId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(async () => { await deleteGroupWorkoutCompletion(workoutId); })}
      className="-ml-2 inline-flex min-h-12 items-center rounded-lg px-2 text-xs font-semibold text-zinc-500 underline decoration-black/10 underline-offset-2 hover:decoration-black disabled:opacity-60 dark:text-zinc-400 dark:decoration-white/10 dark:hover:decoration-white"
    >
      {isPending ? "Saving…" : "Undo"}
    </button>
  );
}
