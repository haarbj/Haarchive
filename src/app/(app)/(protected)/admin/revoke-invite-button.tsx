"use client";

import { useTransition } from "react";

import { revokeCoachInvite } from "./actions";

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => revokeCoachInvite(inviteId))}
      className="text-xs font-semibold text-red-700 underline decoration-red-700/30 underline-offset-2 hover:decoration-red-700 disabled:opacity-50 dark:text-red-400 dark:decoration-red-400/30 dark:hover:decoration-red-400"
    >
      {isPending ? "Revoking…" : "Revoke"}
    </button>
  );
}
