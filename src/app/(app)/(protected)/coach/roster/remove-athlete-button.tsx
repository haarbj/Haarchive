"use client";

import { useTransition } from "react";

import { removeAthleteFromRoster } from "./actions";

export function RemoveAthleteButton({ athleteId, athleteName }: { athleteId: string; athleteName: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (window.confirm(`Remove ${athleteName} from your roster? They keep their own training data either way.`)) {
          startTransition(() => removeAthleteFromRoster(athleteId));
        }
      }}
      className="shrink-0 text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
    >
      {isPending ? "Removing…" : "Remove"}
    </button>
  );
}
