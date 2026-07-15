"use client";

import { useActionState } from "react";

import { updateDraftAnswer, type DraftAnswerState } from "@/app/(app)/(protected)/contribute/questions/actions";
import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";

const fieldClass = `w-full ${baseFieldClass}`;

export function DraftAnswerForm({
  questionId,
  initialDraftAnswer,
}: {
  questionId: string;
  initialDraftAnswer: string;
}) {
  const [state, formAction, isPending] = useActionState<DraftAnswerState, FormData>(updateDraftAnswer, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="questionId" value={questionId} />
      <label htmlFor="draftAnswer" className={labelClass}>
        Your draft answer
      </label>
      <textarea
        id="draftAnswer"
        name="draftAnswer"
        rows={6}
        defaultValue={initialDraftAnswer}
        className={fieldClass}
      />
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Saved.
        </p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save draft"}
      </Button>
    </form>
  );
}
