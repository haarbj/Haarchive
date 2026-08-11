"use client";

import { useActionState, useTransition } from "react";

import { fieldClass as baseFieldClass } from "@/lib/form-styles";
import { addArticleComment, deleteArticleComment, toggleCommentResolved, type AddCommentState } from "./actions";
import type { CommentWithAuthor } from "./group-comments";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { FormError } from "@/components/ui/form-error";

const fieldClass = `w-full ${baseFieldClass}`;

// Re-exported so existing call sites can keep importing the type from here
// -- the type itself is erased at compile time, so re-exporting it (unlike
// groupCommentsByBlock, a real runtime function) doesn't cross the
// Server/Client boundary in any meaningful way.
export type { CommentWithAuthor };

function CommentCard({ comment: c, articleId, canModerate }: { comment: CommentWithAuthor; articleId: string; canModerate: boolean }) {
  const [isToggling, startToggle] = useTransition();
  return (
    <Card padding="sm" className={c.resolved ? "opacity-60" : undefined}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{c.authorName}</p>
        {c.isOwn || canModerate ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isToggling}
              onClick={() => startToggle(() => toggleCommentResolved(c.id, articleId))}
              className="text-xs font-semibold text-zinc-600 dark:text-zinc-300"
            >
              {c.resolved ? "Reopen" : "Mark resolved"}
            </button>
            <ConfirmButton
              action={() => deleteArticleComment(c.id, articleId)}
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
  );
}

// Scoped to one specific block (or, with blockIndex=null, the general
// thread) -- no dropdown, since the block this form posts to is already
// fixed by where it's rendered, next to that block's own content.
function AddCommentForm({ articleId, blockIndex }: { articleId: string; blockIndex: number | null }) {
  const [state, formAction, isPending] = useActionState<AddCommentState, FormData>(addArticleComment, {});
  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="articleId" value={articleId} />
      {blockIndex !== null ? <input type="hidden" name="blockIndex" value={blockIndex} /> : null}
      <textarea
        name="comment"
        rows={2}
        aria-label={blockIndex !== null ? `Comment on block ${blockIndex + 1}` : "General comment"}
        placeholder={
          blockIndex !== null
            ? "Needs more nuance. During high-volume endurance training, processed carbohydrates can be useful and sometimes necessary."
            : "A comment not tied to a specific block…"
        }
        className={fieldClass}
      />
      {state.error ? <FormError>{state.error}</FormError> : null}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Posting…" : "Add comment"}
      </Button>
    </form>
  );
}

// One block's worth of feedback: its own comments, directly followed by a
// reply form already scoped to that block -- render this immediately next
// to the block itself (see review/[id]/page.tsx's block loop) rather than
// in a separate section, so editing in response to a comment never
// requires scrolling to find which block it was even about.
export function BlockComments({
  articleId,
  blockIndex,
  comments,
  canModerate,
  canReply,
}: {
  articleId: string;
  blockIndex: number | null;
  comments: CommentWithAuthor[];
  canModerate: boolean;
  /** Whether to show the "add a comment" form -- addArticleComment only authorizes admins and assigned reviewers, so an article's own author (who isn't either) would just get "Not authorized." back on submit. */
  canReply: boolean;
}) {
  return (
    <div className="space-y-2">
      {comments.map((c) => (
        <CommentCard key={c.id} comment={c} articleId={articleId} canModerate={canModerate} />
      ))}
      {canReply ? <AddCommentForm articleId={articleId} blockIndex={blockIndex} /> : null}
    </div>
  );
}
