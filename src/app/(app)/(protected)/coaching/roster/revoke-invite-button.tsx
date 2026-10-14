"use client";

import { revokeAthleteInvite } from "./actions";
import { notifyRosterChanged } from "./roster-events";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function RevokeInviteButton({ inviteId, athleteEmail }: { inviteId: string; athleteEmail: string }) {
  return (
    <ConfirmButton
      action={async () => {
        const result = await revokeAthleteInvite(inviteId);
        // Clears InviteAthleteForm's own stale "send this link" card, if
        // one happens to be showing -- see roster-events.ts.
        if (!result.error) notifyRosterChanged();
        return result;
      }}
      confirmMessage={`Revoke the pending invite to ${athleteEmail}?`}
      label="Revoke"
      pendingLabel="Revoking…"
      className="shrink-0 text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
    />
  );
}
