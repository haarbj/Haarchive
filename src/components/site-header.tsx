"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { categories, sectionsInCategory } from "@/lib/sections";

export function SiteHeader() {
  const pathname = usePathname();
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openDropdown = (slug: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenCategory(slug);
  };

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpenCategory(null), 150);
  };

  const closeAll = () => {
    setOpenCategory(null);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-10 border-b border-black/5 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-zinc-950/90">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link
          className="text-sm font-semibold tracking-wide uppercase"
          href="/"
          onClick={closeAll}
        >
          The Haarchive
        </Link>

        {/* Desktop nav: each category is its own hoverable item */}
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {categories.map((category) => {
            const isOpen = openCategory === category.slug;
            const members = sectionsInCategory(category.slug);
            const isActive =
              pathname === `/${category.slug}` ||
              members.some((member) => pathname === `/${member.slug}`);

            return (
              <div
                key={category.slug}
                className="relative"
                onMouseEnter={() => openDropdown(category.slug)}
                onMouseLeave={scheduleClose}
              >
                <div
                  className={`flex items-center gap-1 rounded-full text-sm transition hover:bg-black/5 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white ${
                    isActive
                      ? "bg-black/5 text-zinc-950 dark:bg-white/10 dark:text-white"
                      : "text-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  <Link
                    href={`/${category.slug}`}
                    onClick={closeAll}
                    aria-current={isActive ? "page" : undefined}
                    className="py-2 pl-3"
                  >
                    {category.title}
                  </Link>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-label={`Toggle ${category.title} submenu`}
                    onClick={() =>
                      setOpenCategory((current) =>
                        current === category.slug ? null : category.slug,
                      )
                    }
                    className="py-2 pr-3"
                  >
                    <svg
                      className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
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
                  </button>
                </div>

                <div
                  className={`absolute left-0 top-full overflow-hidden pt-2 transition-[max-height,opacity] duration-200 ${
                    isOpen
                      ? "max-h-96 opacity-100"
                      : "pointer-events-none max-h-0 opacity-0"
                  }`}
                >
                  <div className="flex w-56 flex-col gap-1 rounded-xl border border-black/10 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-zinc-900">
                    {members.map((section) => {
                      const isSectionActive = pathname === `/${section.slug}`;

                      return (
                        <Link
                          key={section.slug}
                          href={`/${section.slug}`}
                          onClick={closeAll}
                          aria-current={isSectionActive ? "page" : undefined}
                          className={`rounded-lg px-3 py-2 text-sm transition hover:bg-black/5 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white ${
                            isSectionActive
                              ? "bg-black/5 text-zinc-950 dark:bg-white/10 dark:text-white"
                              : "text-zinc-600 dark:text-zinc-300"
                          }`}
                        >
                          {section.title}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-black/5 md:hidden dark:hover:bg-white/10"
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

      {/* Mobile accordion menu */}
      <div
        className={`overflow-hidden border-t border-black/5 transition-[max-height] duration-300 md:hidden dark:border-white/10 ${
          mobileOpen ? "max-h-[80vh]" : "max-h-0 border-t-0"
        }`}
      >
        <div className="max-h-[80vh] overflow-y-auto px-6 py-4">
          {categories.map((category) => {
            const isOpen = openCategory === category.slug;
            const members = sectionsInCategory(category.slug);
            const isActive =
              pathname === `/${category.slug}` ||
              members.some((member) => pathname === `/${member.slug}`);

            return (
              <div
                key={category.slug}
                className="border-b border-black/5 last:border-b-0 dark:border-white/10"
              >
                <div className="flex items-center justify-between border-b border-black/5 py-3 last:border-b-0 dark:border-white/10">
                  <Link
                    href={`/${category.slug}`}
                    onClick={closeAll}
                    aria-current={isActive ? "page" : undefined}
                    className={`text-sm font-medium ${
                      isActive
                        ? "text-zinc-950 underline dark:text-white"
                        : "text-zinc-900 dark:text-white"
                    }`}
                  >
                    {category.title}
                  </Link>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-label={`Toggle ${category.title} submenu`}
                    onClick={() =>
                      setOpenCategory((current) =>
                        current === category.slug ? null : category.slug,
                      )
                    }
                    className="p-1"
                  >
                    <svg
                      className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
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
                  </button>
                </div>

                <div
                  className={`overflow-hidden transition-[max-height] duration-200 ${
                    isOpen ? "max-h-96" : "max-h-0"
                  }`}
                >
                  <div className="flex flex-col gap-1 pb-3 pl-3">
                    {members.map((section) => {
                      const isSectionActive = pathname === `/${section.slug}`;

                      return (
                        <Link
                          key={section.slug}
                          href={`/${section.slug}`}
                          onClick={closeAll}
                          aria-current={isSectionActive ? "page" : undefined}
                          className={`rounded-lg px-3 py-2 text-sm transition hover:bg-black/5 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white ${
                            isSectionActive
                              ? "bg-black/5 text-zinc-950 dark:bg-white/10 dark:text-white"
                              : "text-zinc-600 dark:text-zinc-300"
                          }`}
                        >
                          {section.title}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
}
