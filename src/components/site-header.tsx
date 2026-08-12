"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { categories, sectionsInCategory } from "@/lib/sections";
import { AuthStatus } from "@/components/auth-status";
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global so ⌘K/Ctrl+K jumps to search from anywhere on the site, not just
  // while the header itself has focus -- preventDefault stops the browser's
  // own Ctrl+K (Firefox's address-bar search) from firing alongside it.
  // Queries every mounted search input and focuses whichever one actually
  // has layout (offsetParent is null for anything the current breakpoint,
  // or the mobile search toggle, currently hides). If none are visible --
  // mobile with the search row collapsed -- open it instead; the focus
  // effect below picks it up once it's actually mounted.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) return;
      e.preventDefault();
      const inputs = document.querySelectorAll<HTMLInputElement>("[data-site-search-input]");
      for (const input of inputs) {
        if (input.offsetParent !== null) {
          input.focus();
          return;
        }
      }
      setMobileSearchOpen(true);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!mobileSearchOpen) return;
    const inputs = document.querySelectorAll<HTMLInputElement>("[data-site-search-input]");
    for (const input of inputs) {
      if (input.offsetParent !== null) {
        input.focus();
        break;
      }
    }
  }, [mobileSearchOpen]);

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
    setMobileSearchOpen(false);
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

        {/* flex-1 lets this slot absorb all the space between the left
            cluster and the account menu -- justify-between on the outer
            row then has nothing left to redistribute, so this sits exactly
            in the gap that used to just be empty. Hidden on mobile, where
            there's no comparable spare width -- search there is a toggled
            icon instead (see the mobile search button + row below).
            Skipped entirely on /search, which already has its own
            full-width input with results inline below it -- this one would
            just be a second, visually-identical box stacked above it. */}
        {!isSearchPage && (
          <div className="hidden flex-1 justify-center px-6 md:flex">
            <SiteSearchBox variant="header" onNavigate={closeAll} />
          </div>
        )}

        <div className="hidden items-center gap-3 md:flex">
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
              type="button"
              aria-label={mobileSearchOpen ? "Close search" : "Open search"}
              aria-expanded={mobileSearchOpen}
              onClick={() => {
                setMobileSearchOpen((v) => !v);
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
              setMobileSearchOpen(false);
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

      {/* Toggled, not persistent -- see the mobile search button above.
          shrink-0 keeps it at its natural height if the header becomes a
          fixed, full-viewport flex column below (mobileOpen branch above),
          though in practice the two states are kept mutually exclusive.
          Skipped on /search -- see the isSearchPage comment above. */}
      {!isSearchPage && mobileSearchOpen && (
        <div className="shrink-0 border-t border-black/5 px-6 py-3 md:hidden dark:border-white/10">
          <SiteSearchBox variant="header" onNavigate={closeAll} />
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

          <div className="border-b border-black/5 py-3 dark:border-white/10">
            <NotificationBell />
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
