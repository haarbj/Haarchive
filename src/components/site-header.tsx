"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { categories, sectionsInCategory } from "@/lib/sections";
import { AuthStatus } from "@/components/auth-status";
import { BugReportTrigger } from "@/components/bug-report/bug-report-trigger";
import { NotificationBell } from "@/components/notification-bell";
import { SiteSearchBox } from "@/components/site-search";

// Every category except Tools lives inside the "Learn" mega menu -- Tools
// gets its own top-level link because calculators are a different kind of
// visit (a quick utility, not reading) that people want one click away, the
// same way Stripe splits "Docs" from "API Reference". This is also the
// scalability answer: a 7th, 8th, 20th category is one more block in the
// menu below, never a new top-level nav item.
const TOOLS_SLUG = "tools";
const learnCategories = categories.filter((category) => category.slug !== TOOLS_SLUG);

function isLearnPath(pathname: string): boolean {
  if (pathname === "/") return false;
  return learnCategories.some(
    (category) =>
      pathname === `/${category.slug}` ||
      sectionsInCategory(category.slug).some((member) => pathname === `/${member.slug}`),
  );
}

function isToolsPath(pathname: string): boolean {
  return pathname === `/${TOOLS_SLUG}` || sectionsInCategory(TOOLS_SLUG).some((member) => pathname === `/${member.slug}`);
}

const topLevelLinkClass =
  "rounded-full px-3 py-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white";
const topLevelActiveClass = "text-zinc-950 dark:text-white";

