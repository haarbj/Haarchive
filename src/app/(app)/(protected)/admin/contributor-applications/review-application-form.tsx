"use client";

import { useActionState } from "react";

import { reviewContributorApplication, type ReviewApplicationState } from "./actions";
import { fieldClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";

export function ReviewApplicationForm({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState<ReviewApplicationState, FormData>(
    reviewContributorApplication,
    {},
  );

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="adminNotes" placeholder="Admin notes (optional)" className={fieldClass} />
      <Button type="submit" name="status" value="approved" size="sm" disabled={isPending}>
        Approve
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
