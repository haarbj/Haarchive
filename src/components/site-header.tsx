"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { categories, sectionsInCategory } from "@/lib/sections";
import { AuthStatus } from "@/components/auth-status";
import { BugReportTrigger } from "@/components/bug-report/bug-report-trigger";
import { NotificationBell } from "@/components/notification-bell";
import { SiteSearchBox } from "@/components/site-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/lib/theme";

// Every category -- Physiology, Psychology, Philosophy, Practice, Library,
// Tools -- is its own top-level nav item now, each with its own hover
// dropdown of that category's real sections (see the four-domain IA
// migration in sections.ts: this only became viable once the taxonomy
// dropped from 8 unrelated categories to 6, see CLAUDE.md §9). Tools used
// to be split out as a plain link with no dropdown at all; it's now
// uniform with the other five.
const TOOLS_SLUG = "tools";
// Sections.length beyond this switches a category's dropdown from a single
// column to a two-column grid, so a category with many sections (Tools,
// Physiology, Practice) doesn't render one excessively tall list.
const TWO_COLUMN_THRESHOLD = 4;
// Mobile keeps its own pre-redesign "Learn" accordion (category names
// only, no per-category chevron/dropdown) -- this desktop-only change
// still needs the non-Tools category list for that mobile block.
const learnCategories = categories.filter((category) => category.slug !== TOOLS_SLUG);

function isCategoryActive(categorySlug: string, pathname: string): boolean {
  return (
    pathname === `/${categorySlug}` ||
    sectionsInCategory(categorySlug).some((member) => pathname === `/${member.slug}`)
  );
}

// px-1.5 (not px-3) -- 6 top-level items now, not 2 ("Learn" + "Tools"), so
// the per-item horizontal padding is tighter than a 2-item nav needed, to
// keep the whole row fitting alongside the logo and the right-hand icon
// cluster down to ~1024px viewport width (verified with Playwright at
// 1024/1152/1280/1440/1920 -- 1024px overflowed and wrapped "Sign in" onto
// two lines before this and the other gap reductions in this file).
const topLevelLinkClass =
  "rounded-full px-1.5 py-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white";
const topLevelActiveClass = "text-zinc-950 dark:text-white";

type HeaderScrollState = "top" | "visible" | "hidden";

// Publication-masthead scroll behavior: full-height at the top of the
// page, a slightly more compact sticky bar once scrolled, hidden entirely
// while actively scrolling down, and revealed again on any upward scroll --
// the same pattern most editorial sites use so the header stays out of the
// way while reading without ever losing sticky/keyboard access to nav.
// A dedicated hook (not inlined in the component) because the direction
// math genuinely needs its own explanation independent of everything else
// SiteHeader is already tracking (Learn/search/mobile state).
function useHeaderScrollState(forceVisible: boolean): HeaderScrollState {
  const [state, setState] = useState<HeaderScrollState>("top");
  // The scrollY of the last position a direction was actually *decided*
  // at, not the previous scroll event's position -- only updated when a
  // decision fires, so small back-and-forth jitter under the threshold
  // keeps accumulating against the same baseline instead of resetting on
  // every frame (which would make the threshold meaningless).
  const decisionY = useRef(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const TOP_THRESHOLD = 20;
    const DIRECTION_THRESHOLD = 12;

    let ticking = false;
    function handleScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const currentY = window.scrollY;

        if (currentY <= TOP_THRESHOLD) {
          decisionY.current = currentY;
          setState("top");
          return;
        }

        const delta = currentY - decisionY.current;
        if (delta > DIRECTION_THRESHOLD) {
          decisionY.current = currentY;
          // Reduced motion: never actually hide the header (it would be a
          // motion effect with no way to bring it back except scrolling
          // up), just keep it in its compact "visible" state throughout.
          setState(prefersReducedMotion ? "visible" : "hidden");
        } else if (delta < -DIRECTION_THRESHOLD) {
          decisionY.current = currentY;
          setState("visible");
        }
      });
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Keyboard focus landing anywhere in the header, or any of the header's
  // own menus/rows opening, must never leave a visitor interacting with an
  // off-screen-but-still-in-the-DOM control -- forces "visible" (never
  // "top", since scroll position hasn't changed) whenever that happens.
  if (forceVisible && state === "hidden") return "visible";
  return state;
}

