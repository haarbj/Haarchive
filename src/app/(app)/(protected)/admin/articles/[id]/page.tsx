import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createServiceRoleClient } from "@/lib/db/service-role";
import { loadAllUsers } from "@/lib/admin/users";
import { ARTICLE_STATUS_LABELS, ARTICLE_TYPE_LABELS, type ArticleStatus, type ArticleType } from "@/lib/articles/constants";
import { blockPreviewText } from "@/lib/articles/block-preview";
import type { ContentBlock } from "@/lib/sections";
import { ALLOWED_ARTICLE_TRANSITIONS } from "@/lib/articles/constants";
import { StatusPanel } from "./status-panel";
import { ContributorsPanel, type ContributorRow } from "./contributors-panel";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Card } from "@/components/ui/card";

type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  article_type: string;
  evidence_category: string | null;
  tags: string[];
  content: ContentBlock[];
  status: ArticleStatus;
};

type CitationRow = {
  paper_title: string;
  authors: string | null;
  year: number | null;
  link_or_doi: string | null;
  topic: string | null;
  claim_supported: string | null;
};
type CommentRow = { id: string; user_id: string | null; block_index: number | null; comment: string; resolved: boolean };
type ContributorRawRow = { id: string; user_id: string; contributor_role: string };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const admin = createServiceRoleClient();
  const { data: article } = await admin.from("articles").select("title").eq("id", id).maybeSingle<{ title: string }>();
  return { title: article?.title ?? "Article" };
}

export default async function AdminArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createServiceRoleClient();

  const [{ data: article }, { data: citations }, { data: comments }, { data: contributorRows }, users] =
    await Promise.all([
      admin.from("articles").select("*").eq("id", id).maybeSingle<ArticleRow>(),
      admin
        .from("article_citations")
        .select("paper_title, authors, year, link_or_doi, topic, claim_supported")
        .eq("article_id", id)
        .returns<CitationRow[]>(),
      admin
        .from("article_comments")
        .select("id, user_id, block_index, comment, resolved")
        .eq("article_id", id)
        .order("created_at", { ascending: true })
        .returns<CommentRow[]>(),
      admin
        .from("article_contributors")
        .select("id, user_id, contributor_role")
        .eq("article_id", id)
        .returns<ContributorRawRow[]>(),
      loadAllUsers(),
    ]);

  if (!article) notFound();

  const nameById = new Map(users.map((u) => [u.id, u.displayName]));
  const contributors: ContributorRow[] = (contributorRows ?? []).map((c) => ({
    id: c.id,
    userId: c.user_id,
    name: nameById.get(c.user_id) ?? "Runner",
    role: c.contributor_role,
  }));

  return (
    <Container variant="dashboard">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading>{article.title}</Heading>
          {article.subtitle ? (
            <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-300">{article.subtitle}</p>
          ) : null}
        </div>
        {article.status === "published" ? (
          <Link
            href={`/${article.slug}`}
            className="text-sm font-semibold text-zinc-700 underline dark:text-zinc-200"
          >
            View live →
          </Link>
        ) : null}
      </div>

      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
        {ARTICLE_STATUS_LABELS[article.status]} · {ARTICLE_TYPE_LABELS[article.article_type as ArticleType] ?? article.article_type}
        {article.evidence_category ? ` · ${article.evidence_category}` : ""}
      </p>

      <div className="mt-8 space-y-8">
        <Card padding="md">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Status</h2>
          <div className="mt-3">
            <StatusPanel
              articleId={article.id}
              allowedNext={ALLOWED_ARTICLE_TRANSITIONS[article.status] ?? []}
              canDelete={article.status !== "published"}
            />
          </div>
        </Card>

        <Card padding="md">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Contributors</h2>
          <div className="mt-3">
            <ContributorsPanel articleId={article.id} contributors={contributors} users={users} />
          </div>
        </Card>

        <Card padding="md">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Content ({article.content.length} blocks)</h2>
          <div className="mt-3 space-y-2">
            {article.content.map((block, index) => (
              <p key={index} className="text-sm text-zinc-600 dark:text-zinc-300">
                <span className="font-semibold text-zinc-900 dark:text-white">{index + 1}. {block.type}</span>{" "}
                {blockPreviewText(block)}
              </p>
            ))}
          </div>
        </Card>

        <Card padding="md">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Citations ({(citations ?? []).length})</h2>
          <div className="mt-3 space-y-2">
            {(citations ?? []).length > 0 ? (
              (citations ?? []).map((c, index) => (
                <p key={index} className="text-sm text-zinc-600 dark:text-zinc-300">
                  {c.paper_title}
                  {c.authors ? ` — ${c.authors}` : ""}
                  {c.year ? ` (${c.year})` : ""}
                  {c.link_or_doi ? ` · ${c.link_or_doi}` : ""}
                  {c.topic ? ` · Topic: ${c.topic}` : ""}
                  {c.claim_supported ? ` · Claim: ${c.claim_supported}` : ""}
                </p>
              ))
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">No citations submitted.</p>
            )}
          </div>
        </Card>

        <Card padding="md">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Comments ({(comments ?? []).length})</h2>
          <div className="mt-3 space-y-2">
            {(comments ?? []).length > 0 ? (
              (comments ?? []).map((c) => (
                <div key={c.id} className={c.resolved ? "opacity-60" : undefined}>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    <span className="font-semibold text-zinc-900 dark:text-white">
                      {c.user_id ? (nameById.get(c.user_id) ?? "Runner") : "Runner"}
                    </span>
                    {c.block_index !== null ? ` (block ${c.block_index + 1})` : ""}: {c.comment}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">No comments yet.</p>
            )}
          </div>
        </Card>
      </div>
    </Container>
  );
}
