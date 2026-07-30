"use client";

import { revokeCoachInvite } from "./actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  return (
    <ConfirmButton
      action={() => revokeCoachInvite(inviteId)}
      confirmMessage="Revoke this invite? The link will stop working immediately."
      label="Revoke"
      pendingLabel="Revoking…"
      className="text-xs font-semibold text-red-700 underline decoration-red-700/30 underline-offset-2 hover:decoration-red-700 disabled:opacity-50 dark:text-red-400 dark:decoration-red-400/30 dark:hover:decoration-red-400"
    />
  );
}
