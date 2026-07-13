"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { SearchEntry } from "@/lib/search-index";
import { useSiteSearch } from "@/lib/search/use-site-search";
import type { SiteSearchResults } from "@/lib/search/run-search";

type SiteSearchBoxProps = {
  // "header": a persistent, fixed-width input with a portaled dropdown --
  // used in both the desktop bar and the always-visible mobile search row
  // (never hidden behind the hamburger). "page": a full-width input on
  // /search with results rendered inline below it, no dropdown.
  variant: "header" | "page";
  initialQuery?: string;
  initialResults?: SiteSearchResults | null;
  onNavigate?: () => void;
};

type Rect = { top: number; left: number; width: number };

const URL_SYNC_DEBOUNCE_MS = 350;

export function SiteSearchBox({ variant, initialQuery = "", initialResults = null, onNavigate }: SiteSearchBoxProps) {
  const router = useRouter();
  const { query, setQuery, matches, aiSuggestions } = useSiteSearch(initialQuery, initialResults);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lastQuery, setLastQuery] = useState(query);
  const [rect, setRect] = useState<Rect | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = query.trim();
  const hasQuery = trimmed.length > 0;
  const totalResults = matches.length + aiSuggestions.length;
  // "View all results" is its own selectable row, one past the real
  // results, whenever there's a query to send to /search at all.
  const rowCount = totalResults + (hasQuery ? 1 : 0);

  // React's documented "adjust state during render" pattern, used twice
  // here for two distinct resets that a single effect can't cleanly cover:
  // a brand-new query should always jump selection back to the top result,
  // while the debounced server enhancement can shrink the row count later
  // (same query, fewer/more rows) without the query itself changing --
  // that needs its own out-of-bounds clamp. Both are guarded conditions
  // that go false the render after they fire, so neither loops.
  if (query !== lastQuery) {
    setLastQuery(query);
    setSelectedIndex(0);
  }
  if (rowCount > 0 && selectedIndex > rowCount - 1) {
    setSelectedIndex(rowCount - 1);
  }

  const showDropdown = variant === "header" && isOpen;

  function updatePosition() {
    if (!wrapperRef.current) return;
    const box = wrapperRef.current.getBoundingClientRect();
    setRect({ top: box.bottom + 8, left: box.left, width: box.width });
  }

  function handleChange(value: string) {
    setQuery(value);
    if (variant === "header") return;

    if (urlSyncTimer.current) clearTimeout(urlSyncTimer.current);
    urlSyncTimer.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (value.trim()) params.set("q", value.trim());
      const target = params.toString() ? `/search?${params}` : "/search";
      router.replace(target, { scroll: false });
    }, URL_SYNC_DEBOUNCE_MS);
  }

  function goToEntry(entry: SearchEntry) {
    setIsOpen(false);
    onNavigate?.();
    router.push(entry.href);
  }

  function goToAllResults() {
    setIsOpen(false);
    onNavigate?.();
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function activateRow(index: number) {
    if (index < matches.length) {
      goToEntry(matches[index]);
    } else if (index < totalResults) {
      goToEntry(aiSuggestions[index - matches.length]);
    } else {
      goToAllResults();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (variant === "page") return;

    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setSelectedIndex((i) => Math.min(i + 1, Math.max(rowCount - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (rowCount > 0) activateRow(selectedIndex);
    }
  }

  // Positions the portaled dropdown under the input and keeps it there --
  // fixed positioning against the input's own viewport-relative rect, so a
  // resize (rotating a phone, resizing a window) or a scroll while the
  // dropdown is open both stay in sync without re-deriving sticky-header
  // math by hand.
  useEffect(() => {
    if (!showDropdown) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showDropdown]);

  useEffect(() => {
    if (!showDropdown) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showDropdown]);

  const inputHeightClass = "h-11";
  const inputSizingClass =
    variant === "header" ? "min-w-[27ch] max-w-[600px]" : "w-full";

  const inputEl = (
    <div ref={wrapperRef} className={`relative w-full ${variant === "header" ? inputSizingClass : ""}`}>
      <svg
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
        <path d="M17 17L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        data-site-search-input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => variant === "header" && setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search articles, workouts, tools..."
        aria-label="Search the Haarchive"
        autoComplete="off"
        className={`${inputHeightClass} w-full rounded-full border border-black/10 bg-black/[0.03] py-2 pl-10 pr-10 text-sm text-zinc-900 transition placeholder:text-zinc-500 focus:border-black/20 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-zinc-400 dark:focus:border-white/20 dark:focus:bg-zinc-900`}
      />
      {hasQuery ? (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
            if (variant === "page") router.replace("/search", { scroll: false });
          }}
          aria-label="Clear search"
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 transition hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      ) : (
        variant === "header" && (
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-black/10 px-1.5 py-0.5 font-sans text-xs text-zinc-400 sm:block dark:border-white/10 dark:text-zinc-500">
            ⌘K
          </kbd>
        )
      )}
    </div>
  );

  if (variant === "page") {
    return (
      <div className="w-full">
        {inputEl}
        <SearchResultsList
          hasQuery={hasQuery}
          matches={matches}
          aiSuggestions={aiSuggestions}
          selectedIndex={-1}
          onSelect={goToEntry}
          layout="page"
        />
      </div>
    );
  }

  return (
    <>
      {inputEl}
      {showDropdown &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width }}
            className="z-[var(--z-dropdown)] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-dropdown dark:border-white/10 dark:bg-zinc-900"
          >
            <div className="max-h-96 overflow-y-auto p-2">
              {!hasQuery ? (
                <p className="px-3 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  Search articles, tools, and topics across the site.
                </p>
              ) : (
                <SearchResultsList
                  hasQuery={hasQuery}
                  matches={matches}
                  aiSuggestions={aiSuggestions}
                  selectedIndex={selectedIndex}
                  onSelect={goToEntry}
                  onHover={setSelectedIndex}
                  layout="dropdown"
                />
              )}
            </div>
            {hasQuery && (
              <button
                type="button"
                onClick={goToAllResults}
                onMouseEnter={() => setSelectedIndex(rowCount - 1)}
                className={`block w-full border-t border-black/10 px-4 py-2.5 text-left text-sm font-medium transition dark:border-white/10 ${
                  selectedIndex === rowCount - 1
                    ? "bg-black/5 text-zinc-900 dark:bg-white/10 dark:text-white"
                    : "text-zinc-600 dark:text-zinc-300"
                }`}
              >
                View all results for &ldquo;{trimmed}&rdquo;
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

type SearchResultsListProps = {
  hasQuery: boolean;
  matches: SearchEntry[];
  aiSuggestions: SearchEntry[];
  selectedIndex: number;
  onSelect: (entry: SearchEntry) => void;
  onHover?: (index: number) => void;
  layout: "dropdown" | "page";
};

function SearchResultsList({ hasQuery, matches, aiSuggestions, selectedIndex, onSelect, onHover, layout }: SearchResultsListProps) {
  if (!hasQuery) return null;

  if (matches.length === 0 && aiSuggestions.length === 0) {
    return (
      <div className={layout === "page" ? "px-1 py-10 text-center" : "px-3 py-6 text-center"}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No results.</p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Not covered yet?{" "}
          <Link
            href="/questions/ask"
            className="font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
          >
            Ask a question
          </Link>{" "}
          or suggest a topic.
        </p>
      </div>
    );
  }

  const listClass = layout === "page" ? "mt-8 divide-y divide-black/5 dark:divide-white/10" : "";

  return (
    <div className={listClass}>
      {matches.length > 0 && (
        <SearchGroup
          entries={matches}
          startIndex={0}
          selectedIndex={selectedIndex}
          onSelect={onSelect}
          onHover={onHover}
          layout={layout}
        />
      )}
      {aiSuggestions.length > 0 && (
        <div className={layout === "page" ? "pt-6" : "mt-1 border-t border-black/10 pt-1 dark:border-white/10"}>
          <p className="px-3 py-1.5 text-xs font-medium tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
            You might mean
          </p>
          <SearchGroup
            entries={aiSuggestions}
            startIndex={matches.length}
            selectedIndex={selectedIndex}
            onSelect={onSelect}
            onHover={onHover}
            layout={layout}
          />
        </div>
      )}
    </div>
  );
}

type SearchGroupProps = {
  entries: SearchEntry[];
  startIndex: number;
  selectedIndex: number;
  onSelect: (entry: SearchEntry) => void;
  onHover?: (index: number) => void;
  layout: "dropdown" | "page";
};

function SearchGroup({ entries, startIndex, selectedIndex, onSelect, onHover, layout }: SearchGroupProps) {
  return (
    <ul>
      {entries.map((entry, i) => {
        const rowIndex = startIndex + i;
        const highlighted = layout === "dropdown" && rowIndex === selectedIndex;
        return (
          <li key={entry.href + entry.title}>
            <button
              type="button"
              onClick={() => onSelect(entry)}
              onMouseEnter={() => onHover?.(rowIndex)}
              className={`block w-full rounded-lg px-3 py-2.5 text-left transition ${
                highlighted ? "bg-black/5 dark:bg-white/10" : ""
              } ${layout === "page" ? "hover:bg-black/5 dark:hover:bg-white/5" : ""}`}
            >
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                {entry.title}
                <span className="ml-2 font-normal text-zinc-400 dark:text-zinc-500">{entry.group}</span>
              </p>
              <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{entry.subtitle}</p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
