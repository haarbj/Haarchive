"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { submitKnowledgeCheckAnswer, type SafeKnowledgeCheck } from "@/app/knowledge-check-actions";
import type { MasteryLevel } from "@/lib/mastery/algorithm";
import { FormError } from "@/components/ui/form-error";

const LEVEL_LABELS: Record<MasteryLevel, string> = {
  exploring: "Exploring",
  familiar: "Familiar",
  proficient: "Proficient",
  advanced: "Advanced",
  mastered: "Mastered",
};

type AnswerResult = {
  correct: boolean;
  explanation: string;
  correctOptionId: string;
  newLevel: MasteryLevel;
};

type KnowledgeCheckProps = {
  question: SafeKnowledgeCheck;
  topicTitle: string;
};

// Same border-l-4 + tinted-background visual language as ContentCallout
// (border-accent-research/50 bg-accent-research/5, "research" variant --
// this is fundamentally about testing understanding of the page's own
// content) -- but a real interactive component, not a display-only one, so
// it isn't built as a new ContentCallout variant.
export function KnowledgeCheck({ question, topicTitle }: KnowledgeCheckProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const resultHeadingRef = useRef<HTMLParagraphElement>(null);

  // Moves focus to the result the moment it appears -- the question/options
  // form is removed from the DOM when this replaces it, so without this,
  // focus would silently fall back to <body> instead of landing somewhere
  // that makes sense to a screen reader or keyboard user.
  useEffect(() => {
    if (result) resultHeadingRef.current?.focus();
  }, [result]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedOptionId) return;
    setError(null);
    startTransition(async () => {
      const response = await submitKnowledgeCheckAnswer(question.id, selectedOptionId);
      if ("error" in response) {
        setError(response.error);
        return;
      }
      setResult(response);
    });
  }

  function handleRetry() {
    // Same question, a fresh attempt -- selecting a new answer and
    // resubmitting is what increments attemptNumber server-side. Retrying
    // never erases the first attempt's record, and (per algorithm.ts) a
    // question already answered correctly once contributes no further
    // score no matter how many more times it's answered.
    setResult(null);
    setSelectedOptionId(null);
    setError(null);
  }

  return (
    <div
      data-testid="knowledge-check"
      className="rounded-xl border-l-4 border-accent-research/50 bg-accent-research/5 px-5 py-5 sm:px-6 sm:py-6"
    >
      <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        Check your understanding
      </p>

      {!result ? (
        <form onSubmit={handleSubmit} className="mt-3">
          <fieldset>
            <legend className="text-base leading-7 font-medium text-zinc-900 dark:text-white">
              {question.question}
            </legend>
            <div className="mt-4 space-y-2">
              {question.options.map((option) => (
                <label
                  key={option.id}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm leading-6 transition ${
                    selectedOptionId === option.id
                      ? "border-zinc-900 bg-white dark:border-white dark:bg-zinc-900"
                      : "border-black/10 bg-white/60 hover:bg-white dark:border-white/10 dark:bg-zinc-900/40 dark:hover:bg-zinc-900"
                  }`}
                >
                  <input
                    type="radio"
                    name={`knowledge-check-${question.id}`}
                    value={option.id}
                    checked={selectedOptionId === option.id}
                    onChange={() => setSelectedOptionId(option.id)}
                    className="h-4 w-4 shrink-0 border-black/20 text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900 dark:border-white/20 dark:text-white dark:focus-visible:ring-white"
                  />
                  <span className="text-zinc-800 dark:text-zinc-100">{option.text}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {error && (
            <div className="mt-4">
              <FormError>{error}</FormError>
            </div>
          )}

          <button
            type="submit"
            disabled={!selectedOptionId || isPending}
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-pill bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition outline-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:bg-white dark:text-zinc-900 dark:focus-visible:ring-white dark:focus-visible:ring-offset-zinc-950"
          >
            {isPending ? "Checking…" : "Submit answer"}
          </button>
        </form>
      ) : (
        // aria-live: a screen reader gets the result announced automatically
        // the moment it replaces the form, without depending on focus
        // timing alone.
        <div className="mt-3" aria-live="polite">
          <p
            ref={resultHeadingRef}
            tabIndex={-1}
            className="rounded text-base font-semibold text-zinc-900 focus:ring-2 focus:ring-zinc-900 focus:outline-none dark:text-white dark:focus:ring-white"
          >
            {/* Never color-only: an explicit glyph and word carry the
                correctness, the tinted background underneath is secondary. */}
            {result.correct ? "✓ Correct" : "○ Not quite"}
          </p>

          <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{result.explanation}</p>

          {!result.correct && (
            <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              The correct answer:{" "}
              <span className="font-semibold text-zinc-900 dark:text-white">
                {question.options.find((o) => o.id === result.correctOptionId)?.text}
              </span>
            </p>
          )}

          {result.newLevel !== question.currentLevel && (
            <p className="mt-4 text-sm font-semibold text-zinc-900 dark:text-white">
              {topicTitle} — {LEVEL_LABELS[result.newLevel]}
            </p>
          )}

          {!result.correct && (
            <div className="mt-4">
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex min-h-11 items-center justify-center rounded-pill border border-zinc-900/15 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none dark:border-white/20 dark:text-zinc-200 dark:hover:bg-white/10 dark:focus-visible:ring-white dark:focus-visible:ring-offset-zinc-950"
              >
                Try again
              </button>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                A correct answer after a retry still counts toward this topic, just less than getting it on the
                first try.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
