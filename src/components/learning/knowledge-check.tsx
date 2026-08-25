"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, X } from "lucide-react";

import { getKnowledgeCheckForTopic, submitKnowledgeCheckAnswer, type SafeKnowledgeCheck } from "@/app/knowledge-check-actions";
import { recordConversionEvent } from "@/app/conversion-actions";
import type { MasteryLevel } from "@/lib/mastery/algorithm";
import { FormError } from "@/components/ui/form-error";

// The exact literal error submitKnowledgeCheckAnswer returns for an
// unauthenticated submission (knowledge-check-actions.ts) -- matched here,
// not passed as a structured error code, because that function's return
// shape is asserted exactly (toEqual, not toMatchObject) by its own Phase
// 8 regression tests; adding a field there to avoid this string match
// would break tests protecting far more important behavior (grading,
// answer-key handling) for a purely cosmetic gain here.
const SIGN_IN_REQUIRED_ERROR = "Sign in to answer knowledge checks.";

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
  // Server-fetched initial question for this page load -- kept in local
  // state below (not read directly) so a correct answer on a
  // multi-question topic can advance in place instead of requiring a full
  // page reload to see the next one.
  question: SafeKnowledgeCheck;
  topicTitle: string;
  // Needed to re-fetch getKnowledgeCheckForTopic client-side after a
  // correct answer -- that function already picks the visitor's next
  // unanswered question (or reports allQuestionsCompleted), so this reuses
  // the same server logic rather than re-deriving "what's next" here.
  topicSlug: string;
};

// Same border-l-4 + tinted-background visual language as ContentCallout
// (border-accent-research/50 bg-accent-research/5, "research" variant --
// this is fundamentally about testing understanding of the page's own
// content) -- but a real interactive component, not a display-only one, so
// it isn't built as a new ContentCallout variant.
export function KnowledgeCheck({ question: initialQuestion, topicTitle, topicSlug }: KnowledgeCheckProps) {
  const [question, setQuestion] = useState(initialQuestion);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Prefetched immediately after a correct answer (see handleSubmit) so
  // "Next question" is instant to click rather than triggering its own
  // separate loading state -- null while that lookup is still in flight
  // (isPending covers that gap, see the render below) or once it's
  // resolved that there genuinely is nothing left to answer.
  const [nextQuestion, setNextQuestion] = useState<SafeKnowledgeCheck | null>(null);
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
        if (response.error === SIGN_IN_REQUIRED_ERROR) {
          // No separate "click" exists for this boundary today (the
          // question/options render unconditionally for every visitor --
          // see this component's own top-level comment -- so there's no
          // embedded sign-in link to instrument a second, later click on,
          // unlike bookmark/notes). The anonymous Submit press itself is
          // both the shown and the clicked signal here: fire-and-forget,
          // never awaited.
          recordConversionEvent("cta_shown", "knowledge_check", { surface: "knowledge_check_submit" });
          recordConversionEvent("cta_clicked", "knowledge_check", { surface: "knowledge_check_submit" });
        }
        return;
      }
      setResult(response);
      // Phase 12A: answering (correctly or not) is the deliberate,
      // authenticated learning action here -- idempotent server-side,
      // fire-and-forget.
      recordConversionEvent("first_learning_action", "learning_progress", { surface: "knowledge_check_submit" });

      // A correct answer on a multi-question topic: look up what's next
      // *inside this same transition*, not a follow-up click, so isPending
      // stays true for the whole "grading, then figuring out what's next"
      // sequence -- otherwise the result view would render for a moment
      // not yet knowing whether to offer "Next question" or report the set
      // complete, and could flash the wrong one. Single-question topics
      // skip this entirely -- same, unchanged behavior as before this fix.
      if (response.correct && question.totalQuestions > 1) {
        const next = await getKnowledgeCheckForTopic(topicSlug);
        setNextQuestion(next && !next.allQuestionsCompleted ? next : null);
      } else {
        setNextQuestion(null);
      }
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

  function handleNext() {
    if (!nextQuestion) return;
    setQuestion(nextQuestion);
    setNextQuestion(null);
    setResult(null);
    setSelectedOptionId(null);
    setError(null);
  }

  return (
    <div
      data-testid="knowledge-check"
      className="rounded-xl border-l-4 border-accent-research/50 bg-accent-research/5 px-5 py-5 sm:px-6 sm:py-6"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Check your understanding
        </p>
        {/* Only meaningful when there's more than one question to know
            about -- a lone "1/1" doesn't tell the reader anything a bare
            label doesn't already. */}
        {question.totalQuestions > 1 && (
          <p className="shrink-0 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            {question.questionNumber}/{question.totalQuestions}
          </p>
        )}
      </div>

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
            className="flex items-center gap-1.5 rounded text-base font-semibold text-zinc-900 focus:ring-2 focus:ring-zinc-900 focus:outline-none dark:text-white dark:focus:ring-white"
          >
            {/* Never color-only: an explicit glyph and word carry the
                correctness, the tinted background underneath is secondary. */}
            {result.correct ? (
              <Check className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            ) : (
              <X className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            )}
            {result.correct ? "Correct" : "Not quite"}
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

          {result.correct && question.totalQuestions > 1 && (
            <div className="mt-4">
              {isPending ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Loading next question…</p>
              ) : nextQuestion ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-pill bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition outline-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:bg-white dark:text-zinc-900 dark:focus-visible:ring-white dark:focus-visible:ring-offset-zinc-950"
                >
                  Next question →
                </button>
              ) : (
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                  You&rsquo;ve completed all {question.totalQuestions} questions for this topic.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
