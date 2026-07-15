"use client";

import { useActionState } from "react";

import { reviewContentSuggestion, type AdminReviewState } from "./actions";
import { fieldClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";

export function ReviewSuggestionForm({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState<AdminReviewState, FormData>(reviewContentSuggestion, {});

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="adminNotes" placeholder="Admin notes (optional)" className={fieldClass} />
      <Button type="submit" name="status" value="accepted" size="sm" disabled={isPending}>
        Accept
      </Button>
      <Button type="submit" name="status" value="rejected" variant="outline" size="sm" disabled={isPending}>
        Reject
      </Button>
      {state.error ? (
        <span role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
