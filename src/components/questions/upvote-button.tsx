"use client";

import { useState, useTransition } from "react";

import { toggleUpvote } from "@/app/questions/actions";

type UpvoteButtonProps = {
  questionId: string;
  initialCount: number;
  initialUpvoted: boolean;
};

export function UpvoteButton({ questionId, initialCount, initialUpvoted }: UpvoteButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [upvoted, setUpvoted] = useState(initialUpvoted);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    // Optimistic flip, reconciled with the server's real count once the
    // action resolves -- a double-click race just settles on the server's
    // answer, it doesn't double-count.
    const wasUpvoted = upvoted;
    setUpvoted(!wasUpvoted);
    setCount((c) => c + (wasUpvoted ? -1 : 1));

    startTransition(async () => {
      const result = await toggleUpvote(questionId);
      if ("error" in result) {
        setUpvoted(wasUpvoted);
        setCount((c) => c + (wasUpvoted ? 1 : -1));
        return;
      }
      setUpvoted(result.upvoted);
      setCount(result.count);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={upvoted}
      className={`flex flex-col items-center gap-0.5 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
        upvoted
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
          : "border-black/10 bg-white text-zinc-700 hover:border-black/20 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-white/20"
      }`}
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
        <path
          d="M10 4L16 13H4L10 4Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      {count}
    </button>
  );
}
