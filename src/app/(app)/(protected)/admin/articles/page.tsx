import type { Metadata } from "next";
import Link from "next/link";

import { createServiceRoleClient } from "@/lib/db/service-role";
import { ARTICLE_STATUS_LABELS, type ArticleStatus } from "@/lib/articles/constants";
import { formatRelativeTime } from "@/lib/format";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Articles",
};

type ArticleListRow = { id: string; title: string; status: ArticleStatus; updated_at: string };

const STATUS_ORDER: ArticleStatus[] = ["in_review", "approved", "draft", "published"];

export default async function AdminArticlesPage() {
  const admin = createServiceRoleClient();
  const { data: articles } = await admin
    .from("articles")
    .select("id, title, status, updated_at")
    .order("updated_at", { ascending: false })
    .returns<ArticleListRow[]>();

  const sorted = [...(articles ?? [])].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  );

  return (
    <Container variant="dashboard">
      <BackLink href="/admin">Back to Admin</BackLink>
      <Heading>Articles</Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Every contributor-authored article, across every stage of the workflow.
      </p>

      <div className="mt-8 space-y-2">
        {sorted.length > 0 ? (
          sorted.map((article) => (
            <Link
              key={article.id}
              href={`/admin/articles/${article.id}`}
              className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-4 py-3 text-sm transition hover:-translate-y-0.5 hover:shadow-card-hover dark:border-white/10 dark:bg-zinc-900"
            >
              <span className="font-medium text-zinc-900 dark:text-white">{article.title}</span>
              <span className="flex items-center gap-3 text-zinc-600 dark:text-zinc-300">
                <span>{ARTICLE_STATUS_LABELS[article.status]}</span>
                <span>· {formatRelativeTime(article.updated_at)}</span>
              </span>
            </Link>
          ))
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">No articles yet.</p>
        )}
      </div>
    </Container>
  );
}