export function SiteHeader() {
  const pathname = usePathname();
  // Which of the 6 categories' own dropdown is open, if any -- each
  // dropdown is permanently tied to its own category (no more "which
  // content does the shared panel show" question the old two-pane flyout
  // had, since there's no longer a shared panel).
  const [openCategorySlug, setOpenCategorySlug] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileLearnOpen, setMobileLearnOpen] = useState(false);
  // Drives the collapsible search row at *every* breakpoint now, not just
  // mobile -- desktop used to show an always-visible search bar inline in
  // the header; it's now the same collapsed-icon-until-clicked row mobile
  // already had, just no longer md:hidden. Kept the name generic (not
  // "mobileSearchOpen") since it's no longer mobile-specific.
  const [searchOpen, setSearchOpen] = useState(false);
  // Keyboard focus anywhere inside the header -- combined with
  // openCategorySlug/searchOpen/mobileOpen below to keep the header from
  // hiding out from under a keyboard user who tabbed into it without
  // opening any menu at all (e.g. tabbing straight to the logo or a nav
  // link).
  const [headerFocused, setHeaderFocused] = useState(false);
  const scrollState = useHeaderScrollState(headerFocused || openCategorySlug !== null || searchOpen || mobileOpen);
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

  const openCategory = (slug: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenCategorySlug(slug);
  };

  const scheduleClose = (slug: string) => {
    closeTimer.current = setTimeout(() => {
      // Guard: only clear if this trigger is still the open one -- moving
      // the cursor directly from one trigger to the next fires the new
      // one's onMouseEnter (setting openCategorySlug to the new slug)
      // before the old one's scheduled close fires; without the guard, the
      // stale close would wrongly null out the newly-opened dropdown.
      setOpenCategorySlug((current) => (current === slug ? null : current));
    }, 150);
  };

  const closeAll = () => {
    setOpenCategorySlug(null);
    setMobileOpen(false);
    setMobileLearnOpen(false);
    setSearchOpen(false);
  };

  const toolsActive = isCategoryActive(TOOLS_SLUG, pathname);
  // Mobile-only: whether any non-Tools category (or one of its sections) is
  // the current page, for the mobile "Learn" accordion's own label styling.
  const learnActive = pathname !== "/" && learnCategories.some((category) => isCategoryActive(category.slug, pathname));
  // /search already has its own full-width search input with results inline
  // below it -- the header's copy (mobile row + desktop bar) would just be
  // a second, visually-identical input stacked right above it.
  const isSearchPage = pathname === "/search";
  // Same reasoning as site-footer.tsx: the logo SVG only ships in the
  // light cream fill designed for a dark background, so it needs inverting
  // to read as ink whenever the reader's real theme (see src/lib/theme.ts)
  // is light -- reactive, not route-based, so it flips the instant the
  // toggle is clicked, no navigation required.
  const { theme } = useTheme();
  const isLightTheme = theme === "light";

  // Only the sticky (non-mobile-panel) state ever hides/compacts -- the
  // mobile full-panel state has its own fixed-inset-0 treatment below and
  // forceVisible already includes mobileOpen, so scrollState can never
  // actually be "hidden" while it's open; this just keeps the transform
  // out of that branch's class list entirely rather than relying on that.
  const headerHidden = !mobileOpen && scrollState === "hidden";
  const headerCompact = !mobileOpen && scrollState !== "top";

  return (
    <header
      onFocus={() => setHeaderFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeaderFocused(false);
      }}
      // Inline style, not a -translate-y-full/translate-y-0 utility pair --
      // Tailwind v4 emits those utilities' --tw-translate-y custom property
      // correctly, but the composed transform property resolved to `none`
      // in the actual computed style regardless (verified directly; some
      // interaction with this element's other utility classes, not a logic
      // bug in the scroll state itself). A literal inline transform has no
      // such indirection to go wrong.
      style={{ transform: headerHidden ? "translateY(-100%)" : "translateY(0)" }}
      // bg-background, not an explicit bg-white/dark:bg-zinc-950 pair --
      // --color-background already resolves to the exact same warm paper
      // tone the rest of the homepage sits on in its light state, and the
      // site's own dark background elsewhere, via the same token every
      // other themed element already reads. Plain white read as slightly
      // colder/stark than the page's own paper tone.
      // lg:, not md: -- the 6-item desktop nav (see below) needs ~1024px to
      // fit without overflowing, so the mobile/desktop switch-over moved
      // from 768px to 1024px across every md:-breakpoint in this file. The
      // mobile menu's own content and behavior are completely unchanged;
      // only the viewport width at which it's shown moved.
      className={`border-b border-black/5 bg-background/90 backdrop-blur transition-transform duration-300 ease-out motion-reduce:transition-none dark:border-white/10 lg:sticky lg:inset-auto lg:z-[var(--z-header)] lg:flex-none lg:overflow-visible ${
        mobileOpen
          ? "fixed inset-0 z-[var(--z-modal)] flex flex-col overflow-y-auto bg-background"
          : "sticky top-0 z-[var(--z-header)]"
      }`}
    >
      <div
        // max-w-chrome, unconditionally -- every page's own Container now
        // resolves to the same 1160px width (see globals.css's comment on
        // --container-chrome/--container-content/--container-wide), so the
        // header no longer needs a per-route width switch to line up with
        // whatever's below it.
        className={`mx-auto flex w-full max-w-chrome shrink-0 items-center justify-between px-6 transition-[padding] duration-300 motion-reduce:transition-none ${
          headerCompact ? "py-2.5" : "py-5"
        }`}
      >
        {/* Logo and primary nav cluster together on the left -- with only
            two real destinations (Learn, Tools) plus the account menu,
            stretching them to opposite ends of the bar (the old layout)
            left a huge dead gap in the middle. Grouped and left-aligned
            reads as calm the way GitHub/Linear's headers do; spread out it
            just reads as empty. max-w-chrome now equals max-w-content
            (see globals.css), so the default px-6 padding alone lines the
            logo up with the page content below -- no extra offset needed. */}
        {/* gap-6, not gap-10 -- same 1024px-width space-budget reasoning as
            topLevelLinkClass above. */}
        <div className="flex items-center gap-6">
          <Link href="/" onClick={closeAll} className="shrink-0">
            {/* 164x44 -> 184x49 (~12%), aspect ratio preserved (the SVG's
                own viewBox is 527.13x141.71, ratio ~3.72) -- a masthead
                should give its logo more presence than a SaaS navbar's
                small corner mark. */}
            <Image
              src="/brand/logo-horizontal.svg"
              alt="The Haarchive"
              width={184}
              height={49}
              priority
              className={isLightTheme ? "invert" : undefined}
            />
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-0 lg:flex">
            {/* Each category is its own top-level trigger + dropdown --
                replaced the old shared "Learn" umbrella + two-pane flyout
                now that there are 6 categories, not 8 (see this file's own
                top-of-file comment, and CLAUDE.md §9). The last two items
                (Practice, Tools) right-align their panel instead of
                left-aligning it -- their triggers sit close enough to the
                header's right edge that a left-anchored panel (especially
                Tools' own two-column one) would clip off-screen. */}
            {categories.map((category, index) => {
              const sections = sectionsInCategory(category.slug);
              const isOpen = openCategorySlug === category.slug;
              const twoColumn = sections.length > TWO_COLUMN_THRESHOLD;
              const rightAlign = index >= categories.length - 2;
              return (
                <div
                  key={category.slug}
                  className="relative"
                  onMouseEnter={() => openCategory(category.slug)}
                  onMouseLeave={() => scheduleClose(category.slug)}
                >
                  <Link
                    href={`/${category.slug}`}
                    onClick={closeAll}
                    onFocus={() => openCategory(category.slug)}
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                    className={`flex items-center gap-0.5 ${topLevelLinkClass} ${
                      isCategoryActive(category.slug, pathname) ? topLevelActiveClass : ""
                    }`}
                  >
                    {category.title}
                    <svg
                      className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
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
                  </Link>

                  <div
                    className={`absolute top-full pt-3 transition-[max-height,opacity] duration-200 ${
                      rightAlign ? "right-0" : "left-0"
                    } ${isOpen ? "max-h-[32rem] opacity-100" : "pointer-events-none max-h-0 overflow-hidden opacity-0"}`}
                  >
                    <div
                      className={`rounded-2xl border border-black/10 bg-white p-3 shadow-dropdown dark:border-white/10 dark:bg-zinc-900 ${
                        twoColumn ? "w-[30rem]" : "w-64"
                      }`}
                    >
                      <ul className={twoColumn ? "grid grid-cols-2 gap-x-4 gap-y-0.5" : "space-y-0.5"}>
                        {sections.map((member) => (
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
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* gap-0 up to xl (1280px), gap-1 above it -- every icon button in
            this row is now uniformly 40px (search, BugReportTrigger,
            Questions, NotificationBell, ThemeToggle all size="sm"/h-10
            w-10), but even with that saved width, any nonzero gap here
            wraps "Sign in" onto two lines at exactly 1024px (verified --
            gap-0.5 alone was already enough to do it). 1024px only has
            room for edge-to-edge icons; from 1280px up there's real spare
            width, so the row gets an actual gap there instead of staying
            permanently cramped just to protect one narrow width. */}
        <div className="hidden items-center gap-0 lg:flex xl:gap-1">
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
              className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition hover:bg-black/5 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M17 17L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <BugReportTrigger variant="icon" size="sm" />
          <Link
            href="/questions"
            onClick={closeAll}
            aria-label="Questions and feedback"
            title="Questions and feedback"
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition hover:bg-black/5 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
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
          <NotificationBell size="sm" />
          <ThemeToggle />
          {/* ml-[11px] at xl+ only -- every icon button here is a 40px box
              around an 18px glyph, so two adjacent icons are visually 11px
              (glyph-to-box-edge) + the row gap + 11px (box-edge-to-glyph)
              apart, not just the gap value alone. AuthStatus's pill has no
              equivalent internal padding "halo" of its own -- its visible
              border sits flush with its actual box edge -- so without
              this, the *visible* gap before Sign in/Account reads as
              ~11px smaller than every other gap in this row even though
              the CSS gap itself is identical. Verified by measuring real
              glyph/border positions, not guessed: 26px between two icon
              glyphs, 15px between ThemeToggle's glyph and Sign in's
              border, before this fix. Same xl: (1280px) threshold as the
              row's own gap-0/xl:gap-1 above -- adding this unconditionally
              re-wrapped "Sign in" at exactly 1024-1030px, the same tight
              width that forced gap to stay 0 below xl in the first place. */}
          <div className="xl:ml-[11px]">
            <AuthStatus />
          </div>
        </div>

        {/* Mobile search toggle + hamburger, grouped -- search used to be a
            permanently-visible row under the header on every mobile page,
            which ate a full row of vertical space whether or not a visitor
            wanted it ("gets in the way too much" on small screens). It's
            still one tap away, never buried inside the hamburger menu
            itself, just collapsed to an icon until tapped. Opening either
            one closes the other -- they'd otherwise fight for the same
            space right under the header. */}
        <div className="flex items-center gap-1 lg:hidden">
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
      <div className={`min-h-0 border-t border-black/5 lg:hidden dark:border-white/10 ${mobileOpen ? "flex-1 overflow-y-auto" : "hidden"}`}>
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
                category's own landing page (/philosophy, /physiology, …)
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
            <ThemeToggle />
          </div>

          <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
            <AuthStatus
              onNavigate={closeAll}
              className="inline-flex rounded-full border border-black/15 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:border-black/30 hover:bg-black/5 dark:border-white/20 dark:text-white dark:hover:border-white/40 dark:hover:bg-white/10"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
