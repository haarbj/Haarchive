"use client";

import { useActionState } from "react";

import { reviewCitation, type AdminReviewState } from "./actions";
import { fieldClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

export function ReviewCitationForm({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState<AdminReviewState, FormData>(reviewCitation, {});

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="adminNotes" aria-label="Admin notes" placeholder="Admin notes (optional)" className={fieldClass} />
      <Button type="submit" name="status" value="accepted" size="sm" disabled={isPending}>
        Accept
      </Button>
      <Button type="submit" name="status" value="rejected" variant="outline" size="sm" disabled={isPending}>
        Reject
      </Button>
      {state.error ? <FormError as="span">{state.error}</FormError> : null}
    </form>
  );
}
