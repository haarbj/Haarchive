import Link from "next/link";

import type { PublishedArticleListItem } from "@/lib/articles/list";
import { formatDate } from "@/lib/format";

// Simple editorial text list, not a "you might also like" card carousel --
// no dedicated related-articles component existed before this (ChapterNav
// is Foundations-linear-order only and doesn't apply to DB articles). 2-3
// entries, no invented metadata (see selectRelatedArticles in
// lib/articles/list.ts for how these are chosen), sparing image use.
export function ContinueReading({ articles }: { articles: PublishedArticleListItem[] }) {
  if (articles.length === 0) return null;

  return (
    <div className="mt-16 border-t border-black/10 pt-10 dark:border-white/10">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
        Continue Reading
      </p>
      <div className="mt-5 divide-y divide-black/10 dark:divide-white/10">
        {articles.map((article) => (
          <Link key={article.slug} href={`/${article.slug}`} className="group flex items-center gap-5 py-5">
            {article.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded/external URL, not a local/optimized asset
              <img
                src={article.coverImageUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded-card object-cover"
              />
            ) : null}
            <div>
              <h3 className="font-serif text-lg font-medium tracking-tight text-zinc-900 group-hover:underline dark:text-white">
                {article.title}
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {article.readingMinutes} min read
                {article.publishedAt ? ` · ${formatDate(article.publishedAt.slice(0, 10))}` : ""}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
