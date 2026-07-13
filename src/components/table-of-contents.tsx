"use client";

import { useEffect, useMemo, useState } from "react";

export type TocHeading = { id: string; text: string; level: 2 | 3 };

export function TableOfContents({ headings }: { headings: TocHeading[] }) {
  const [activeId, setActiveId] = useState<string | null>(headings[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) =>
          a.boundingClientRect.top < b.boundingClientRect.top ? a : b,
        );
        setActiveId(topMost.target.id);
      },
      // Fires when a heading crosses roughly the top third of the viewport,
      // clear of the sticky header, so "active" tracks what's actually
      // being read rather than what's merely visible somewhere on screen.
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return headings;
    return headings.filter((heading) => heading.text.toLowerCase().includes(q));
  }, [headings, query]);

  if (headings.length === 0) return null;

  const linkClass = (heading: TocHeading) =>
    [
      "block rounded-md px-3 py-1.5 text-sm transition",
      heading.level === 3 ? "ml-3 border-l border-black/10 pl-3 dark:border-white/10" : "",
      activeId === heading.id
        ? "bg-black/5 font-semibold text-zinc-950 dark:bg-white/10 dark:text-white"
        : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white",
    ].join(" ");

  const headingList = (onNavigate?: () => void) => (
    <nav aria-label="Table of contents" className="flex flex-col gap-0.5">
      {filtered.map((heading) => (
        <a
          key={heading.id}
          href={`#${heading.id}`}
          onClick={onNavigate}
          aria-current={activeId === heading.id ? "location" : undefined}
          className={linkClass(heading)}
        >
          {heading.text}
        </a>
      ))}
      {filtered.length === 0 ? (
        <p className="px-3 py-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          No matching sections.
        </p>
      ) : null}
    </nav>
  );

  const searchInput = (
    <input
      type="search"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder="Search this page"
      aria-label="Search this page's table of contents"
      autoComplete="off"
      className="mb-3 w-full rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-white/10 dark:bg-zinc-900 dark:text-white"
    />
  );

  return (
    <>
      {/* Desktop: sticky sidebar. Lives inside the same grid row as the
          article, so `sticky` naturally stops at the article's bottom edge
          -- it never scrolls into the chapter nav or footer below. */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-8">
          <p className="px-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            On this page
          </p>
          <div className="mt-3">
            {searchInput}
            {headingList()}
          </div>
        </div>
      </aside>

      {/* Mobile/tablet: collapsible drawer above the article. `open` is
          controlled via state (not a ref) so closing on navigate is just a
          normal state update, not a render-time ref access. */}
      <details
        open={drawerOpen}
        onToggle={(event) => setDrawerOpen(event.currentTarget.open)}
        className="group mb-8 rounded-xl border border-black/10 bg-white lg:hidden dark:border-white/10 dark:bg-zinc-900"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-zinc-900 dark:text-white">
          On this page
          <svg
            className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180 dark:text-zinc-400"
            viewBox="0 0 20 20"
            fill="none"
          >
            <path
              d="M5 7.5L10 12.5L15 7.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </summary>
        <div className="border-t border-black/10 px-4 py-3 dark:border-white/10">
          {searchInput}
          {headingList(() => setDrawerOpen(false))}
        </div>
      </details>
    </>
  );
}
