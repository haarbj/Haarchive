"use client";

import { deleteBugReport } from "./actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function DeleteBugReportButton({ id }: { id: string }) {
  return (
    <ConfirmButton
      action={() => deleteBugReport(id)}
      confirmMessage="Delete this bug report? This also deletes its screenshot and can't be undone."
      label="Delete"
      pendingLabel="Deleting…"
      className="text-sm font-semibold text-red-700 underline decoration-red-700/30 underline-offset-2 hover:decoration-red-700 disabled:opacity-50 dark:text-red-400 dark:decoration-red-400/30 dark:hover:decoration-red-400"
    />
  );
}
