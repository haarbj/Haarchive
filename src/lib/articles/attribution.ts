export type ContributorAttribution = {
  userId: string;
  name: string;
  title: string | null;
  avatarUrl: string | null;
};

export type ArticleAttribution = {
  // Every "author"-role person, rendered with equal visual weight -- some
  // articles genuinely have no single "lead," just co-authors who wrote it
  // together, so this never singles one out. primary_author_id (if it
  // resolves to one of these) only sorts that person first, as a display-
  // order hint, not a claim they contributed more.
  authors: ContributorAttribution[];
  // A distinct role from "author" (see article_contributors/the admin
  // panel) -- kept as its own separately-labeled group instead of merged
  // into the author line, so an author and a contributor actually read
  // differently, not as two names in the same bucket.
  contributors: ContributorAttribution[];
  // Kept separate from authorship entirely -- review is a distinct trust
  // signal (verification), not another flavor of "helped write this".
  reviewers: ContributorAttribution[];
  publishedAt: string | null;
  evidenceCategory: string | null;
};

type ContributorRow = { user_id: string; contributor_role: string; title_override: string | null };
type ProfileRow = { id: string; display_name: string; avatar_url: string | null };
type ContributorProfileRow = { user_id: string; title: string | null };

// Pure assembly, kept separate from the DB reads in [slug]/page.tsx so it's
// testable without a live database -- per-article title_override wins over
// the contributor's own default contributor_profiles.title, since the same
// person may be credited differently on different pieces.
export function buildArticleAttribution(
  contributors: ContributorRow[],
  profiles: ProfileRow[],
  contributorProfiles: ContributorProfileRow[],
  primaryAuthorId: string | null,
  publishedAt: string | null,
  evidenceCategory: string | null,
): ArticleAttribution {
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const titleById = new Map(contributorProfiles.map((c) => [c.user_id, c.title]));

  function toAttribution(row: ContributorRow): ContributorAttribution | null {
    const profile = profileById.get(row.user_id);
    if (!profile) return null;
    return {
      userId: row.user_id,
      name: profile.display_name,
      title: row.title_override ?? titleById.get(row.user_id) ?? null,
      avatarUrl: profile.avatar_url,
    };
  }

  function byRole(role: string): ContributorAttribution[] {
    return contributors
      .filter((c) => c.contributor_role === role)
      .map(toAttribution)
      .filter((c): c is ContributorAttribution => c !== null);
  }

  const authorsRaw = byRole("author");
  const authors = primaryAuthorId
    ? [...authorsRaw].sort((a, b) => {
        if (a.userId === primaryAuthorId) return -1;
        if (b.userId === primaryAuthorId) return 1;
        return 0;
      })
    : authorsRaw;

  return {
    authors,
    contributors: byRole("contributor"),
    reviewers: byRole("reviewer"),
    publishedAt,
    evidenceCategory,
  };
}
