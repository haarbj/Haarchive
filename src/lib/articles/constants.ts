// Plain arrays, not Postgres enums (see the articles migration) -- both
// lists are meant to grow over time without a migration each time.
export const ARTICLE_TYPES = ["article", "essay", "research_summary", "coaching_perspective"] as const;
export type ArticleType = (typeof ARTICLE_TYPES)[number];
export const ARTICLE_TYPE_LABELS: Record<ArticleType, string> = {
  article: "Article",
  essay: "Essay",
  research_summary: "Research Summary",
  coaching_perspective: "Coaching Perspective",
};

export const EVIDENCE_CATEGORIES = ["consensus", "mixed_evidence", "emerging_research", "coaching_philosophy"] as const;
export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];
export const EVIDENCE_CATEGORY_LABELS: Record<EvidenceCategory, string> = {
  consensus: "Scientific Consensus",
  mixed_evidence: "Mixed Evidence",
  emerging_research: "Emerging Research",
  coaching_philosophy: "Coaching Philosophy",
};

export const ARTICLE_STATUSES = ["draft", "in_review", "approved", "published"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];
export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: "Draft",
  in_review: "In Review",
  approved: "Approved",
  published: "Published",
};

export const ARTICLE_CONTRIBUTOR_ROLES = ["author", "reviewer", "contributor"] as const;
export type ArticleContributorRole = (typeof ARTICLE_CONTRIBUTOR_ROLES)[number];
export const ARTICLE_CONTRIBUTOR_ROLE_LABELS: Record<ArticleContributorRole, string> = {
  author: "Author",
  reviewer: "Reviewer",
  contributor: "Contributor",
};

export const CITATION_STATUSES = ["submitted", "accepted", "rejected"] as const;
export type CitationStatus = (typeof CITATION_STATUSES)[number];
export const CITATION_STATUS_LABELS: Record<CitationStatus, string> = {
  submitted: "Submitted",
  accepted: "Accepted",
  rejected: "Rejected",
};

// Which status transitions an admin can make from a given current status.
// Lives here (not in actions.ts) because a "use server" file may only
// export async functions -- everything else (plain objects, types) has to
// live in a regular module.
export const ALLOWED_ARTICLE_TRANSITIONS: Record<string, ArticleStatus[]> = {
  draft: ["in_review"],
  in_review: ["approved", "draft"],
  approved: ["published", "draft", "in_review"],
  published: ["approved"],
};
