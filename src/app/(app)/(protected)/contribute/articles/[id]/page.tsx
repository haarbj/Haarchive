import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { ARTICLE_STATUS_LABELS, type ArticleStatus } from "@/lib/articles/constants";
import type { ContentBlock } from "@/lib/sections";
import { ArticleEditorForm } from "@/app/(app)/(protected)/contribute/articles/article-editor-form";
import { SubmitForReviewButton } from "./submit-for-review-button";
import type { CitationDraft } from "@/app/(app)/(protected)/contribute/articles/citations-editor";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

type ArticleRow = {
  id: string;
  title: string;
  subtitle: string | null;
  article_type: string;
  evidence_category: string | null;
  tags: string[];
  cover_image_url: string | null;
  content: ContentBlock[];
  status: ArticleStatus;
  primary_author_id: string | null;
};

type CitationRow = {
  paper_title: string;
  authors: string | null;
  year: number | null;
  link_or_doi: string | null;
  topic: string | null;
  claim_supported: string | null;
  notes: string | null;
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const admin = createServiceRoleClient();
  const { data: article } = await admin.from("articles").select("title").eq("id", id).maybeSingle<{ title: string }>();
  return { title: article?.title ?? "Edit Draft" };
}

export default async function EditArticleDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAppSession(); // non-null: contribute/layout.tsx already gated

  const admin = createServiceRoleClient();
  const [{ data: article }, { data: citations }] = await Promise.all([
    admin.from("articles").select("*").eq("id", id).maybeSingle<ArticleRow>(),
    admin
      .from("article_citations")
      .select("paper_title, authors, year, link_or_doi, topic, claim_supported, notes")
      .eq("article_id", id)
      .returns<CitationRow[]>(),
  ]);

  if (!article) notFound();
  const isAuthor = article.primary_author_id === session!.userId;
  if (!session!.isAdmin && !isAuthor) notFound();

  const initial = {
    title: article.title,
    subtitle: article.subtitle ?? "",
    articleType: article.article_type,
    evidenceCategory: article.evidence_category ?? "",
    tagsInput: article.tags.join(", "),
    coverImageUrl: article.cover_image_url ?? "",
    content: article.content ?? [],
    citations: (citations ?? []).map(
      (c): CitationDraft => ({
        paperTitle: c.paper_title,
        authors: c.authors ?? "",
        year: c.year ? String(c.year) : "",
        linkOrDoi: c.link_or_doi ?? "",
        topic: c.topic ?? "",
        claimSupported: c.claim_supported ?? "",
        notes: c.notes ?? "",
      }),
    ),
  };

  const canEdit = session!.isAdmin || article.status === "draft" || article.status === "in_review";

  return (
    <Container variant="narrow">
      <BackLink href="/contribute/articles">Back to My Drafts</BackLink>
      <Heading variant="compact">{article.title}</Heading>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{ARTICLE_STATUS_LABELS[article.status]}</p>

      {isAuthor && article.status === "draft" ? <SubmitForReviewButton articleId={article.id} /> : null}

      {canEdit ? (
        <div className="mt-8">
          <ArticleEditorForm mode="edit" articleId={article.id} initial={initial} />
        </div>
      ) : (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-300">
          This article is {ARTICLE_STATUS_LABELS[article.status].toLowerCase()} and can no longer be edited here.
        </p>
      )}
    </Container>
  );
}
