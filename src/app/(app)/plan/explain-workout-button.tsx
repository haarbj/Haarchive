"use client";

import { useState } from "react";

import { logExplanation } from "@/app/(app)/plan/actions";
import {
  phaseSummary,
  workoutKindCoaching,
  type DistanceBucket,
  type MesocyclePhase,
  type WorkoutPrescription,
} from "@/lib/coaching-engine";

type ExplainWorkoutButtonProps = {
  workoutId: string;
  phase: MesocyclePhase | null;
  workoutKind: WorkoutPrescription["kind"] | null;
  distanceBucket: DistanceBucket;
};

type Status = "idle" | "loading" | "streaming" | "error";

export function ExplainWorkoutButton({ workoutId, phase, workoutKind, distanceBucket }: ExplainWorkoutButtonProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [opened, setOpened] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (status === "loading" || status === "streaming") return;
    setOpened(true);
    setStatus("loading");
    setExplanation("");
    setError(null);

    try {
      const response = await fetch("/api/coach/explain-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutId }),
      });
      if (!response.ok || !response.body) {
        throw new Error("Couldn't get an explanation right now -- try again in a moment.");
      }

      setStatus("streaming");
      const conversationId = response.headers.get("X-Conversation-Id");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setExplanation(accumulated);
      }
      setStatus("idle");

      if (conversationId && accumulated) {
        void logExplanation(conversationId, accumulated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  const coaching = workoutKind ? workoutKindCoaching(workoutKind, distanceBucket) : null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading" || status === "streaming"}
        className="text-sm font-semibold text-zinc-700 underline decoration-black/20 underline-offset-2 transition hover:decoration-black disabled:opacity-60 dark:text-zinc-200 dark:decoration-white/20 dark:hover:decoration-white"
      >
        {status === "loading" ? "Thinking…" : "Why this workout?"}
      </button>

      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      {opened && (coaching || explanation) && (
        <div className="mt-2 max-w-prose space-y-2 text-sm">
          {phase && (
            <p className="text-zinc-600 dark:text-zinc-300">
              <span className="font-semibold text-zinc-900 dark:text-white">Training phase </span>
              <span className="capitalize">{phase}</span> — {phaseSummary(phase, distanceBucket)}
            </p>
          )}
          {coaching && (
            <>
              <p className="text-zinc-600 dark:text-zinc-300">
                <span className="font-semibold text-zinc-900 dark:text-white">Today&rsquo;s objective </span>
                {coaching.objective}
              </p>
              <div className="text-zinc-600 dark:text-zinc-300">
                <span className="font-semibold text-zinc-900 dark:text-white">Primary adaptations</span>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {coaching.adaptations.map((adaptation) => (
                    <li key={adaptation}>{adaptation}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
          {explanation && (
            <p className="text-zinc-600 dark:text-zinc-300">
              <span className="font-semibold text-zinc-900 dark:text-white">Coach&rsquo;s note </span>
              {explanation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
