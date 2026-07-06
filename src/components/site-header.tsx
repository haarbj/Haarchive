import Link from "next/link";

import { sections } from "@/lib/sections";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-black/5 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-zinc-950/90">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link className="text-sm font-semibold tracking-wide uppercase" href="/">
          WetBulb Running
        </Link>
        <nav aria-label="Primary" className="hidden gap-5 text-sm md:flex">
          {sections.map((section) => (
            <Link key={section.slug} className="text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white" href={`/${section.slug}`}>
              {section.title}
            </Link>
          ))}
        </nav>
      </div>
      <nav aria-label="Mobile" className="flex gap-3 overflow-x-auto px-6 pb-4 text-sm md:hidden">
        {sections.map((section) => (
          <Link key={section.slug} className="whitespace-nowrap rounded-full border border-black/10 px-3 py-1 text-zinc-600 transition hover:text-zinc-950 dark:border-white/20 dark:text-zinc-300 dark:hover:text-white" href={`/${section.slug}`}>
            {section.title}
          </Link>
        ))}
      </nav>
    </header>
  );
}
