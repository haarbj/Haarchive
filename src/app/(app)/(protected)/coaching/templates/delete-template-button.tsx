"use client";

import { deleteTemplate } from "./actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function DeleteTemplateButton({ templateId, templateName }: { templateId: string; templateName: string }) {
  return (
    <ConfirmButton
      action={() => deleteTemplate(templateId)}
      confirmMessage={`Delete the "${templateName}" template? Workouts already scheduled from it are unaffected.`}
      label="Delete"
      pendingLabel="Deleting…"
      className="shrink-0 text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
    />
  );
}
