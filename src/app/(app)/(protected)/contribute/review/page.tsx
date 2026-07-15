import type { Metadata } from "next";
import Link from "next/link";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { ARTICLE_STATUS_LABELS, type ArticleStatus } from "@/lib/articles/constants";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Review Queue",
};

type ArticleListRow = { id: string; title: string; status: ArticleStatus };

export default async function ReviewQueuePage() {
  const session = await getAppSession(); // non-null: contribute/layout.tsx already gated
  const admin = createServiceRoleClient();

  let articles: ArticleListRow[] = [];
  if (session!.isAdmin) {
    // Admins see the whole review queue, not just articles they're
    // personally assigned to -- they're the final approve/publish gate.
    const { data } = await admin
      .from("articles")
      .select("id, title, status")
      .eq("status", "in_review")
      .order("updated_at", { ascending: false })
      .returns<ArticleListRow[]>();
    articles = data ?? [];
  } else {
    const { data: assignments } = await admin
      .from("article_contributors")
      .select("article_id")
      .eq("user_id", session!.userId)
      .eq("contributor_role", "reviewer")
      .returns<{ article_id: string }[]>();
    const articleIds = (assignments ?? []).map((a) => a.article_id);
    if (articleIds.length > 0) {
      const { data } = await admin
        .from("articles")
        .select("id, title, status")
        .in("id", articleIds)
        .order("updated_at", { ascending: false })
        .returns<ArticleListRow[]>();
      articles = data ?? [];
    }
  }

  return (
    <Container variant="dashboard">
      <BackLink href="/contribute">Back to Contribute</BackLink>
      <Heading>Review Queue</Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        {session!.isAdmin
          ? "Every article currently awaiting review."
          : "Articles you've been assigned to review."}
      </p>

      <div className="mt-8 space-y-3">
        {articles.length > 0 ? (
          articles.map((article) => (
            <Link key={article.id} href={`/contribute/review/${article.id}`} className="group block">
              <Card
                padding="md"
                className="flex items-center justify-between transition group-hover:-translate-y-0.5 group-hover:shadow-card-hover"
              >
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
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Nothing waiting on you right now.</p>
        )}
      </div>
    </Container>
  );
}
