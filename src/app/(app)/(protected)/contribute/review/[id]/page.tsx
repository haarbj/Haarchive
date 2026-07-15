import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { ARTICLE_STATUS_LABELS, type ArticleStatus } from "@/lib/articles/constants";
import { blockPreviewText } from "@/lib/articles/block-preview";
import type { ContentBlock } from "@/lib/sections";
import { CommentThread, type CommentWithAuthor } from "@/app/(app)/(protected)/contribute/review/comment-thread";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Card } from "@/components/ui/card";

type ArticleRow = { id: string; title: string; status: ArticleStatus; content: ContentBlock[] };
type CommentRow = { id: string; user_id: string | null; block_index: number | null; comment: string; resolved: boolean };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const admin = createServiceRoleClient();
  const { data: article } = await admin.from("articles").select("title").eq("id", id).maybeSingle<{ title: string }>();
  return { title: article?.title ?? "Review Article" };
}

export default async function ReviewArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAppSession(); // non-null: contribute/layout.tsx already gated
  const admin = createServiceRoleClient();

  const { data: article } = await admin
    .from("articles")
    .select("id, title, status, content")
    .eq("id", id)
    .maybeSingle<ArticleRow>();
  if (!article) notFound();

  if (!session!.isAdmin) {
    const { data: assignment } = await admin
      .from("article_contributors")
      .select("id")
      .eq("article_id", id)
      .eq("user_id", session!.userId)
      .eq("contributor_role", "reviewer")
      .maybeSingle();
    if (!assignment) notFound();
  }

  const { data: commentRows } = await admin
    .from("article_comments")
    .select("id, user_id, block_index, comment, resolved")
    .eq("article_id", id)
    .order("created_at", { ascending: true })
    .returns<CommentRow[]>();

  const userIds = Array.from(new Set((commentRows ?? []).map((c) => c.user_id).filter((v): v is string => !!v)));
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, display_name").in("id", userIds).returns<{ id: string; display_name: string }[]>()
    : { data: [] as { id: string; display_name: string }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const comments: CommentWithAuthor[] = (commentRows ?? []).map((c) => ({
    id: c.id,
    authorName: c.user_id ? (nameById.get(c.user_id) ?? "Runner") : "Runner",
    blockIndex: c.block_index,
    comment: c.comment,
    resolved: c.resolved,
    isOwn: c.user_id === session!.userId,
  }));

  return (
    <Container variant="content">
      <BackLink href="/contribute/review">Back to Review Queue</BackLink>
      <Heading>{article.title}</Heading>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{ARTICLE_STATUS_LABELS[article.status]}</p>

      <div className="mt-8 space-y-3">
        {article.content.map((block, index) => (
          <Card key={index} padding="sm">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              Block {index + 1} · {block.type}
            </p>
            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">{blockPreviewText(block)}</p>
          </Card>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Comments</h2>
        <div className="mt-4">
          <CommentThread
            articleId={article.id}
            content={article.content}
            comments={comments}
            canModerate={session!.isAdmin}
          />
        </div>
      </div>
    </Container>
  );
}
