import Link from "next/link";

import { categories } from "@/lib/sections";

const linkClass =
  "text-zinc-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-black/5 py-12 text-sm dark:border-white/10">
      <div className="mx-auto grid w-full max-w-chrome gap-10 px-6 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="text-sm font-semibold tracking-wide text-zinc-900 uppercase dark:text-white">
            The Haarchive
          </p>
          <p className="mt-2 max-w-xs text-zinc-500 dark:text-zinc-400">
            Physiology. Psychology. Philosophy. Practice.
          </p>
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
              <Link href="/contact" className={linkClass}>
                Contact
              </Link>
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
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          © {new Date().getFullYear()} The Haarchive.
        </p>
      </div>
    </footer>
  );
}
