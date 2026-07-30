"use client";

import { useActionState } from "react";

import { submitForReview } from "@/app/(app)/(protected)/contribute/articles/actions";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

export function SubmitForReviewButton({ articleId }: { articleId: string }) {
  const [state, formAction, isPending] = useActionState(submitForReview, {});

  return (
    <form action={formAction} className="mt-4">
      <input type="hidden" name="articleId" value={articleId} />
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Submitting…" : "Submit for review"}
      </Button>
      {state.error ? <FormError className="mt-2">{state.error}</FormError> : null}
      {state.success ? (
        <p role="status" className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Submitted. A reviewer or admin will take a look.
        </p>
      ) : null}
    </form>
  );
}
