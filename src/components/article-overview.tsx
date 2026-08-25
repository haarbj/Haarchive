import Link from "next/link";

import type { ContentBlock } from "@/lib/sections";
import { ArticleNotes } from "@/components/notes/article-notes";

type ArticleOverviewProps = {
  // Structural, not the full Category type -- ArticleLayout sometimes
  // passes a synthetic breadcrumb target (e.g. "Articles" instead of the
  // broader "Writing & Resources" category), and mission was never used
  // here anyway.
  category: { slug: string; title: string };
  title: string;
  readingMinutes: number;
  sectionCount: number;
  lastUpdated?: string;
  // Quiet discovery signal for the knowledge check that (if one exists)
  // renders at the bottom of this same page -- so a reader who navigates
  // via the TOC and never scrolls to the very end still knows one exists.
  // Omitted (not a badge/callout) when false, matching every other stat
  // here, which is also conditionally rendered rather than shown empty.
  hasKnowledgeCheck?: boolean;
  // Threaded through to ArticleNotes, rendered inline on the right of the
  // breadcrumb row below -- the Foundations-page equivalent of ArticleHero's
  // own eyebrow-line placement, so both header shapes carry Save/Notes in
  // the same relative spot.
  contentSlug: string;
  content: ContentBlock[];
  initialBookmarked: boolean;
};

export function ArticleOverview({
  category,
  title,
  readingMinutes,
  sectionCount,
  lastUpdated,
  hasKnowledgeCheck,
  contentSlug,
  content,
  initialBookmarked,
}: ArticleOverviewProps) {
  const formattedDate = lastUpdated
    ? new Date(`${lastUpdated}T00:00:00`).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // A single middot-joined line, not a bordered/shadowed stat card -- matches
  // ArticleHero's own DB-article metadata line (author · title · reading
  // time · date) rather than a second, dashboard-flavored way of showing
  // the same kind of quiet per-page facts.
  const stats = [
    `${readingMinutes} min read`,
    sectionCount > 0 ? `${sectionCount} sections` : null,
    formattedDate ? `Last updated ${formattedDate}` : null,
    hasKnowledgeCheck ? "Includes a knowledge check" : null,
  ].filter((stat): stat is string => stat !== null);

  return (
    <div className="mt-8">
      {/* Save/Notes inline on the right of the breadcrumb, not a separate
          row further down the page -- see ArticleHero's own matching
          treatment for a DB article. Wrapped in its own div (not spread
          directly as a flex child) since ArticleNotes' returned fragment
          can have more than one child -- see that comment for why. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Link
            href={`/${category.slug}`}
            className="transition hover:text-zinc-950 dark:hover:text-white"
          >
            {category.title}
          </Link>
          <span aria-hidden="true">→</span>
          <span aria-current="page" className="font-medium text-zinc-900 dark:text-white">
            {title}
          </span>
        </nav>
        <div className="shrink-0">
          <ArticleNotes contentSlug={contentSlug} content={content} initialBookmarked={initialBookmarked} />
        </div>
      </div>

      <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{stats.join(" · ")}</p>
    </div>
  );
}
