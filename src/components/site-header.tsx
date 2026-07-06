"use client";

import { useState } from "react";
import Link from "next/link";

import { sections } from "@/lib/sections";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-10 border-b border-black/5 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-zinc-950/90">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link
          className="text-sm font-semibold tracking-wide uppercase"
          href="/"
          onClick={() => setOpen(false)}
        >
          The Haarchive
        </Link>

        <button
          type="button"
          aria-expanded={open}
          aria-controls="sections-menu"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Sections
          <svg
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
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
        id="sections-menu"
        className={`overflow-hidden border-t border-black/5 transition-[max-height] duration-300 dark:border-white/10 ${
          open ? "max-h-[80vh]" : "max-h-0 border-t-0"
        }`}
      >
        <div className="mx-auto max-h-[80vh] w-full max-w-6xl overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-4">
            {sections.map((section) => (
              <Link
                key={section.slug}
                href={`/${section.slug}`}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-sm text-zinc-600 transition hover:bg-black/5 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
              >
                {section.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
