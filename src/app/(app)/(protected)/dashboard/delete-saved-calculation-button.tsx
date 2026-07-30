"use client";

import { deleteSavedCalculation } from "@/components/pace-calculator-actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function DeleteSavedCalculationButton({ id }: { id: string }) {
  return (
    <ConfirmButton
      action={() => deleteSavedCalculation(id)}
      confirmMessage="Delete this saved calculation? This can't be undone."
      label="Remove"
      pendingLabel="Removing…"
      className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
    />
  );
}
