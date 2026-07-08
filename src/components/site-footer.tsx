import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-black/5 py-8 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} The Haarchive.</p>
        <p>Physiology. Psychology. Philosophy. Practice.</p>
      </div>
      <div className="mx-auto mt-4 w-full max-w-6xl px-6">
        <Link
          href="/privacy-policy"
          className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 transition hover:text-zinc-950 hover:decoration-black/60 dark:text-zinc-400 dark:decoration-white/20 dark:hover:text-white dark:hover:decoration-white/70"
        >
          Privacy Policy
        </Link>
      </div>
    </footer>
  );
}
