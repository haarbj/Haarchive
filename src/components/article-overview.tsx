import Link from "next/link";

import { Card } from "@/components/ui/card";

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
};

export function ArticleOverview({
  category,
  title,
  readingMinutes,
  sectionCount,
  lastUpdated,
  hasKnowledgeCheck,
}: ArticleOverviewProps) {
  const formattedDate = lastUpdated
    ? new Date(`${lastUpdated}T00:00:00`).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="mt-8">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400"
      >
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

      <Card as="dl" padding="sm" className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-1.5">
          <dt className="text-zinc-500 dark:text-zinc-400">Reading time</dt>
          <dd className="font-semibold text-zinc-900 dark:text-white">{readingMinutes} min</dd>
        </div>
        {sectionCount > 0 ? (
          <div className="flex items-center gap-1.5">
            <dt className="text-zinc-500 dark:text-zinc-400">Sections</dt>
            <dd className="font-semibold text-zinc-900 dark:text-white">{sectionCount}</dd>
          </div>
        ) : null}
        {formattedDate ? (
          <div className="flex items-center gap-1.5">
            <dt className="text-zinc-500 dark:text-zinc-400">Last updated</dt>
            <dd className="font-semibold text-zinc-900 dark:text-white">{formattedDate}</dd>
          </div>
        ) : null}
        {hasKnowledgeCheck ? (
          <div className="flex items-center gap-1.5">
            <dt className="text-zinc-500 dark:text-zinc-400">Includes</dt>
            <dd className="font-semibold text-zinc-900 dark:text-white">A knowledge check</dd>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
