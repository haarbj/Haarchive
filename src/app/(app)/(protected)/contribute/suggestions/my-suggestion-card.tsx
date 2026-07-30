"use client";

import { deleteContentSuggestion } from "./actions";
import { SUGGESTION_STATUS_LABELS, type SuggestionStatus } from "@/lib/content-suggestions/constants";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function MySuggestionCard({
  suggestion,
  sectionTitle,
}: {
  suggestion: { id: string; suggestion: string; status: SuggestionStatus };
  sectionTitle: string;
}) {
  return (
    <Card padding="sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-zinc-900 dark:text-white">{suggestion.suggestion}</p>
        {suggestion.status === "open" && (
          <ConfirmButton
            action={() => deleteContentSuggestion(suggestion.id)}
            confirmMessage="Remove this suggestion? This can't be undone."
            label="Remove"
            pendingLabel="Removing…"
            className="shrink-0 text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
          />
        )}
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {sectionTitle} · {SUGGESTION_STATUS_LABELS[suggestion.status]}
      </p>
    </Card>
  );
}
