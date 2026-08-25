"use client";

import Image from "next/image";
import Link from "next/link";

import { categories } from "@/lib/sections";
import { BugReportTrigger } from "@/components/bug-report/bug-report-trigger";
import { useTheme } from "@/lib/theme";

const linkClass =
  "text-zinc-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white";

export function SiteFooter() {
  // The logo SVGs only ship in one color (the light cream #f2f0ec fill,
  // designed for the site's dark background) -- there's no separate "ink"
  // export for use on a light background. Whenever the reader's real theme
  // (see src/lib/theme.ts) is light, invert flips that same asset to read
  // as dark ink on paper rather than washing out near-invisible against
  // white; in dark theme the logo needs no adjustment. Reactive, not
  // route-based, so it flips the instant the toggle is clicked.
  const { theme } = useTheme();
  const isLightTheme = theme === "light";

  return (
    <footer className="mt-16 border-t border-black/5 py-12 text-sm dark:border-white/10">
      <div className="mx-auto grid w-full max-w-chrome gap-10 px-6 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Image
            src="/brand/logo-horizontal-tagline.svg"
            alt="The Haarchive -- Physiology. Psychology. Philosophy. Practice. Distance running knowledge hub."
            width={390}
            height={72}
            className={isLightTheme ? "invert" : undefined}
          />
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
            Learn
          </p>
          <ul className="mt-3 space-y-2">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link href={`/${category.slug}`} className={linkClass}>
                  {category.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
            Community &amp; Site
          </p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/questions" className={linkClass}>
                Ask a question
              </Link>
            </li>
            <li>
              <Link href="/faq" className={linkClass}>
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/release-notes" className={linkClass}>
                Release Notes
              </Link>
            </li>
            <li>
              <Link href="/contact" className={linkClass}>
                Contact
              </Link>
            </li>
            <li>
              {/* A button, not a Link -- this opens the Drawer in place
                  rather than navigating anywhere, same reasoning as the
                  Notes trigger. Same visual weight as every other item in
                  this list (linkClass) so it reads as one more quiet site
                  utility, not a callout. */}
              <BugReportTrigger />
            </li>
            <li>
              <Link href="/privacy-policy" className={linkClass}>
                Privacy Policy
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-10 w-full max-w-chrome px-6">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          © {new Date().getFullYear()} The Haarchive.
        </p>
      </div>
    </footer>
  );
}
