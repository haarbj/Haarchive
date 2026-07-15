"use client";

import { useActionState } from "react";

import type { FoundationsSuggestionTarget } from "@/lib/content-suggestions/foundations-targets";
import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { submitContentSuggestion, type SuggestionFormState } from "./actions";
import { Button } from "@/components/ui/button";

const fieldClass = `w-full ${baseFieldClass}`;

export function SuggestionForm({ targets }: { targets: FoundationsSuggestionTarget[] }) {
  const [state, formAction, isPending] = useActionState<SuggestionFormState, FormData>(submitContentSuggestion, {});

  const byCategory = new Map<string, FoundationsSuggestionTarget[]>();
  for (const target of targets) {
    if (!byCategory.has(target.categoryTitle)) byCategory.set(target.categoryTitle, []);
    byCategory.get(target.categoryTitle)!.push(target);
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="suggestion-section" className={labelClass}>
          Page
        </label>
        <select id="suggestion-section" name="sectionSlug" defaultValue="" className={fieldClass}>
          <option value="" disabled>
            Choose a page…
          </option>
          {Array.from(byCategory.entries()).map(([categoryTitle, items]) => (
            <optgroup key={categoryTitle} label={categoryTitle}>
              {items.map((target) => (
                <option key={target.slug} value={target.slug}>
                  {target.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="suggestion-text" className={labelClass}>
          Suggestion
        </label>
        <textarea
          id="suggestion-text"
          name="suggestion"
          rows={3}
          placeholder="Add a section explaining performance fueling vs. general health eating."
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="suggestion-reason" className={labelClass}>
          Reason (optional)
        </label>
        <textarea
          id="suggestion-reason"
          name="reason"
          rows={2}
          placeholder="Current wording may unintentionally oversimplify processed foods."
          className={fieldClass}
        />
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
        {isPending ? "Submitting…" : "Submit suggestion"}
      </Button>
    </form>
  );
}
