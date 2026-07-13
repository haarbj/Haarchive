import { generateObject } from "ai";
import { z } from "zod";

import { structuredOutputModel } from "@/lib/ai/model";
import { buildSearchFallbackPrompt } from "@/lib/ai/prompts";
import { retrieveRelevantContent } from "@/lib/ai/retrieval";
import { headingId } from "@/lib/heading-id";
import { categoryMap, sections } from "@/lib/sections";
import { search, type SearchEntry } from "@/lib/search-index";
import { searchQuerySchema } from "@/lib/validation/search";

export type SiteSearchResults = {
  matches: SearchEntry[];
  aiSuggestions: SearchEntry[];
};

const EMPTY_RESULTS: SiteSearchResults = { matches: [], aiSuggestions: [] };

// Below this length the AI fallback is skipped even on a zero-match query --
// a 1-3 character query is almost always a truncated word still being
// typed, not a real phrase worth a model call over.
const MIN_QUERY_LENGTH_FOR_AI_FALLBACK = 4;

const sectionBySlug = new Map(sections.map((section) => [section.slug, section]));
const sectionSlugs = sections.map((section) => section.slug) as [string, ...string[]];
const sectionSummaries = sections
  .map((section) => `${section.slug}: ${section.title} -- ${section.mission}`)
  .join("\n");

const aiFallbackSchema = z.object({
  slugs: z.array(z.enum(sectionSlugs)).max(3),
});

function groupFor(categorySlug: string): string {
  return categoryMap.get(categorySlug)?.title ?? "Learn";
}

// Adapts the AI coach's existing keyword-retrieval utility (full body text,
// not just titles/headings) into the same shape the header's title index
// already returns, so callers can merge and dedupe both lists as one.
function bodyMatchesToEntries(query: string, limit: number): SearchEntry[] {
  return retrieveRelevantContent(query, sections, limit).flatMap((excerpt) => {
    const section = sectionBySlug.get(excerpt.sectionSlug);
    if (!section) return [];
    return [
      {
        title: excerpt.heading ?? section.title,
        subtitle: excerpt.text,
        href: excerpt.heading ? `/${section.slug}#${headingId(excerpt.heading)}` : `/${section.slug}`,
        group: groupFor(section.category),
      },
    ];
  });
}

function dedupeByHref(entries: SearchEntry[]): SearchEntry[] {
  const seen = new Set<string>();
  const deduped: SearchEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.href)) continue;
    seen.add(entry.href);
    deduped.push(entry);
  }
  return deduped;
}

// Only reached when literally nothing matched by keyword anywhere in the
// corpus. Constrained to real section slugs via the schema itself -- a
// malformed or hallucinated model response fails Zod parsing rather than
// ever rendering a link that goes nowhere -- and degrades silently to no
// suggestions on any provider error, the same way the one other
// generateObject call site in this app (the admin content-suggestion
// action) treats a model failure as non-fatal to the surrounding feature.
async function fetchAiFallback(query: string): Promise<SearchEntry[]> {
  try {
    const { object } = await generateObject({
      model: structuredOutputModel,
      schema: aiFallbackSchema,
      prompt: buildSearchFallbackPrompt(query, sectionSummaries),
    });

    return object.slugs.flatMap((slug) => {
      const section = sectionBySlug.get(slug);
      if (!section) return [];
      return [
        {
          title: section.title,
          subtitle: section.mission,
          href: `/${section.slug}`,
          group: groupFor(section.category),
        },
      ];
    });
  } catch {
    return [];
  }
}

// The one entry point both the header combobox and the /search results
// page call -- a plain async function (not itself a Server Action) so a
// Server Component can call it directly for the initial render, while
// src/app/search/actions.ts wraps it for client-side calls.
export async function runSiteSearch(rawQuery: string): Promise<SiteSearchResults> {
  const parsed = searchQuerySchema.safeParse(rawQuery);
  if (!parsed.success) return EMPTY_RESULTS;
  const query = parsed.data;

  const titleMatches = search(query, 8);
  const bodyMatches = bodyMatchesToEntries(query, 6);
  const matches = dedupeByHref([...titleMatches, ...bodyMatches]).slice(0, 8);

  if (matches.length > 0 || query.length < MIN_QUERY_LENGTH_FOR_AI_FALLBACK) {
    return { matches, aiSuggestions: [] };
  }

  return { matches, aiSuggestions: await fetchAiFallback(query) };
}
