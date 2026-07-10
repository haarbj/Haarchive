"use client";

import { useTransition } from "react";

import { toggleGroupWorkoutCompletion } from "./actions";

export function GroupWorkoutCompleteButton({ workoutId, completed }: { workoutId: string; completed: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(async () => { await toggleGroupWorkoutCompletion(workoutId, completed); })}
      className="text-xs font-semibold text-zinc-700 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-60 dark:text-zinc-200 dark:decoration-white/20 dark:hover:decoration-white"
    >
      {isPending ? "Saving…" : completed ? "Mark not done" : "Mark complete"}
    </button>
  );
}
