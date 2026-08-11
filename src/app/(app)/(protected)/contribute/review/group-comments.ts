// Plain data logic, deliberately kept out of comment-thread.tsx (which is
// "use client"): a Server Component can't call a function exported from a
// "use client" module directly (only render its components as JSX), so
// review/[id]/page.tsx and contribute/articles/[id]/page.tsx -- both
// Server Components -- need this in its own client-directive-free module
// to call it during render.

export type CommentWithAuthor = {
  id: string;
  authorName: string;
  blockIndex: number | null;
  comment: string;
  resolved: boolean;
  isOwn: boolean;
};

// Groups a flat comments array by the block it's anchored to, so a caller
// can render each block's own feedback immediately next to that block
// instead of in one combined list a reviewer has to cross-reference by
// scrolling -- see BlockComments in comment-thread.tsx, and this module's
// two call sites (review/[id]/page.tsx, contribute/articles/[id]/page.tsx)
// for why this replaced the old single flat CommentThread.
export function groupCommentsByBlock(comments: CommentWithAuthor[]): {
  byBlock: Map<number, CommentWithAuthor[]>;
  general: CommentWithAuthor[];
} {
  const byBlock = new Map<number, CommentWithAuthor[]>();
  const general: CommentWithAuthor[] = [];
  for (const c of comments) {
    if (c.blockIndex === null) {
      general.push(c);
      continue;
    }
    const existing = byBlock.get(c.blockIndex);
    if (existing) existing.push(c);
    else byBlock.set(c.blockIndex, [c]);
  }
  return { byBlock, general };
}
