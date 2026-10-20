"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  loadPostRaceFlow,
  loadPostSeasonReviewAnswers,
  sendPostSeasonReview,
  type PostRaceView,
  type PostSeasonReviewAnswerView,
} from "./post-race-actions";
import { formatDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Part H, coach-only. Appears once a goal race has passed and goes quiet
// after eight weeks. Every step's done state is derived from real data, so
// a coach who assigned the recovery block before opening this sees it
// already ticked.

export function PostRacePanel({ athleteId }: { athleteId: string }) {
  const router = useRouter();
  const [view, setView] = useState<PostRaceView | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<PostSeasonReviewAnswerView[] | null>(null);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answersError, setAnswersError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPostRaceFlow({ athleteId }).then((result) => {
      if (!cancelled) setView(result);
    });
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  const flow = view?.flow;
  if (!view || view.error || !flow?.active) return null;

  return (
    <Card padding="md">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">After the race</p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        {view.raceName ?? "Their goal race"}
        {view.raceDate ? ` on ${formatDate(view.raceDate)}` : ""}
        {flow.daysSinceRace != null ? `, ${flow.daysSinceRace} day${flow.daysSinceRace === 1 ? "" : "s"} ago.` : "."}
      </p>

      {flow.notes.map((note) => (
        <p key={note} className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {note}
        </p>
      ))}

      <ol className="mt-3 space-y-3">
        {flow.steps.map((step, index) => (
          <li key={step.key} className="rounded-control border border-black/10 p-3 dark:border-white/10">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
              {index + 1}. {step.title}
              {step.done ? <span className="ml-2 text-xs font-normal text-accent-success">done</span> : null}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{step.detail}</p>

            {!step.done && step.key === "recovery-program" ? (
              view.recoveryProgramId ? (
                <Link
                  href={`/coaching/athletes/${athleteId}/schedule?view=phase&assignProgram=${view.recoveryProgramId}`}
                  className="mt-2 inline-block text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
                >
                  Assign it
                </Link>
              ) : (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  You don&rsquo;t have a recovery template yet. Ask your workspace admin to set one up.
                </p>
              )
            ) : null}

            {!step.done && step.key === "post-season-review" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={sending}
                onClick={async () => {
                  setSending(true);
                  setError(null);
                  const result = await sendPostSeasonReview({ athleteId });
                  setSending(false);
                  if (result.error) return setError(result.error);
                  // Re-fetch rather than patch the step's done flag locally
                  // -- the new request's id (reviewRequestId) is what lets
                  // "View answers" appear below, and it only comes from the
                  // real load.
                  loadPostRaceFlow({ athleteId }).then(setView);
                  router.refresh();
                }}
              >
                {sending ? "Sending…" : "Send it in the message thread"}
              </Button>
            ) : null}

            {step.done && step.key === "post-season-review" && view.reviewRequestId ? (
              <div className="mt-2">
                {answers === null ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={answersLoading}
                    onClick={async () => {
                      setAnswersLoading(true);
                      setAnswersError(null);
                      const result = await loadPostSeasonReviewAnswers({
                        athleteId,
                        requestId: view.reviewRequestId!,
                      });
                      setAnswersLoading(false);
                      if (result.error) return setAnswersError(result.error);
                      setAnswers(result.answers ?? []);
                    }}
                  >
                    {answersLoading
                      ? "Loading…"
                      : view.reviewSubmitted
                        ? "View answers"
                        : "View answers (not submitted yet)"}
                  </Button>
                ) : (
                  <div className="space-y-3 rounded-control border border-black/10 p-3 dark:border-white/10">
                    {!view.reviewSubmitted ? (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Not submitted yet -- showing whatever they&rsquo;ve saved so far.
                      </p>
                    ) : null}
                    {answers.length === 0 ? (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">No answers yet.</p>
                    ) : (
                      answers.map((a) => (
                        <div key={`${a.sectionHeading}-${a.questionIndex}`}>
                          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{a.question}</p>
                          <p className="mt-0.5 text-sm text-zinc-800 dark:text-zinc-200">
                            {a.answer.trim() ? a.answer : <span className="italic text-zinc-400">No answer yet</span>}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
                {answersError ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{answersError}</p> : null}
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        The review also posts to your message thread, but their structured answers above are the real record -- that&rsquo;s
        what to go through together when you plan what&rsquo;s next.
      </p>
    </Card>
  );
}
