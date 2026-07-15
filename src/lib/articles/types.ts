import type { ContentBlock } from "@/lib/sections";
import type { ArticleStatus } from "@/lib/articles/constants";

export type Article = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  articleType: string;
  evidenceCategory: string | null;
  tags: string[];
  coverImageUrl: string | null;
  content: ContentBlock[];
  status: ArticleStatus;
  primaryAuthorId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ArticleCitation = {
  id: string;
  articleId: string | null;
  paperTitle: string;
  authors: string | null;
  year: number | null;
  linkOrDoi: string | null;
  notes: string | null;
  submittedBy: string | null;
  createdAt: string;
};

export type ArticleComment = {
  id: string;
  articleId: string;
  userId: string | null;
  blockIndex: number | null;
  comment: string;
  resolved: boolean;
  createdAt: string;
};
