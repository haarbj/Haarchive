"use client";

import { useState } from "react";

import { savePostSeasonReviewAnswers, submitPostSeasonReview, type PostSeasonReviewFormAnswer } from "./actions";
import { useAutoSaveForm } from "@/lib/use-auto-save-form";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";
import { Button } from "@/components/ui/button";

// Grouped back into sections for display, since the questionnaire reads
// as two conversations (training, then the race itself) -- the DB/form
// wiring is flat (one row, one field per question) but the reader
// shouldn't see that.
function groupBySection(answers: PostSeasonReviewFormAnswer[]) {
  const sections: { heading: string; items: { globalIndex: number; answer: PostSeasonReviewFormAnswer }[] }[] = [];
  answers.forEach((answer, globalIndex) => {
    let section = sections.find((s) => s.heading === answer.sectionHeading);
    if (!section) {
      section = { heading: answer.sectionHeading, items: [] };
      sections.push(section);
    }
    section.items.push({ globalIndex, answer });
  });
  return sections;
}

export function PostSeasonReviewForm({
  requestId,
  initialAnswers,
  submitted,
}: {
  requestId: string;
  initialAnswers: PostSeasonReviewFormAnswer[];
  submitted: boolean;
}) {
  const { state, formRef, isPending, scheduleSave } = useAutoSaveForm(
    savePostSeasonReviewAnswers.bind(null, requestId),
    {},
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(submitted);
  const sections = groupBySection(initialAnswers);

  if (isSubmitted) {
    return (
      <p className="rounded-control border border-black/10 bg-black/5 p-4 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
        Submitted. Your coach can see your answers now, and you can go through them together when you plan what&rsquo;s next.
      </p>
    );
  }

  return (
    <form ref={formRef} className="space-y-8" onSubmit={(e) => e.preventDefault()}>
      {sections.map((section) => (
        <div key={section.heading}>
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-white">{section.heading}</h2>
          <div className="mt-3 space-y-4">
            {section.items.map(({ globalIndex, answer }) => (
              <div key={globalIndex}>
                <label htmlFor={`answer-${globalIndex}`} className={labelClass}>
                  {answer.question}
                </label>
                <textarea
                  id={`answer-${globalIndex}`}
                  name={`answer-${globalIndex}`}
                  defaultValue={answer.answer}
                  rows={2}
                  onBlur={scheduleSave}
                  className={fieldClass}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <AutoSaveStatus isPending={isPending} error={state.error} success={state.success} />

      <div>
        <Button
          type="button"
          disabled={submitting}
          onClick={async () => {
            setSubmitting(true);
            setSubmitError(null);
            const result = await submitPostSeasonReview(requestId);
            setSubmitting(false);
            if (result.error) return setSubmitError(result.error);
            setIsSubmitted(true);
          }}
        >
          {submitting ? "Submitting…" : "Submit to your coach"}
        </Button>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Your answers save as you go, even before you submit. There are no wrong answers -- write as much or as little as you want.
        </p>
        {submitError ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{submitError}</p> : null}
      </div>
    </form>
  );
}
