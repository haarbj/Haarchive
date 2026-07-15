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
  const { data: articles } = await admin
    .from("articles")
    .select("id, title, status, updated_at")
    .eq("primary_author_id", session!.userId)
    .order("updated_at", { ascending: false })
    .returns<ArticleListRow[]>();

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
