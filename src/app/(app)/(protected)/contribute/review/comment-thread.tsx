"use client";

import { useActionState, useTransition } from "react";

import type { ContentBlock } from "@/lib/sections";
import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { addArticleComment, toggleCommentResolved, type AddCommentState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const fieldClass = `w-full ${baseFieldClass}`;

export type CommentWithAuthor = {
  id: string;
  authorName: string;
  blockIndex: number | null;
  comment: string;
  resolved: boolean;
  isOwn: boolean;
};

function blockLabel(block: ContentBlock, index: number): string {
  const preview =
    "text" in block ? block.text : block.type === "list" ? block.items[0] : block.type === "image" ? block.url : "";
  return `Block ${index + 1} (${block.type})${preview ? ` — ${preview.slice(0, 40)}` : ""}`;
}

export function CommentThread({
  articleId,
  content,
  comments,
  canModerate,
}: {
  articleId: string;
  content: ContentBlock[];
  comments: CommentWithAuthor[];
  canModerate: boolean;
}) {
  const [state, formAction, isPending] = useActionState<AddCommentState, FormData>(addArticleComment, {});
  const [isToggling, startToggle] = useTransition();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {comments.length > 0 ? (
          comments.map((c) => (
            <Card key={c.id} padding="sm" className={c.resolved ? "opacity-60" : undefined}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                  {c.authorName}
                  {c.blockIndex !== null ? (
                    <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      on block {c.blockIndex + 1}
                    </span>
                  ) : null}
                </p>
                {c.isOwn || canModerate ? (
                  <button
                    type="button"
                    disabled={isToggling}
                    onClick={() => startToggle(() => toggleCommentResolved(c.id, articleId))}
                    className="text-xs font-semibold text-zinc-600 dark:text-zinc-300"
                  >
                    {c.resolved ? "Reopen" : "Mark resolved"}
                  </button>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">{c.comment}</p>
            </Card>
          ))
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">No comments yet.</p>
        )}
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="articleId" value={articleId} />
        <div>
          <label htmlFor="comment-block" className={labelClass}>
            Anchor to
          </label>
          <select id="comment-block" name="blockIndex" defaultValue="" className={fieldClass}>
            <option value="">General comment</option>
            {content.map((block, index) => (
              <option key={index} value={index}>
                {blockLabel(block, index)}
              </option>
            ))}
          </select>
        </div>
        <textarea
          name="comment"
          rows={3}
          placeholder="Needs more nuance. During high-volume endurance training, processed carbohydrates can be useful and sometimes necessary."
          className={fieldClass}
        />
        {state.error ? (
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Posting…" : "Add comment"}
        </Button>
      </form>
    </div>
  );
}
