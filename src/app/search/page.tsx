import type { Metadata } from "next";

import { Container } from "@/components/ui/container";
import { SiteSearchBox } from "@/components/site-search";
import { runSiteSearch } from "@/lib/search/run-search";

export const metadata: Metadata = {
  title: "Search — The Haarchive",
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
      </div>
    </Container>
  );
}
