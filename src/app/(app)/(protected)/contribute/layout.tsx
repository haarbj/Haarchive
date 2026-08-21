import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { hasAnyContentPermission } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/db/service-role";

// Deliberately separate from both admin/layout.tsx (isAdmin only) and
// coach/layout.tsx (role === 'coach' only) -- gated on content permissions,
// which admins also always satisfy since "admins have access to everything."
export default async function ContributeLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (session?.isAdmin || hasAnyContentPermission(session?.permissions ?? [])) {
    return children;
  }

  // A second fallback, not just the site-wide Content Contributor
  // permission above: an admin adding someone as a co-author on one
  // specific article (article_contributors, contributor_role="author",
  // via that article's own contributor picker) never automatically grants
  // the site-wide permission -- without this check, that person was
  // redirected away from /contribute entirely and could never reach the
  // article they were added to, even though contribute/articles/page.tsx
  // and its [id]/page.tsx both already correctly include and authorize
  // them once they get past this gate (see isArticleAuthor, the same
  // "primary author OR article_contributors author row" check they use).
  // Scoped to contributor_role="author" specifically, not any role -- a
  // reviewer-only contributor still needs the site-wide "reviewer"
  // permission, unchanged. Every other /contribute/* page a co-author
  // could now also load (questions, review, suggestions, profile) already
  // scopes its own queries to the signed-in user's own id, so this doesn't
  // grant any capability beyond reaching the one article they're on.
  if (session?.userId) {
    const admin = createServiceRoleClient();
    const { data } = await admin
      .from("article_contributors")
      .select("id")
      .eq("user_id", session.userId)
      .eq("contributor_role", "author")
      .limit(1)
      .maybeSingle();
    if (data) return children;
  }

  redirect("/dashboard");
}
