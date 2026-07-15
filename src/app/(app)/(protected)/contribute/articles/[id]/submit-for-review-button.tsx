"use client";

import { useActionState } from "react";

import { submitForReview } from "@/app/(app)/(protected)/contribute/articles/actions";
import { Button } from "@/components/ui/button";

export function SubmitForReviewButton({ articleId }: { articleId: string }) {
  const [state, formAction, isPending] = useActionState(submitForReview, {});

  return (
    <form action={formAction} className="mt-4">
      <input type="hidden" name="articleId" value={articleId} />
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Submitting…" : "Submit for review"}
      </Button>
      {state.error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Submitted — a reviewer or admin will take a look.
        </p>
      ) : null}
    </form>
  );
}
