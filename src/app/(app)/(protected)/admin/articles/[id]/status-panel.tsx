"use client";

import { useActionState } from "react";

import {
  transitionArticleStatus,
  deleteArticleDraft,
  type ArticleAdminState,
} from "@/app/(app)/(protected)/admin/articles/actions";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { FormError } from "@/components/ui/form-error";

const TRANSITION_LABELS: Record<string, string> = {
  in_review: "Send back to review",
  approved: "Approve",
  published: "Publish",
  draft: "Send back to draft",
};

export function StatusPanel({
  articleId,
  allowedNext,
  canDelete,
}: {
  articleId: string;
  allowedNext: string[];
  canDelete: boolean;
}) {
  const [state, formAction, isPending] = useActionState<ArticleAdminState, FormData>(transitionArticleStatus, {});

  return (
    <div>
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="articleId" value={articleId} />
        {allowedNext.map((next) => (
          <Button
            key={next}
            type="submit"
            name="nextStatus"
            value={next}
            variant={next === "published" ? "solid" : "outline"}
            size="sm"
            disabled={isPending}
          >
            {TRANSITION_LABELS[next] ?? next}
          </Button>
        ))}
      </form>

      {state.error ? <FormError className="mt-2">{state.error}</FormError> : null}
      {state.success ? (
        <p role="status" className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Updated.
        </p>
      ) : null}

      {canDelete ? (
        <ConfirmButton
          action={() => deleteArticleDraft(articleId)}
          confirmMessage="Delete this draft? This can't be undone."
          label="Delete draft"
          pendingLabel="Deleting…"
          className="mt-4 text-xs font-semibold text-red-700 dark:text-red-400"
        />
      ) : null}
    </div>
  );
}
