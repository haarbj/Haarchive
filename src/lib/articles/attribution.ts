import type { ArticleAttribution, ContributorAttribution } from "@/components/article-byline";

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

  return {
    authors: byRole("author"),
    reviewers: byRole("reviewer"),
    publishedAt,
    evidenceCategory,
  };
}
