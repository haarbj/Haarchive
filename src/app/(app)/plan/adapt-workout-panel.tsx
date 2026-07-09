"use client";

import { useState, type FormEvent } from "react";

import { applyAdaptation, undoAdaptation } from "@/app/(app)/plan/actions";
import { fieldClass } from "@/app/(app)/dashboard/form-constants";
import { describePrescription, type WorkoutPrescription } from "@/lib/coaching-engine";
import { formatRelativeTime } from "@/lib/format";
import type { ProposedChange } from "@/app/api/coach/adapt-workout/route";

type AdaptWorkoutPanelProps = {
  workoutId: string;
  currentPrescription: WorkoutPrescription;
  adaptedAt: string | null;
  adaptationReason: string | null;
  adaptationExplanation: string | null;
};

type Status = "idle" | "open" | "loading" | "reviewing" | "applying";

// Ready-to-send examples, shown as chips so an athlete who's never used
// this before can see what kinds of things the coach can actually respond
// to, rather than staring at a blank input guessing.
const SUGGESTIONS = [
  "I'm traveling.",
  "I only have 30 minutes.",
  "It's much hotter today.",
  "My legs are sore.",
  "I'm feeling sick.",
];

export function AdaptWorkoutPanel({
  workoutId,
  currentPrescription,
  adaptedAt,
  adaptationReason,
  adaptationExplanation,
}: AdaptWorkoutPanelProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [proposedChange, setProposedChange] = useState<ProposedChange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);

  async function submitMessage(text: string) {
    if (!text.trim()) return;
    setMessage(text);
    setStatus("loading");
    setError(null);
    setExplanation(null);
    setProposedChange(null);

    try {
      const response = await fetch("/api/coach/adapt-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutId, message: text }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Couldn't reach your coach right now -- try again in a moment.");
      }
      setExplanation(data.explanation);
      setProposedChange(data.proposedChange);
      setStatus("reviewing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("open");
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void submitMessage(message);
  }

  async function handleApply() {
    if (!proposedChange || !explanation) return;
    setStatus("applying");
    const result = await applyAdaptation(workoutId, proposedChange.before, proposedChange.after, message, explanation);
    if (result.error) {
      setError(result.error);
      setStatus("reviewing");
      return;
    }
    // The page revalidates and re-renders this component with adaptedAt
    // set, which switches to the "adjusted" view below -- no local reset
    // needed beyond clearing the in-progress request state.
    setStatus("idle");
    setMessage("");
    setExplanation(null);
    setProposedChange(null);
  }

  function handleNeverMind() {
    setStatus("idle");
    setMessage("");
    setExplanation(null);
    setProposedChange(null);
    setError(null);
  }

  async function handleUndo() {
    setUndoing(true);
    const result = await undoAdaptation(workoutId);
    if (result.error) {
      setError(result.error);
    }
    setUndoing(false);
  }

  if (adaptedAt) {
    return (
      <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
        <p className="text-xs font-semibold tracking-wide text-amber-900/70 uppercase dark:text-amber-200/70">
          AI Coach
        </p>
        {adaptationReason && (
          <p className="mt-2">
            <span className="font-semibold text-amber-900 dark:text-amber-200">You </span>
            <span className="text-amber-800 dark:text-amber-300">&ldquo;{adaptationReason}&rdquo;</span>
          </p>
        )}
        <p className="mt-1.5">
          <span className="font-semibold text-amber-900 dark:text-amber-200">Coach </span>
          <span className="text-amber-800 dark:text-amber-300">Adjusted today&rsquo;s workout</span>
        </p>
        {adaptationExplanation && (
          <p className="mt-1.5">
            <span className="font-semibold text-amber-900 dark:text-amber-200">Reason </span>
            <span className="text-amber-800 dark:text-amber-300">{adaptationExplanation}</span>
          </p>
        )}
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{formatRelativeTime(adaptedAt)}</p>
        <button
          type="button"
          onClick={handleUndo}
          disabled={undoing}
          className="mt-1.5 text-sm font-semibold text-amber-900 underline decoration-amber-900/30 underline-offset-2 hover:decoration-amber-900 disabled:opacity-60 dark:text-amber-200 dark:decoration-amber-200/30 dark:hover:decoration-amber-200"
        >
          {undoing ? "Undoing…" : "Undo"}
        </button>
        {error && (
          <p role="alert" className="mt-1.5 text-sm font-medium text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (status === "idle") {
    return (
      <button
        type="button"
        onClick={() => setStatus("open")}
        className="mt-3 text-sm font-semibold text-zinc-700 underline decoration-black/20 underline-offset-2 transition hover:decoration-black dark:text-zinc-200 dark:decoration-white/20 dark:hover:decoration-white"
      >
        Need to adjust this workout?
      </button>
    );
  }

  return (
    <div className="mt-3">
      {(status === "open" || status === "loading") && (
        <>
          <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell your coach what's changed…"
              className={`${fieldClass} min-w-0 flex-1`}
              autoFocus
            />
            <button
              type="submit"
              disabled={status === "loading" || !message.trim()}
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {status === "loading" ? "Thinking…" : "Send"}
            </button>
          </form>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={status === "loading"}
                onClick={() => void submitMessage(suggestion)}
                className="rounded-full border border-black/10 px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      {(status === "reviewing" || status === "applying") && explanation && (
        <div className="mt-2 rounded-lg bg-black/[0.03] p-3 dark:bg-white/[0.05]">
          <p className="text-sm text-zinc-700 dark:text-zinc-200">{explanation}</p>

          {proposedChange && (
            <div className="mt-2 space-y-1 text-sm">
              <p className="text-zinc-500 line-through dark:text-zinc-400">
                {describePrescription(currentPrescription)}
              </p>
              <p className="font-medium text-zinc-900 dark:text-white">
                {describePrescription(proposedChange.after)}
              </p>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={status === "applying"}
                  className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {status === "applying" ? "Applying…" : "Apply this change"}
                </button>
                <button
                  type="button"
                  onClick={handleNeverMind}
                  disabled={status === "applying"}
                  className="text-sm font-semibold text-zinc-600 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-60 dark:text-zinc-300 dark:decoration-white/20 dark:hover:decoration-white"
                >
                  Never mind
                </button>
              </div>
            </div>
          )}

          {!proposedChange && (
            <button
              type="button"
              onClick={handleNeverMind}
              className="mt-2 text-sm font-semibold text-zinc-600 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-300 dark:decoration-white/20 dark:hover:decoration-white"
            >
              Ask something else
            </button>
          )}
        </div>
      )}
    </div>
  );
}
