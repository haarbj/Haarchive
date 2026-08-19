"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { removeBookmark } from "@/app/bookmark-actions";
import { formatRelativeTime } from "@/lib/format";
import type { MasteryLevel } from "@/lib/mastery/algorithm";
import { EmptyState } from "@/components/ui/empty-state";

export type SavedTopicCard = {
  bookmarkId: string;
  topicSlug: string;
  title: string;
  categoryTitle: string | null;
  level: MasteryLevel | null;
  lastVisited: string | null;
};

const LEVEL_LABELS: Record<MasteryLevel, string> = {
  exploring: "Exploring",
  familiar: "Familiar",
  proficient: "Proficient",
  advanced: "Advanced",
  mastered: "Mastered",
};

// "I want to come back to this" -- deliberately separate from My Notes
// (see bookmark-button.tsx's own comment on why this is a distinct
// component/action, not a variant of note-taking). No collections in
// Phase 1: a flat list is the whole feature.
export function SavedTopicsSection({ topics: initialTopics }: { topics: SavedTopicCard[] }) {
  const [topics, setTopics] = useState(initialTopics);
  const [isPending, startTransition] = useTransition();

  function handleRemove(topicSlug: string) {
    const previous = topics;
    setTopics((current) => current.filter((t) => t.topicSlug !== topicSlug)); // optimistic
    startTransition(async () => {
      const result = await removeBookmark(topicSlug);
      if ("error" in result) setTopics(previous); // rollback
    });
  }

  if (topics.length === 0) {
    return (
      <div className="mt-3">
        <EmptyState>
          Nothing saved yet. Use the Save button on any article to bookmark it for later.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {topics.map((topic) => (
        <div
          key={topic.bookmarkId}
          className="group relative rounded-card border border-black/10 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover dark:border-white/10 dark:bg-zinc-900"
        >
          <Link href={`/${topic.topicSlug}`} className="block">
            {topic.categoryTitle ? (
              <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                {topic.categoryTitle}
              </p>
            ) : null}
            <p className="mt-1 pr-6 font-semibold text-zinc-900 dark:text-white">{topic.title}</p>
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>{topic.lastVisited ? formatRelativeTime(topic.lastVisited) : "Not yet opened"}</span>
              {topic.level ? (
                <span className="font-semibold text-zinc-700 dark:text-zinc-200">{LEVEL_LABELS[topic.level]}</span>
              ) : null}
            </div>
          </Link>
          <button
            type="button"
            onClick={() => handleRemove(topic.topicSlug)}
            disabled={isPending}
            aria-label={`Remove ${topic.title} from Saved Topics`}
            className="absolute top-3 right-3 rounded-full p-1.5 text-zinc-400 transition [@media(hover:hover)]:opacity-0 hover:text-zinc-700 focus-visible:opacity-100 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-zinc-300 group-hover:opacity-100 dark:text-zinc-500 dark:hover:text-zinc-200 dark:focus-visible:outline-zinc-400"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
