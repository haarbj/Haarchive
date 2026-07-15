import type { ContentBlock } from "@/lib/sections";
import type { ArticleStatus } from "@/lib/articles/constants";
import type { Article, ArticleCitation, ArticleComment } from "@/lib/articles/types";

export type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  article_type: string;
  evidence_category: string | null;
  tags: string[] | null;
  cover_image_url: string | null;
  content: ContentBlock[] | null;
  status: ArticleStatus;
  primary_author_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export function mapArticleRow(row: ArticleRow): Article {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    articleType: row.article_type,
    evidenceCategory: row.evidence_category,
    tags: row.tags ?? [],
    coverImageUrl: row.cover_image_url,
    content: row.content ?? [],
    status: row.status,
    primaryAuthorId: row.primary_author_id,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type ArticleCitationRow = {
  id: string;
  article_id: string | null;
  paper_title: string;
  authors: string | null;
  year: number | null;
  link_or_doi: string | null;
  notes: string | null;
  submitted_by: string | null;
  created_at: string;
};

export function mapArticleCitationRow(row: ArticleCitationRow): ArticleCitation {
  return {
    id: row.id,
    articleId: row.article_id,
    paperTitle: row.paper_title,
    authors: row.authors,
    year: row.year,
    linkOrDoi: row.link_or_doi,
    notes: row.notes,
    submittedBy: row.submitted_by,
    createdAt: row.created_at,
  };
}

type ArticleCommentRow = {
  id: string;
  article_id: string;
  user_id: string | null;
  block_index: number | null;
  comment: string;
  resolved: boolean;
  created_at: string;
};

export function mapArticleCommentRow(row: ArticleCommentRow): ArticleComment {
  return {
    id: row.id,
    articleId: row.article_id,
    userId: row.user_id,
    blockIndex: row.block_index,
    comment: row.comment,
    resolved: row.resolved,
    createdAt: row.created_at,
  };
}
