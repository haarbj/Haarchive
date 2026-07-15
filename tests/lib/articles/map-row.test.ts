import { describe, expect, it } from "vitest";

import { mapArticleRow, mapArticleCitationRow, mapArticleCommentRow } from "@/lib/articles/map-row";

describe("mapArticleRow", () => {
  it("maps snake_case columns to camelCase fields", () => {
    const result = mapArticleRow({
      id: "article-1",
      slug: "my-essay",
      title: "My Essay",
      subtitle: "A subtitle",
      article_type: "essay",
      evidence_category: "consensus",
      tags: ["a", "b"],
      cover_image_url: "https://example.com/x.jpg",
      content: [{ type: "paragraph", text: "Hi" }],
      status: "draft",
      primary_author_id: "user-1",
      published_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    });

    expect(result.articleType).toBe("essay");
    expect(result.evidenceCategory).toBe("consensus");
    expect(result.coverImageUrl).toBe("https://example.com/x.jpg");
    expect(result.primaryAuthorId).toBe("user-1");
    expect(result.publishedAt).toBeNull();
    expect(result.content).toHaveLength(1);
  });

  it("defaults null tags/content to empty arrays", () => {
    const result = mapArticleRow({
      id: "article-1",
      slug: "my-essay",
      title: "My Essay",
      subtitle: null,
      article_type: "article",
      evidence_category: null,
      tags: null,
      cover_image_url: null,
      content: null,
      status: "draft",
      primary_author_id: null,
      published_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });

    expect(result.tags).toEqual([]);
    expect(result.content).toEqual([]);
  });
});

describe("mapArticleCitationRow", () => {
  it("maps snake_case columns to camelCase fields", () => {
    const result = mapArticleCitationRow({
      id: "cite-1",
      article_id: "article-1",
      paper_title: "A Paper",
      authors: "Smith et al.",
      year: 2020,
      link_or_doi: "10.1234/x",
      notes: null,
      submitted_by: "user-1",
      created_at: "2026-01-01T00:00:00Z",
    });
    expect(result.paperTitle).toBe("A Paper");
    expect(result.linkOrDoi).toBe("10.1234/x");
    expect(result.submittedBy).toBe("user-1");
  });
});

describe("mapArticleCommentRow", () => {
  it("maps snake_case columns to camelCase fields", () => {
    const result = mapArticleCommentRow({
      id: "comment-1",
      article_id: "article-1",
      user_id: "user-1",
      block_index: 2,
      comment: "Needs more nuance.",
      resolved: false,
      created_at: "2026-01-01T00:00:00Z",
    });
    expect(result.blockIndex).toBe(2);
    expect(result.resolved).toBe(false);
  });
});
