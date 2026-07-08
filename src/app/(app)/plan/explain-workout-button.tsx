"use client";

import { useState } from "react";

import { logExplanation } from "@/app/(app)/plan/actions";

type ExplainWorkoutButtonProps = {
  workoutId: string;
};

type Status = "idle" | "loading" | "streaming" | "error";

export function ExplainWorkoutButton({ workoutId }: ExplainWorkoutButtonProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (status === "loading" || status === "streaming") return;
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

      {explanation && (
        <p className="mt-2 max-w-prose text-sm text-zinc-600 dark:text-zinc-300">{explanation}</p>
      )}
    </div>
  );
}
