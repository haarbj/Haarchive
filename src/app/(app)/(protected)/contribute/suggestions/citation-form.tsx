"use client";

import { useActionState } from "react";

import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { submitStandaloneCitation, type SuggestionFormState } from "./actions";
import { Button } from "@/components/ui/button";

const fieldClass = `w-full ${baseFieldClass}`;

export function CitationForm() {
  const [state, formAction, isPending] = useActionState<SuggestionFormState, FormData>(
    submitStandaloneCitation,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="citation-title" className={labelClass}>
            Paper title
          </label>
          <input id="citation-title" name="paperTitle" type="text" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="citation-authors" className={labelClass}>
            Authors
          </label>
          <input id="citation-authors" name="authors" type="text" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="citation-year" className={labelClass}>
            Year
          </label>
          <input id="citation-year" name="year" type="text" inputMode="numeric" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="citation-link" className={labelClass}>
            Link or DOI
          </label>
          <input id="citation-link" name="linkOrDoi" type="text" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="citation-topic" className={labelClass}>
            Topic
          </label>
          <input id="citation-topic" name="topic" type="text" placeholder="e.g. RED-S" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="citation-claim" className={labelClass}>
            Claim supported
          </label>
          <input
            id="citation-claim"
            name="claimSupported"
            type="text"
            placeholder="What does this paper support?"
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="citation-notes" className={labelClass}>
          Notes (optional)
        </label>
        <textarea id="citation-notes" name="notes" rows={2} className={fieldClass} />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Submitted — thank you.
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Submitting…" : "Submit citation"}
      </Button>
    </form>
  );
}
