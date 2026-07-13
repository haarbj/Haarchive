import { categoryMap } from "@/lib/sections";
import { formatRelativeTime } from "@/lib/format";
import type { Question } from "@/lib/questions/types";
import { StatusBadge } from "@/components/questions/status-badge";
import { UpvoteButton } from "@/components/questions/upvote-button";
import { Card } from "@/components/ui/card";

type QuestionCardProps = {
  question: Question;
  upvoted: boolean;
};

export function QuestionCard({ question, upvoted }: QuestionCardProps) {
  const categoryLabel = question.category ? categoryMap.get(question.category)?.title : null;
  const submitter = question.displayName?.trim() || "Anonymous";

  return (
    <Card padding="sm" className="flex gap-4">
      <UpvoteButton questionId={question.id} initialCount={question.upvoteCount} initialUpvoted={upvoted} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={question.status} />
          {question.type === "topic_suggestion" ? (
            <span className="inline-flex items-center rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
              Topic Suggestion
            </span>
          ) : null}
          {categoryLabel ? (
            <span className="inline-flex items-center rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
              {categoryLabel}
            </span>
          ) : null}
        </div>

        {question.description ? (
          <details className="mt-2 group">
            <summary className="cursor-pointer list-none text-base font-semibold tracking-tight text-zinc-900 marker:content-none dark:text-white">
              {question.title}
            </summary>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{question.description}</p>
          </details>
        ) : (
          <p className="mt-2 text-base font-semibold tracking-tight text-zinc-900 dark:text-white">
            {question.title}
          </p>
        )}

        {question.isFaq && question.adminResponse ? (
          <p className="mt-2 rounded-lg border-l-4 border-emerald-500/50 bg-emerald-500/5 px-3 py-2 text-sm leading-6 text-zinc-700 dark:border-emerald-400/40 dark:bg-emerald-400/5 dark:text-zinc-300">
            {question.adminResponse}
          </p>
        ) : null}

        {question.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {question.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-black/10 px-2 py-0.5 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Asked by {submitter} · {formatRelativeTime(question.createdAt)}
        </p>
      </div>
    </Card>
  );
}
