import { describe, expect, it } from "vitest";

import { buildArticleAttribution } from "@/lib/articles/attribution";

describe("buildArticleAttribution", () => {
  const profiles = [
    { id: "user-1", display_name: "Ericka Randazzo", avatar_url: "https://example.com/ericka.jpg" },
    { id: "user-2", display_name: "Brody Haar", avatar_url: null },
  ];
  const contributorProfiles = [{ user_id: "user-1", title: "Elite Distance Runner" }];

  it("splits contributors into authors and reviewers by role", () => {
    const contributors = [
      { user_id: "user-1", contributor_role: "author", title_override: null },
      { user_id: "user-2", contributor_role: "reviewer", title_override: null },
    ];
    const result = buildArticleAttribution(contributors, profiles, contributorProfiles, null, null);
    expect(result.authors).toHaveLength(1);
    expect(result.authors[0].name).toBe("Ericka Randazzo");
    expect(result.reviewers).toHaveLength(1);
    expect(result.reviewers[0].name).toBe("Brody Haar");
  });

  it("prefers a per-article title_override over the contributor's default title", () => {
    const contributors = [{ user_id: "user-1", contributor_role: "author", title_override: "Guest Coach" }];
    const result = buildArticleAttribution(contributors, profiles, contributorProfiles, null, null);
    expect(result.authors[0].title).toBe("Guest Coach");
  });

  it("falls back to the contributor's default title when no override is set", () => {
    const contributors = [{ user_id: "user-1", contributor_role: "author", title_override: null }];
    const result = buildArticleAttribution(contributors, profiles, contributorProfiles, null, null);
    expect(result.authors[0].title).toBe("Elite Distance Runner");
  });

  it("returns null title when neither an override nor a default exists", () => {
    const contributors = [{ user_id: "user-2", contributor_role: "author", title_override: null }];
    const result = buildArticleAttribution(contributors, profiles, contributorProfiles, null, null);
    expect(result.authors[0].title).toBeNull();
  });

  it("drops a contributor row whose profile can't be found", () => {
    const contributors = [{ user_id: "missing-user", contributor_role: "author", title_override: null }];
    const result = buildArticleAttribution(contributors, profiles, contributorProfiles, null, null);
    expect(result.authors).toHaveLength(0);
  });

  it("passes through publishedAt and evidenceCategory unchanged", () => {
    const result = buildArticleAttribution([], profiles, contributorProfiles, "2026-07-01T00:00:00Z", "consensus");
    expect(result.publishedAt).toBe("2026-07-01T00:00:00Z");
    expect(result.evidenceCategory).toBe("consensus");
  });

  it("ignores a 'contributor' role for both authors and reviewers lists", () => {
    const contributors = [{ user_id: "user-1", contributor_role: "contributor", title_override: null }];
    const result = buildArticleAttribution(contributors, profiles, contributorProfiles, null, null);
    expect(result.authors).toHaveLength(0);
    expect(result.reviewers).toHaveLength(0);
  });
});
