"use client";

import { useActionState } from "react";

import { addWorkoutComment, type AddCommentState } from "./comment-actions";
import { formatRelativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

export type CommentItem = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  isOwn: boolean;
};

// Same shape as review/comment-thread.tsx's BlockComments -- server-fetched
// comments passed in as a prop, a useActionState form to post a new one,
// revalidated by the parent Server Component. Not the general coach<->
// athlete DM thread (see comment-actions.ts's own note on why this stays
// workout-scoped).
export function WorkoutComments({
  scheduledWorkoutId,
  comments,
  isCoach,
}: {
  scheduledWorkoutId: string;
  comments: CommentItem[];
  isCoach: boolean;
}) {
  const [state, formAction, isPending] = useActionState<AddCommentState, FormData>(
    addWorkoutComment.bind(null, scheduledWorkoutId),
    {},
  );

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Comments</p>

      {comments.length > 0 ? (
        <div className="mt-3 space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="text-sm">
              <p className="text-zinc-900 dark:text-white">{comment.body}</p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {comment.isOwn ? "You" : comment.authorName} · {formatRelativeTime(comment.createdAt)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">No comments yet.</p>
      )}

      <form action={formAction} className="mt-4 flex items-start gap-2">
        <textarea
          name="body"
          rows={1}
          placeholder={isCoach ? "Leave a note about this workout…" : "Ask a question about this workout…"}
          className="min-w-0 flex-1 rounded-control border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-900 focus:outline-none dark:border-white/10 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
        />
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Sending…" : "Send"}
        </Button>
      </form>
      {state.error && <FormError className="mt-2">{state.error}</FormError>}
    </div>
  );
}
