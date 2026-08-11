import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { ARTICLE_STATUS_LABELS, type ArticleStatus } from "@/lib/articles/constants";
import { isArticleAuthor } from "@/lib/articles/is-author";
import { loadTagOptions } from "@/lib/articles/tag-options";
import { blockPreviewText } from "@/lib/articles/block-preview";
import type { ContentBlock } from "@/lib/sections";
import { ArticleEditorForm } from "@/app/(app)/(protected)/contribute/articles/article-editor-form";
import { SubmitForReviewButton } from "./submit-for-review-button";
import type { CitationDraft } from "@/app/(app)/(protected)/contribute/articles/citations-editor";
import { BlockComments } from "@/app/(app)/(protected)/contribute/review/comment-thread";
import { groupCommentsByBlock, type CommentWithAuthor } from "@/app/(app)/(protected)/contribute/review/group-comments";
import { BackLink } from "@/components/ui/back-link";
import { Card } from "@/components/ui/card";
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

type CommentRow = { id: string; user_id: string | null; block_index: number | null; comment: string; resolved: boolean };

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
  const [{ data: article }, { data: citations }, { data: commentRows }, tagOptions] = await Promise.all([
    admin.from("articles").select("*").eq("id", id).maybeSingle<ArticleRow>(),
    admin
      .from("article_citations")
      .select("paper_title, authors, year, link_or_doi, topic, claim_supported, notes")
      .eq("article_id", id)
      .returns<CitationRow[]>(),
    admin
      .from("article_comments")
      .select("id, user_id, block_index, comment, resolved")
      .eq("article_id", id)
      .order("created_at", { ascending: true })
      .returns<CommentRow[]>(),
    loadTagOptions(),
  ]);

  if (!article) notFound();
  const isAuthor = await isArticleAuthor(admin, article.id, session!.userId, article.primary_author_id);
  if (!session!.isAdmin && !isAuthor) notFound();

  const commentUserIds = Array.from(new Set((commentRows ?? []).map((c) => c.user_id).filter((v): v is string => !!v)));
  const { data: commentProfiles } = commentUserIds.length
    ? await admin.from("profiles").select("id, display_name").in("id", commentUserIds).returns<{ id: string; display_name: string }[]>()
    : { data: [] as { id: string; display_name: string }[] };
  const commentAuthorNameById = new Map((commentProfiles ?? []).map((p) => [p.id, p.display_name]));

  const comments: CommentWithAuthor[] = (commentRows ?? []).map((c) => ({
    id: c.id,
    authorName: c.user_id ? (commentAuthorNameById.get(c.user_id) ?? "Runner") : "Runner",
    blockIndex: c.block_index,
    comment: c.comment,
    resolved: c.resolved,
    isOwn: c.user_id === session!.userId,
  }));

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
  const { byBlock, general } = groupCommentsByBlock(comments);

  return (
    <Container variant="narrow">
      <BackLink href="/contribute/articles">Back to My Drafts</BackLink>
      <Heading variant="compact">{article.title}</Heading>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
        {ARTICLE_STATUS_LABELS[article.status]} ·{" "}
        <Link
          href={`/contribute/articles/${article.id}/preview?from=author`}
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Preview
        </Link>
      </p>

      {comments.length > 0 ? (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Reviewer feedback</h2>
          {/* Grouped by the block each comment is actually about, with that
              block's own preview text shown right above it -- previously
              this was one flat list, so knowing which block a comment
              referred to meant scrolling down to the editor to find "Block
              5" and count. */}
          <div className="mt-4 space-y-3">
            {Array.from(byBlock.entries())
              .sort(([a], [b]) => a - b)
              .map(([index, blockComments]) => {
                const block = (article.content ?? [])[index];
                return (
                  <Card key={index} padding="sm">
                    <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                      Block {index + 1} · {block?.type}
                    </p>
                    {block ? <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">{blockPreviewText(block)}</p> : null}
                    <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/10">
                      <BlockComments articleId={article.id} blockIndex={index} comments={blockComments} canModerate={false} canReply={false} />
                    </div>
                  </Card>
                );
              })}
            {general.length > 0 ? (
              <Card padding="sm">
                <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">General comments</p>
                <div className="mt-3">
                  <BlockComments articleId={article.id} blockIndex={null} comments={general} canModerate={false} canReply={false} />
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}

      {isAuthor && article.status === "draft" ? <SubmitForReviewButton articleId={article.id} /> : null}

      {canEdit ? (
        <div className="mt-8">
          <ArticleEditorForm mode="edit" articleId={article.id} initial={initial} tagOptions={tagOptions} />
        </div>
      ) : (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-300">
          This article is {ARTICLE_STATUS_LABELS[article.status].toLowerCase()} and can no longer be edited here.
        </p>
      )}
    </Container>
  );
}