export function SiteHeader() {
  const pathname = usePathname();
  const [learnOpen, setLearnOpen] = useState(false);
  const [activeCategorySlug, setActiveCategorySlug] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileLearnOpen, setMobileLearnOpen] = useState(false);
  // Drives the collapsible search row at *every* breakpoint now, not just
  // mobile -- desktop used to show an always-visible search bar inline in
  // the header; it's now the same collapsed-icon-until-clicked row mobile
  // already had, just no longer md:hidden. Kept the name generic (not
  // "mobileSearchOpen") since it's no longer mobile-specific.
  const [searchOpen, setSearchOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRowRef = useRef<HTMLDivElement>(null);
  const mobileSearchButtonRef = useRef<HTMLButtonElement>(null);

  // Global so ⌘K/Ctrl+K jumps to search from anywhere on the site, not just
  // while the header itself has focus -- preventDefault stops the browser's
  // own Ctrl+K (Firefox's address-bar search) from firing alongside it.
  // Reads `searchOpen` directly (a real dependency of this effect, so the
  // closure always has the current value) rather than probing the DOM for
  // "is an input already visible" the way this used to: offsetParent is
  // null for display:none, but does *not* go null for an element merely
  // clipped by an ancestor's overflow:hidden/max-height:0 (the row's own
  // collapse mechanism) -- so that check was always true regardless of
  // whether the row was actually open, meaning Cmd+K never opened a
  // collapsed row, it just silently called .focus() on an input inside an
  // inert ancestor, which the HTML spec makes a no-op. React state is the
  // real source of truth here; the DOM shouldn't have needed reverse-
  // engineering in the first place. Escape lives in this same listener
  // (not a second one) purely so it can share the one existing global
  // keydown subscription rather than adding another; it only acts when the
  // row is actually open, and doesn't touch the *input's own* Escape
  // handling in site-search.tsx (closing its dropdown + blurring), which
  // fires independently and is left completely alone.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (searchOpen) {
          document.querySelector<HTMLInputElement>("[data-site-search-input]")?.focus();
        } else {
          setSearchOpen(true);
        }
        return;
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    document.querySelector<HTMLInputElement>("[data-site-search-input]")?.focus();
  }, [searchOpen]);

  // Click-outside collapse -- exempts the toggle buttons themselves (a
  // mousedown on one would otherwise register as "outside" a split second
  // before its own onClick re-opens it, fighting the toggle) and the
  // portaled results panel (site-search.tsx's dropdown lives outside this
  // row's own DOM subtree via createPortal, so a plain .contains() check
  // would treat clicking a real search result as "outside" and collapse
  // the row out from under the click).
  useEffect(() => {
    if (!searchOpen) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (searchRowRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-search-toggle]")) return;
      if (target instanceof Element && target.closest("[data-search-results-panel]")) return;
      setSearchOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [searchOpen]);

  const openLearn = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setLearnOpen(true);
  };

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => {
      setLearnOpen(false);
      setActiveCategorySlug(null);
    }, 150);
  };

  const closeAll = () => {
    setLearnOpen(false);
    setActiveCategorySlug(null);
    setMobileOpen(false);
    setMobileLearnOpen(false);
    setSearchOpen(false);
  };

  const learnActive = isLearnPath(pathname);
  const toolsActive = isToolsPath(pathname);
  const currentCategorySlug = learnCategories.find(
    (category) =>
      pathname === `/${category.slug}` ||
      sectionsInCategory(category.slug).some((member) => pathname === `/${member.slug}`),
  )?.slug;
  // Which category's sections the flyout pane shows: whatever's hovered/
  // focused right now, falling back to the category the visitor is
  // currently reading, falling back to the first category so the pane is
  // never blank the instant the menu opens.
  const displayedCategorySlug = activeCategorySlug ?? currentCategorySlug ?? learnCategories[0]?.slug;
  const displayedCategory = learnCategories.find((category) => category.slug === displayedCategorySlug);
  // /search already has its own full-width search input with results inline
  // below it -- the header's copy (mobile row + desktop bar) would just be
  // a second, visually-identical input stacked right above it.
  const isSearchPage = pathname === "/search";

  return (
    <header
      className={`border-b border-black/5 dark:border-white/10 md:sticky md:inset-auto md:z-[var(--z-header)] md:flex-none md:overflow-visible md:bg-white/90 md:backdrop-blur md:dark:bg-zinc-950/90 ${
        mobileOpen
          ? "fixed inset-0 z-[var(--z-modal)] flex flex-col overflow-y-auto bg-white dark:bg-zinc-950"
          : "sticky top-0 z-[var(--z-header)] bg-white/90 backdrop-blur dark:bg-zinc-950/90"
      }`}
    >
      <div className="mx-auto flex w-full max-w-chrome shrink-0 items-center justify-between px-6 py-4">
        {/* Logo and primary nav cluster together on the left -- with only
            two real destinations (Learn, Tools) plus the account menu,
            stretching them to opposite ends of the bar (the old layout)
            left a huge dead gap in the middle. Grouped and left-aligned
            reads as calm the way GitHub/Linear's headers do; spread out it
            just reads as empty. max-w-chrome now equals max-w-content
            (see globals.css), so the default px-6 padding alone lines the
            logo up with the page content below -- no extra offset needed. */}
        <div className="flex items-center gap-10">
          <Link className="text-sm font-semibold tracking-wide uppercase" href="/" onClick={closeAll}>
            The Haarchive
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            <div className="relative" onMouseEnter={openLearn} onMouseLeave={scheduleClose}>
              <button
                type="button"
                aria-expanded={learnOpen}
                aria-haspopup="true"
                onClick={() => setLearnOpen((v) => !v)}
                className={`flex items-center gap-1 ${topLevelLinkClass} ${learnActive ? topLevelActiveClass : ""}`}
              >
                Learn
                <svg
                  className={`h-3.5 w-3.5 transition-transform ${learnOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M5 7.5L10 12.5L15 7.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <div
                className={`absolute left-0 top-full pt-3 transition-[max-height,opacity] duration-200 ${
                  learnOpen ? "max-h-[40rem] opacity-100" : "pointer-events-none max-h-0 overflow-hidden opacity-0"
                }`}
              >
                {/* Two-pane hover flyout, not a flat list of every category's
                    every section at once: the left pane is just the 7
                    category names (fixed height regardless of how many
                    categories exist -- a 9th or 20th is one more row, not
                    more width), and hovering/focusing one swaps the right
                    pane to that category's own sections. This is what
                    replaced the old single-panel version, which had to fit
                    every category's full section list simultaneously and
                    kept needing rebalancing (columns, width, height) as
                    titles got longer -- a category's section count no
                    longer affects the *left* pane's size at all, and the
                    right pane only ever holds one category's worth of rows
                    (at most 8 today), which is why it doesn't need the
                    scroll/height gymnastics the old version did. */}
                <div className="flex overflow-hidden rounded-2xl border border-black/10 bg-white shadow-dropdown dark:border-white/10 dark:bg-zinc-900">
                  <div className="w-56 shrink-0 space-y-0.5 border-r border-black/10 p-3 dark:border-white/10">
                    {learnCategories.map((category) => {
                      const isDisplayed = category.slug === displayedCategorySlug;
                      return (
                        <Link
                          key={category.slug}
                          href={`/${category.slug}`}
                          onClick={closeAll}
                          onMouseEnter={() => setActiveCategorySlug(category.slug)}
                          onFocus={() => setActiveCategorySlug(category.slug)}
                          className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                            isDisplayed
                              ? "bg-black/5 text-zinc-950 dark:bg-white/10 dark:text-white"
                              : "text-zinc-700 hover:bg-black/5 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
                          }`}
                        >
                          {category.title}
                          <svg className="h-3.5 w-3.5 shrink-0 opacity-50" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                            <path
                              d="M7.5 5L12.5 10L7.5 15"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </Link>
                      );
                    })}
                  </div>

                  <div className="w-64 shrink-0 p-3">
                    {displayedCategory && (
                      <ul className="space-y-0.5">
                        {sectionsInCategory(displayedCategory.slug).map((member) => (
                          <li key={member.slug}>
                            <Link
                              href={`/${member.slug}`}
                              onClick={closeAll}
                              className="block rounded-lg px-3 py-2 text-sm text-zinc-500 transition hover:bg-black/5 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
                            >
                              {member.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Link
              href={`/${TOOLS_SLUG}`}
              onClick={closeAll}
              aria-current={toolsActive ? "page" : undefined}
              className={`${topLevelLinkClass} ${toolsActive ? topLevelActiveClass : ""}`}
            >
              Tools
            </Link>
          </nav>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {/* Search collapses to a plain icon at every breakpoint now (see
              the row below the header bar) -- this replaced an
              always-visible flex-1 input that used to sit here, between the
              left nav cluster and this icon group. Skipped entirely on
              /search, which already has its own full-width input with
              results inline below it. */}
          {!isSearchPage && (
            // No tooltip -- a magnifying glass is self-explanatory, and the
            // expanded row's own placeholder ("Search articles, workouts,
            // tools...") already explains it a beat later; a hover label on
            // top of both was redundant.
            <button
              type="button"
              data-search-toggle
              aria-label={searchOpen ? "Close search" : "Search"}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((v) => !v)}
              className="flex h-12 w-12 items-center justify-center rounded-full text-zinc-500 transition hover:bg-black/5 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M17 17L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <BugReportTrigger variant="icon" />
          <Link
            href="/questions"
            onClick={closeAll}
            aria-label="Questions and feedback"
            title="Questions and feedback"
            className="flex h-12 w-12 items-center justify-center rounded-full text-zinc-500 transition hover:bg-black/5 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <svg className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M10 2.5c-4.14 0-7.5 2.91-7.5 6.5 0 1.79.85 3.41 2.23 4.59-.14.9-.49 1.94-1.15 2.91-.1.15.02.36.2.33 1.35-.19 2.68-.75 3.68-1.36.79.2 1.63.28 2.54.28 4.14 0 7.5-2.91 7.5-6.5s-3.36-6.75-7.5-6.75Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <NotificationBell />
          <AuthStatus />
        </div>

        {/* Mobile search toggle + hamburger, grouped -- search used to be a
            permanently-visible row under the header on every mobile page,
            which ate a full row of vertical space whether or not a visitor
            wanted it ("gets in the way too much" on small screens). It's
            still one tap away, never buried inside the hamburger menu
            itself, just collapsed to an icon until tapped. Opening either
            one closes the other -- they'd otherwise fight for the same
            space right under the header. */}
        <div className="flex items-center gap-1 md:hidden">
          {!isSearchPage && (
            <button
              ref={mobileSearchButtonRef}
              type="button"
              data-search-toggle
              aria-label={searchOpen ? "Close search" : "Open search"}
              aria-expanded={searchOpen}
              onClick={() => {
                setSearchOpen((v) => !v);
                setMobileOpen(false);
              }}
              className="flex h-12 w-12 items-center justify-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10"
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M17 17L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}

          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => {
              setMobileOpen((v) => !v);
              setSearchOpen(false);
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10"
          >
            <span className="relative block h-4 w-5">
              <span
                className={`absolute left-0 top-0 h-0.5 w-5 bg-current transition ${mobileOpen ? "translate-y-[7px] rotate-45" : ""}`}
              />
              <span
                className={`absolute left-0 top-[7px] h-0.5 w-5 bg-current transition ${mobileOpen ? "opacity-0" : ""}`}
              />
              <span
                className={`absolute left-0 top-[14px] h-0.5 w-5 bg-current transition ${mobileOpen ? "-translate-y-[7px] -rotate-45" : ""}`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* The collapsible search row -- a real extension of the header, not
          a modal or a floating popup: an ordinary bordered row in normal
          document flow, directly below the header bar, animated open with
          the same max-height transition technique the Learn submenu below
          already uses (kept consistent rather than introducing a second
          animation approach). Always mounted (not conditionally rendered)
          so the max-height transition has something to animate between --
          `inert` is what actually keeps it non-interactive and out of the
          tab order while collapsed (same technique drawer.tsx already uses
          for its own closed-but-mounted state), which a plain max-h-0 +
          overflow-hidden alone would *not* guarantee: a hidden-but-tabbable
          input reachable by Tab would be a real, and easy to miss,
          keyboard regression. Skipped on /search -- see isSearchPage. */}
      {!isSearchPage && (
        <div
          ref={searchRowRef}
          data-search-row
          inert={!searchOpen}
          className={`overflow-hidden border-t border-black/5 transition-[max-height] duration-200 motion-reduce:transition-none dark:border-white/10 ${
            searchOpen ? "max-h-24" : "max-h-0"
          }`}
        >
          {/* mx-auto max-w-chrome matches the top bar's own alignment
              container (see the logo/nav row above) -- without it the row
              spans the full viewport edge-to-edge (it's a direct child of
              <header>, not nested inside that same alignment wrapper), so
              centering the search box within *that* on a wide viewport
              would center it across the whole window rather than within
              the page's actual content width. */}
          <div className="mx-auto flex w-full max-w-chrome justify-center px-6 py-3">
            <SiteSearchBox variant="header" onNavigate={closeAll} forceClose={!searchOpen} />
          </div>
        </div>
      )}

      {/* Mobile menu -- a true full-viewport panel now (the header itself
          becomes `fixed inset-0` above when mobileOpen), not an inline
          accordion that just pushed the rest of the page down and left it
          visible/scrollable right underneath. flex-1 + overflow-y-auto
          fills and scrolls exactly the remaining space below the chrome
          and search rows; hidden outright when closed, rather than
          max-h-0'd, since there's no longer a height transition to animate
          it through. */}
      <div className={`min-h-0 border-t border-black/5 md:hidden dark:border-white/10 ${mobileOpen ? "flex-1 overflow-y-auto" : "hidden"}`}>
        <div className="px-6 py-4">
          <div className="border-b border-black/5 dark:border-white/10">
            <div className="flex items-center justify-between py-3">
              <span className={`text-sm font-medium ${learnActive ? "text-zinc-950 dark:text-white" : "text-zinc-900 dark:text-white"}`}>
                Learn
              </span>
              <button
                type="button"
                aria-expanded={mobileLearnOpen}
                aria-label="Toggle Learn submenu"
                onClick={() => setMobileLearnOpen((v) => !v)}
                className="p-1"
              >
                <svg
                  className={`h-4 w-4 transition-transform ${mobileLearnOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M5 7.5L10 12.5L15 7.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            {/* Category names only -- not every section under every
                category too. That used to make this the exact "expose
                nearly every subsection" problem: tapping Learn once dumped
                the entire site map (~40 links) in one flat list. Each
                category's own landing page (/foundations, /the-science, …)
                already lists its sections cleanly -- that page *is* the
                drill-down step, so the nav doesn't need to reproduce it. */}
            <div
              className={`overflow-hidden transition-[max-height] duration-200 ${
                mobileLearnOpen ? "max-h-[28rem]" : "max-h-0"
              }`}
            >
              <div className="flex flex-col pb-2">
                {learnCategories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/${category.slug}`}
                    onClick={closeAll}
                    className="rounded-lg px-2 py-3 text-sm font-medium text-zinc-700 transition hover:bg-black/5 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    {category.title}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="border-b border-black/5 py-3 dark:border-white/10">
            <Link
              href={`/${TOOLS_SLUG}`}
              onClick={closeAll}
              aria-current={toolsActive ? "page" : undefined}
              className={`text-sm font-medium ${
                toolsActive ? "text-zinc-950 underline dark:text-white" : "text-zinc-900 dark:text-white"
              }`}
            >
              Tools
            </Link>
          </div>

          <div className="border-b border-black/5 py-3 dark:border-white/10">
            <Link
              href="/questions"
              onClick={closeAll}
              className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white"
            >
              <svg className="h-4 w-4 shrink-0 text-zinc-400" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M10 2.5c-4.14 0-7.5 2.91-7.5 6.5 0 1.79.85 3.41 2.23 4.59-.14.9-.49 1.94-1.15 2.91-.1.15.02.36.2.33 1.35-.19 2.68-.75 3.68-1.36.79.2 1.63.28 2.54.28 4.14 0 7.5-2.91 7.5-6.5s-3.36-6.75-7.5-6.75Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Questions
            </Link>
          </div>

          <div className="flex items-center gap-1 border-b border-black/5 py-3 dark:border-white/10">
            <NotificationBell />
            <BugReportTrigger variant="icon" />
          </div>

          <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
            <AuthStatus
              onNavigate={closeAll}
              className="inline-flex rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
