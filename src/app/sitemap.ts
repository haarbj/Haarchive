import type { MetadataRoute } from "next";

import { createClient } from "@/lib/db/server";
import { categories, sections } from "@/lib/sections";
import { coaches } from "@/lib/coaches/data";
import { athletes } from "@/lib/athletes/data";
import { TRAINING_PLANS } from "@/lib/training-plans/data";
import { releaseNotes } from "@/lib/release-notes";

// Next's native sitemap convention -- serves /sitemap.xml. Every entry
// below is real, currently-indexable content per docs/seo-audit.md's own
// inclusion list: no invented dates (a date is included only where a real
// field already exists -- Section.lastUpdated, an article's published_at,
// or release-notes' own most-recent entry -- and simply omitted, not
// guessed, everywhere else), and deliberately no entries for authenticated
// routes, /search, /about (a redirect stub to "/", not real content -- see
// its own canonical), or any `?tag=`/`?q=` variant, since a sitemap should
// only ever list the one clean URL for each real page.
//
// /contribute-apply and /questions/ask were added after the initial pass --
// both are genuinely public (no auth gate; contribute-apply's own comment
// says "reachable by anyone, signed in or not") and already carry real,
// deliberate metadata, so they belong here on the same basis as every
// other static utility page below, not a special case.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const { data: articleRows } = await supabase
    .from("articles")
    .select("slug, published_at")
    .eq("status", "published")
    .returns<{ slug: string; published_at: string | null }[]>();

  const mostRecentSiteUpdate = releaseNotes[0]?.date;

  const entries: MetadataRoute.Sitemap = [
    { url: "https://brodyhaar.com/", lastModified: mostRecentSiteUpdate },
    ...categories.map((category) => ({
      url: `https://brodyhaar.com/${category.slug}`,
    })),
    ...sections.map((section) => ({
      url: `https://brodyhaar.com/${section.slug}`,
      lastModified: section.lastUpdated,
    })),
    ...coaches.map((coach) => ({
      url: `https://brodyhaar.com/coaching-library/${coach.slug}`,
    })),
    ...athletes.map((athlete) => ({
      url: `https://brodyhaar.com/athlete-library/${athlete.slug}`,
    })),
    ...TRAINING_PLANS.map((plan) => ({
      url: `https://brodyhaar.com/training-plans/${plan.slug}`,
    })),
    ...(articleRows ?? []).map((article) => ({
      url: `https://brodyhaar.com/${article.slug}`,
      lastModified: article.published_at ?? undefined,
    })),
    { url: "https://brodyhaar.com/faq" },
    { url: "https://brodyhaar.com/privacy-policy" },
    { url: "https://brodyhaar.com/release-notes", lastModified: mostRecentSiteUpdate },
    { url: "https://brodyhaar.com/questions" },
    { url: "https://brodyhaar.com/questions/ask" },
    { url: "https://brodyhaar.com/contribute-apply" },
  ];

  return entries;
}
