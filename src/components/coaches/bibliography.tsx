import type { PrimarySource, SourceKind } from "@/lib/coaches/types";

const CATEGORY_ORDER: { kind: SourceKind; label: string }[] = [
  { kind: "book", label: "Books" },
  { kind: "paper", label: "Research Papers" },
  { kind: "article", label: "Articles" },
  { kind: "interview", label: "Interviews" },
  { kind: "podcast", label: "Podcasts" },
  { kind: "video", label: "Videos" },
  { kind: "website", label: "Websites" },
  { kind: "lecture", label: "Lectures" },
];

const KIND_VERB: Record<SourceKind, string> = {
  book: "Read",
  paper: "Read",
  podcast: "Listen",
  lecture: "Watch",
  interview: "Watch",
  article: "Read",
  website: "Visit",
  video: "Watch",
};

// A real bibliography, grouped the way an academic reference list actually
// is -- by type -- rather than one flat list. `url` only ever appears on a
// source this data trusts as a stable, confirmed address (see PrimarySource's
// own comment); every other source still gets its full citation (title,
// author, publication, why it matters), just without a "Visit" button,
// which is more honest than a plausible-looking but unverified link.
export function Bibliography({ sources }: { sources: PrimarySource[] }) {
  const groups = CATEGORY_ORDER.map((category) => ({
    ...category,
    sources: sources.filter((s) => s.kind === category.kind),
  })).filter((group) => group.sources.length > 0);

  return (
    <div className="mt-8 space-y-8">
      {groups.map((group) => (
        <div key={group.kind}>
          <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            {group.label}
          </h3>
          <div className="mt-3 space-y-4">
            {group.sources.map((source) => (
              <div
                key={source.title}
                className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900"
              >
                <h4 className="font-semibold text-zinc-900 dark:text-white">{source.title}</h4>
                {source.author || source.publication ? (
                  <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                    {source.author}
                    {source.author && source.publication ? " — " : null}
                    {source.publication}
                  </p>
                ) : null}
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{source.description}</p>
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-sm font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
                  >
                    {KIND_VERB[source.kind]} →
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
