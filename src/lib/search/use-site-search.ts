"use client";

import { useMemo, useRef, useState } from "react";

import { searchAction } from "@/app/search/actions";
import { search, type SearchEntry } from "@/lib/search-index";
import type { SiteSearchResults } from "@/lib/search/run-search";

const DEBOUNCE_MS = 350;
// Below this length the local title/heading index is already fast and
// precise -- an exact match is either right there or it isn't -- so the
// richer round trip (body-text retrieval, plus a possible AI fallback) is
// skipped rather than firing on every single early keystroke.
const MIN_LENGTH_FOR_SERVER_ENHANCEMENT = 3;

// Debounced by hand in the change handler (not a useEffect) so every setState
// call here happens either directly in an event handler or inside an async
// .then()/.finally() callback -- never synchronously in an effect body,
// which is what previously tripped this repo's react-hooks/set-state-in-effect
// rule in this same search feature.
export function useSiteSearch(initialQuery = "", initialResults: SiteSearchResults | null = null) {
  const [query, setQueryState] = useState(initialQuery);
  const [enhanced, setEnhanced] = useState<SiteSearchResults | null>(initialResults);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  const localMatches = useMemo(() => search(query), [query]);

  function setQuery(next: string) {
    setQueryState(next);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    requestId.current += 1;

    const trimmed = next.trim();
    if (trimmed.length < MIN_LENGTH_FOR_SERVER_ENHANCEMENT) {
      setEnhanced(null);
      setIsEnhancing(false);
      return;
    }

    setIsEnhancing(true);
    const thisRequest = requestId.current;
    debounceTimer.current = setTimeout(() => {
      searchAction(trimmed)
        .then((result) => {
          // Guards against a slower, earlier request resolving after a
          // faster, later one and clobbering it with stale results.
          if (requestId.current === thisRequest) setEnhanced(result);
        })
        .catch(() => {
          if (requestId.current === thisRequest) setEnhanced(null);
        })
        .finally(() => {
          if (requestId.current === thisRequest) setIsEnhancing(false);
        });
    }, DEBOUNCE_MS);
  }

  const matches: SearchEntry[] = enhanced?.matches ?? localMatches;
  const aiSuggestions: SearchEntry[] = enhanced?.aiSuggestions ?? [];

  return { query, setQuery, matches, aiSuggestions, isEnhancing };
}
