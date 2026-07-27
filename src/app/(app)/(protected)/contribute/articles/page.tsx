import type { Metadata } from "next";
import Link from "next/link";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { ARTICLE_STATUS_LABELS, type ArticleStatus } from "@/lib/articles/constants";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "My Drafts",
};

type ArticleListRow = { id: string; title: string; status: ArticleStatus; updated_at: string };

export default async function MyArticlesPage() {
  const session = await getAppSession(); // non-null: contribute/layout.tsx already gated

  const admin = createServiceRoleClient();

  // primary_author_id only ever names the original creator -- additional
  // authors are added afterward via article_contributors (contributor_role
  // = "author"), so this list needs both: articles created by this user,
  // plus articles they were added to later as a co-author. Same
  // article_contributors-lookup pattern the review queue already uses for
  // reviewer assignments, just merged with the "own drafts" set instead of
  // branching on admin/non-admin.
  const [{ data: ownDrafts }, { data: coAuthorRows }] = await Promise.all([
    admin
      .from("articles")
      .select("id, title, status, updated_at")
      .eq("primary_author_id", session!.userId)
      .returns<ArticleListRow[]>(),
    admin
      .from("article_contributors")
      .select("article_id")
      .eq("user_id", session!.userId)
      .eq("contributor_role", "author")
      .returns<{ article_id: string }[]>(),
  ]);

  const ownDraftIds = new Set((ownDrafts ?? []).map((a) => a.id));
  const coAuthoredIds = (coAuthorRows ?? []).map((r) => r.article_id).filter((id) => !ownDraftIds.has(id));

  const { data: coAuthoredDrafts } =
    coAuthoredIds.length > 0
      ? await admin.from("articles").select("id, title, status, updated_at").in("id", coAuthoredIds).returns<ArticleListRow[]>()
      : { data: [] as ArticleListRow[] };

  const articles = [...(ownDrafts ?? []), ...(coAuthoredDrafts ?? [])].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  );

  return (
    <Container variant="dashboard">
      <BackLink href="/contribute">Back to Contribute</BackLink>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Heading>My Drafts</Heading>
        <Button href="/contribute/articles/new">New draft</Button>
      </div>

      <div className="mt-8 space-y-3">
        {articles && articles.length > 0 ? (
          articles.map((article) => (
            <Link key={article.id} href={`/contribute/articles/${article.id}`} className="group block">
              <Card padding="md" className="flex items-center justify-between transition group-hover:-translate-y-0.5 group-hover:shadow-card-hover">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-white">{article.title}</p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    {ARTICLE_STATUS_LABELS[article.status]}
                  </p>
                </div>
              </Card>
            </Link>
          ))
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            You haven&rsquo;t started a draft yet.
          </p>
        )}
      </div>
    </Container>
  );
}
