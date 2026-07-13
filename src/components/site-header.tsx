"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { categories, sectionsInCategory } from "@/lib/sections";
import { AuthStatus } from "@/components/auth-status";

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileLearnOpen, setMobileLearnOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openLearn = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setLearnOpen(true);
  };

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setLearnOpen(false), 150);
  };

  const closeAll = () => {
    setLearnOpen(false);
    setMobileOpen(false);
    setMobileLearnOpen(false);
  };

  const learnActive = isLearnPath(pathname);
  const toolsActive = isToolsPath(pathname);

  return (
    <header className="sticky top-0 z-[var(--z-header)] border-b border-black/5 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-zinc-950/90">
      <div className="mx-auto flex w-full max-w-chrome items-center justify-between px-6 py-4">
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
                className={`absolute left-0 top-full w-[720px] overflow-hidden pt-3 transition-[max-height,opacity] duration-200 ${
                  learnOpen ? "max-h-[32rem] opacity-100" : "pointer-events-none max-h-0 opacity-0"
                }`}
              >
                {/* CSS multi-column, not a grid -- categories range from 1
                    to 6 sections, and a fixed 3-column grid forces every
                    row to the height of its tallest cell, leaving ragged
                    gaps under the shorter ones. break-inside-avoid keeps
                    each category's heading+list together as one block
                    while the browser packs blocks into balanced-height
                    columns, like a newspaper layout. */}
                <div className="columns-3 gap-x-6 rounded-2xl border border-black/10 bg-white p-6 shadow-dropdown dark:border-white/10 dark:bg-zinc-900">
                  {learnCategories.map((category) => {
                    const members = sectionsInCategory(category.slug);
                    return (
                      <div key={category.slug} className="mb-6 break-inside-avoid">
                        <Link
                          href={`/${category.slug}`}
                          onClick={closeAll}
                          className="text-sm font-semibold text-zinc-900 transition hover:text-zinc-600 dark:text-white dark:hover:text-zinc-300"
                        >
                          {category.title}
                        </Link>
                        <ul className="mt-2 space-y-1.5">
                          {members.map((member) => (
                            <li key={member.slug}>
                              <Link
                                href={`/${member.slug}`}
                                onClick={closeAll}
                                className="text-sm text-zinc-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
                              >
                                {member.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
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

        <div className="hidden md:block">
          <AuthStatus />
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="flex h-12 w-12 items-center justify-center rounded-full transition hover:bg-black/5 md:hidden dark:hover:bg-white/10"
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

      {/* Mobile menu */}
      <div
        className={`overflow-hidden border-t border-black/5 transition-[max-height] duration-300 md:hidden dark:border-white/10 ${
          mobileOpen ? "max-h-[80vh]" : "max-h-0 border-t-0"
        }`}
      >
        <div className="max-h-[80vh] overflow-y-auto px-6 py-4">
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

            <div
              className={`overflow-hidden transition-[max-height] duration-200 ${
                mobileLearnOpen ? "max-h-[48rem]" : "max-h-0"
              }`}
            >
              <div className="space-y-4 pb-4 pl-3">
                {learnCategories.map((category) => {
                  const members = sectionsInCategory(category.slug);
                  return (
                    <div key={category.slug}>
                      <Link
                        href={`/${category.slug}`}
                        onClick={closeAll}
                        className="text-sm font-semibold text-zinc-900 dark:text-white"
                      >
                        {category.title}
                      </Link>
                      <div className="mt-1.5 flex flex-col gap-1">
                        {members.map((member) => (
                          <Link
                            key={member.slug}
                            href={`/${member.slug}`}
                            onClick={closeAll}
                            className="rounded-lg px-2 py-1.5 text-sm text-zinc-500 transition hover:bg-black/5 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
                          >
                            {member.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
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
