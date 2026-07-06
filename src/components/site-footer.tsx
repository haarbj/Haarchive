export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-black/5 py-8 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} The Haarchive.</p>
        <p>Science. Psychology. Philosophy. Practice.</p>
      </div>
    </footer>
  );
}
