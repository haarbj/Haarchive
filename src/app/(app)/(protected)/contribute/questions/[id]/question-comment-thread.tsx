"use client";

import { useActionState, useTransition } from "react";

import {
  addQuestionComment,
  deleteQuestionComment,
  toggleQuestionCommentResolved,
  type QuestionCommentState,
} from "@/app/(app)/(protected)/contribute/questions/actions";
import { fieldClass as baseFieldClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { FormError } from "@/components/ui/form-error";

const fieldClass = `w-full ${baseFieldClass}`;

export type QuestionCommentWithAuthor = {
  id: string;
  authorName: string;
  comment: string;
  resolved: boolean;
  isOwn: boolean;
};

export function QuestionCommentThread({
  questionId,
  comments,
  canComment,
  canModerate,
}: {
  questionId: string;
  comments: QuestionCommentWithAuthor[];
  canComment: boolean;
  canModerate: boolean;
}) {
  const [state, formAction, isPending] = useActionState<QuestionCommentState, FormData>(addQuestionComment, {});
  const [isToggling, startToggle] = useTransition();

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {comments.length > 0 ? (
          comments.map((c) => (
            <Card key={c.id} padding="sm" className={c.resolved ? "opacity-60" : undefined}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">{c.authorName}</p>
                {c.isOwn || canModerate ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => startToggle(() => toggleQuestionCommentResolved(c.id, questionId))}
                      className="text-xs font-semibold text-zinc-600 dark:text-zinc-300"
                    >
                      {c.resolved ? "Reopen" : "Mark resolved"}
                    </button>
                    <ConfirmButton
                      action={() => deleteQuestionComment(c.id, questionId)}
                      confirmMessage="Delete this comment? This can't be undone."
                      label="Delete"
                      pendingLabel="Deleting…"
                      className="text-xs font-semibold text-red-700 dark:text-red-400"
                    />
                  </div>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">{c.comment}</p>
            </Card>
          ))
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">No feedback yet.</p>
        )}
      </div>

      {canComment ? (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="questionId" value={questionId} />
          <textarea
            name="comment"
            rows={3}
            aria-label="Comment"
            placeholder="Leave feedback on this draft…"
            className={fieldClass}
          />
          {state.error ? <FormError>{state.error}</FormError> : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Posting…" : "Add comment"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
