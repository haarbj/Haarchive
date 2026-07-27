import "server-only";

import type { createServiceRoleClient } from "@/lib/db/service-role";

// primary_author_id is set once at draft creation (see createArticleDraft)
// and never changes -- it does NOT track every author on the piece.
// Additional authors are added afterward via article_contributors
// (contributor_role = "author"), so any permission check that only
// compares against primary_author_id incorrectly locks out a co-author
// added later. Checked here in one place so the edit page, the save
// action, and the submit-for-review action can't drift out of sync again.
export async function isArticleAuthor(
  admin: ReturnType<typeof createServiceRoleClient>,
  articleId: string,
  userId: string,
  primaryAuthorId: string | null,
): Promise<boolean> {
  if (primaryAuthorId === userId) return true;

  const { data } = await admin
    .from("article_contributors")
    .select("id")
    .eq("article_id", articleId)
    .eq("user_id", userId)
    .eq("contributor_role", "author")
    .maybeSingle();
  return !!data;
}
