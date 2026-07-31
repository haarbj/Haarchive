import type { Metadata } from "next";
import Link from "next/link";

import { categories } from "@/lib/sections";
import { Container } from "@/components/ui/container";
import { SiteSearchBox } from "@/components/site-search";
import { runSiteSearch } from "@/lib/search/run-search";

export const metadata: Metadata = {
  title: "Search | The Haarchive",
};

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q ?? "";
  // Rendered server-side so a shared /search?q=... link shows real results
  // immediately, before the client component hydrates and takes over.
  const initialResults = query.trim() ? await runSiteSearch(query) : null;

  return (
    <Container variant="content">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">Search</h1>
      <div className="mt-6 max-w-xl">
        <SiteSearchBox variant="page" initialQuery={query} initialResults={initialResults} />

        {/* SiteSearchBox renders nothing at all below the input until
            there's a query -- previously left this page a near-blank gap
            down to the footer for anyone who lands here without one
            already typed. Category shortcuts give that visit somewhere to
            go instead of a dead end. */}
        {!query.trim() && (
          <div className="mt-10">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Or browse by topic</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/${category.slug}`}
                  className="rounded-pill border border-black/10 px-3.5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-black/5 hover:text-zinc-950 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  {category.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Container>
  );
}
