import type { Section } from "@/lib/sections";
import { CardLink } from "@/components/ui/card-link";

type ChapterNavProps = {
  prev: Section | null;
  next: Section | null;
};

export function ChapterNav({ prev, next }: ChapterNavProps) {
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="Chapter navigation"
      className="mt-16 grid gap-4 border-t border-black/10 pt-8 sm:grid-cols-2 dark:border-white/10"
    >
      {prev ? (
        <CardLink href={`/${prev.slug}`} padding="sm" className="flex flex-col">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            <span aria-hidden="true">←</span> Previous
          </span>
          <span className="mt-1 text-lg font-semibold tracking-tight text-zinc-900 transition group-hover:text-zinc-950 dark:text-white">
            {prev.title}
          </span>
        </CardLink>
      ) : (
        <div aria-hidden="true" />
      )}
      {next ? (
        <CardLink href={`/${next.slug}`} padding="sm" className="flex flex-col items-end text-right">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Next <span aria-hidden="true">→</span>
          </span>
          <span className="mt-1 text-lg font-semibold tracking-tight text-zinc-900 transition group-hover:text-zinc-950 dark:text-white">
            {next.title}
          </span>
        </CardLink>
      ) : (
        <div aria-hidden="true" />
      )}
    </nav>
  );
}
