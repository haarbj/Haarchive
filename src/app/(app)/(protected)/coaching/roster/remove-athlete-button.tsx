"use client";

import { removeAthleteFromRoster } from "./actions";
import { notifyRosterChanged } from "./roster-events";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function RemoveAthleteButton({
  coachAthleteId,
  athleteName,
}: {
  coachAthleteId: string;
  athleteName: string;
}) {
  return (
    <ConfirmButton
      action={async () => {
        const result = await removeAthleteFromRoster(coachAthleteId);
        // Clears InviteAthleteForm's own stale "send this link" card, if
        // one happens to be showing -- see roster-events.ts.
        if (!result.error) notifyRosterChanged();
        return result;
      }}
      confirmMessage={`End your coaching relationship with ${athleteName}? They keep their own training history either way, and you can re-invite them later.`}
      label="Remove"
      pendingLabel="Removing…"
      className="shrink-0 text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
    />
  );
}
