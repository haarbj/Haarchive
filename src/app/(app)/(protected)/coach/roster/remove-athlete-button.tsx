"use client";

import { removeAthleteFromRoster } from "./actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function RemoveAthleteButton({ athleteId, athleteName }: { athleteId: string; athleteName: string }) {
  return (
    <ConfirmButton
      action={() => removeAthleteFromRoster(athleteId)}
      confirmMessage={`Remove ${athleteName} from your roster? They keep their own training data either way.`}
      label="Remove"
      pendingLabel="Removing…"
      className="shrink-0 text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
    />
  );
}
