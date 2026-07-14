"use client";

import { useEffect, useRef } from "react";

import { geocodeLabel } from "@/lib/geocode";
import type { LocationSearch } from "@/lib/use-location-search";

type LocationSearchFieldProps = {
  search: LocationSearch;
  placeholder?: string;
  message?: string;
};

// Presentational half of useLocationSearch -- the accessible combobox
// (debounced suggestions, keyboard nav, "Look up"/"Use my location"
// buttons) shared by heat-tracker, wind-calculator, and
// track-wind-calculator instead of each hand-rolling the same markup.
export function LocationSearchField({
  search,
  placeholder = "Enter a city, e.g. Phoenix, AZ",
  message,
}: LocationSearchFieldProps) {
  // Owned here (not inside useLocationSearch) so the hook's returned state
  // bag never mixes a ref in with its plain reactive values -- keeps every
  // `search.<field>` access below unambiguous during render.
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!search.showSuggestions) return;
    function handleClickOutside(event: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        search.setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.showSuggestions]);

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void search.handleSearch();
        }}
        className="flex flex-wrap gap-2"
      >
        <div ref={searchBoxRef} className="relative min-w-[180px] flex-1">
          <input
            type="text"
            value={search.cityInput}
            onChange={(event) => search.setCityInput(event.target.value)}
            onKeyDown={search.handleInputKeyDown}
            onFocus={() => search.setShowSuggestions(search.suggestions.length > 0)}
            placeholder={placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={search.showSuggestions}
            aria-autocomplete="list"
            aria-controls={search.listboxId}
            aria-activedescendant={
              search.highlightedIndex >= 0 ? `${search.listboxId}-option-${search.highlightedIndex}` : undefined
            }
            className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-base text-zinc-900 transition focus:ring-2 focus:ring-zinc-900 focus:outline-none dark:border-white/10 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
          />
          {(search.suggestionsLoading || search.showSuggestions) && (
            <div
              id={search.listboxId}
              role="listbox"
              className="absolute left-0 top-full z-[var(--z-dropdown)] mt-1 w-full overflow-hidden rounded-lg border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-900"
            >
              {search.suggestionsLoading ? (
                <p className="px-4 py-2.5 text-sm text-zinc-500 dark:text-zinc-400">Searching…</p>
              ) : search.suggestions.length > 0 ? (
                search.suggestions.map((result, index) => (
                  <button
                    key={result.id}
                    id={`${search.listboxId}-option-${index}`}
                    role="option"
                    aria-selected={index === search.highlightedIndex}
                    type="button"
                    onClick={() => search.selectSuggestion(result)}
                    onMouseEnter={() => search.setHighlightedIndex(index)}
                    className={`block w-full px-4 py-2 text-left text-sm ${
                      index === search.highlightedIndex
                        ? "bg-black/5 text-zinc-950 dark:bg-white/10 dark:text-white"
                        : "text-zinc-700 dark:text-zinc-200"
                    }`}
                  >
                    {geocodeLabel(result)}
                  </button>
                ))
              ) : (
                <p className="px-4 py-2.5 text-sm text-zinc-500 dark:text-zinc-400">No matches found</p>
              )}
            </div>
          )}
        </div>
        <button
          type="submit"
          className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Look up
        </button>
        <button
          type="button"
          onClick={search.attemptGeolocation}
          className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-black/5 dark:border-white/20 dark:text-zinc-200 dark:hover:bg-white/10"
        >
          Use my location
        </button>
      </form>
      {message !== undefined && (
        <p className="mt-2 min-h-[1.25rem] text-xs text-zinc-600 dark:text-zinc-300">{message}</p>
      )}
    </div>
  );
}
