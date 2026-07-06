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

        <nav aria-label="Primary" className="hidden gap-5 text-sm md:flex">
          {sections.map((section) => (
            <Link
              key={section.slug}
              className="text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
              href={`/${section.slug}`}
            >
              {section.title}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-black/5 md:hidden dark:hover:bg-white/10"
        >
          <span className="relative block h-4 w-5">
            <span
              className={`absolute left-0 top-0 h-0.5 w-5 bg-current transition ${open ? "translate-y-[7px] rotate-45" : ""}`}
            />
            <span
              className={`absolute left-0 top-[7px] h-0.5 w-5 bg-current transition ${open ? "opacity-0" : ""}`}
            />
            <span
              className={`absolute left-0 top-[14px] h-0.5 w-5 bg-current transition ${open ? "-translate-y-[7px] -rotate-45" : ""}`}
            />
          </span>
        </button>
      </div>

      <nav
        aria-label="Mobile"
        className={`overflow-hidden transition-[max-height] duration-300 md:hidden ${
          open ? "max-h-[70vh]" : "max-h-0"
        }`}
      >
        <div className="max-h-[70vh] overflow-y-auto px-6 pb-4">
          {sections.map((section) => (
            <Link
              key={section.slug}
              href={`/${section.slug}`}
              onClick={() => setOpen(false)}
              className="block border-b border-black/5 py-3 text-sm text-zinc-600 transition hover:text-zinc-950 dark:border-white/10 dark:text-zinc-300 dark:hover:text-white"
            >
              {section.title}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
