import type { Metadata } from "next";
import Link from "next/link";

import { releaseNotes } from "@/lib/release-notes";
import { formatDate } from "@/lib/format";
import { canonicalUrl } from "@/lib/canonical";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Release Notes",
  description: "What's changed on The Haarchive, in plain language, grouped by month.",
  ...canonicalUrl("/release-notes"),
};

const backLinkClass =
  "mb-6 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-zinc-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white";

function monthHeading(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

// Entries already come newest-first (see release-notes.ts's own comment on
// where a new one goes); this only needs to fold that flat list into
// month-keyed groups, not sort or reverse anything.
function groupByMonth(notes: typeof releaseNotes): { month: string; entries: typeof releaseNotes }[] {
  const groups: { month: string; entries: typeof releaseNotes }[] = [];
  for (const note of notes) {
    const key = note.date.slice(0, 7); // YYYY-MM
    const current = groups[groups.length - 1];
    if (current?.month === key) current.entries.push(note);
    else groups.push({ month: key, entries: [note] });
  }
  return groups;
}

export default function ReleaseNotesPage() {
  const groups = groupByMonth(releaseNotes);

  return (
    <Container variant="content">
      <Link href="/" className={backLinkClass}>
        <span aria-hidden="true">←</span> Back to home
      </Link>
      <Heading>Release Notes</Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        What&rsquo;s actually changed on the site, newest first. This tracks real, shipped
        updates, not every internal fix or rewrite, sourced from the project&rsquo;s own commit
        history.
      </p>

      <div className="mt-12 space-y-14">
        {groups.map((group) => (
          <section key={group.month} aria-labelledby={`month-${group.month}`}>
            <h2
              id={`month-${group.month}`}
              className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase"
            >
              {monthHeading(group.entries[0].date)}
            </h2>
            <div className="mt-5 space-y-8 border-l border-black/10 pl-6 dark:border-white/10">
              {group.entries.map((note) => (
                <article key={`${note.date}-${note.headline}`} className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 -left-[27px] h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-700"
                  />
                  <time
                    dateTime={note.date}
                    className="block text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400"
                  >
                    {formatDate(note.date)}
                  </time>
                  <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
                    {note.headline}
                  </h3>
                  <p className="mt-2 max-w-[66ch] text-base leading-7 text-zinc-600 dark:text-zinc-300">
                    {note.detail}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Container>
  );
}
