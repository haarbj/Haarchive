import type { ReactNode } from "react";
import Link from "next/link";

import { formatDate } from "@/lib/format";
import { EVIDENCE_CATEGORY_LABELS, type EvidenceCategory } from "@/lib/articles/constants";
import type { ArticleAttribution, ContributorAttribution } from "@/lib/articles/attribution";
import { Badge } from "@/components/ui/badge";
import { Heading } from "@/components/ui/heading";

type ArticleHeroProps = {
  title: string;
  mission: string | null;
  coverImageUrl: string | null;
  attribution: ArticleAttribution;
  readingMinutes: number;
};

// Replaces the old Title -> Subtitle -> ArticleOverview -> ArticleByline ->
// cover-image chain (see [slug]/page.tsx and article-layout.tsx) for a
// database-backed article specifically: those were five stacked, unrelated-
// looking sections. Here, title/subtitle overlay the image itself (the
// actual hero); credits/date/reading-time sit in their own strip directly
// below it, inside the same bordered card, rather than competing with the
// image for contrast. An article with no cover image falls back to a plain
// (still unified, just un-imaged) header. Foundations pages never call
// this; they keep ArticleOverview's breadcrumb+reading-time treatment
// exactly as it was.
export function ArticleHero({ title, mission, coverImageUrl, attribution, readingMinutes }: ArticleHeroProps) {
  const { authors, contributors, reviewers, publishedAt, evidenceCategory } = attribution;
  const evidenceLabel =
    evidenceCategory && EVIDENCE_CATEGORY_LABELS[evidenceCategory as EvidenceCategory]
      ? EVIDENCE_CATEGORY_LABELS[evidenceCategory as EvidenceCategory]
      : null;

  // Every author renders at the same size/weight, whether there's one or
  // several -- some articles are genuinely co-written with no single lead,
  // so nothing here singles one out as "the" author. A solo author still
  // gets their title shown underneath; with several, individual titles are
  // dropped rather than picking whose to show.
  const creditsRow = authors.length > 0 && (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 gap-1.5">
          {authors.slice(0, 4).map((author) =>
            author.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URL, see contributor-profile-form.tsx
              <img
                key={author.userId}
                src={author.avatarUrl}
                alt=""
                className="h-11 w-11 rounded-full border border-black/10 object-cover dark:border-white/10"
              />
            ) : (
              <div key={author.userId} className="h-11 w-11 rounded-full bg-black/5 dark:bg-white/10" />
            ),
          )}
        </div>
        <div>
          <p className="text-base font-semibold text-zinc-900 dark:text-white">
            By <NameList people={authors} />
          </p>
          {authors.length === 1 && authors[0].title ? (
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{authors[0].title}</p>
          ) : null}
          {contributors.length > 0 ? (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              With contributions from <NameList people={contributors} />
            </p>
          ) : null}
          {reviewers.length > 0 ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <CheckIcon />
              Reviewed by <NameList people={reviewers} />
            </p>
          ) : null}
        </div>
      </div>

      {/* One line, not two stacked <p>s -- matches the reading-time/date
          format already used on the article preview card in
          [slug]/page.tsx, and avoids the two lines butting up against each
          other with no gap between them (every other line in this credits
          block has a deliberate mt-*; these didn't). */}
      <p className="text-sm text-zinc-500 sm:text-right dark:text-zinc-400">
        {readingMinutes} min read
        {publishedAt ? ` · ${formatDate(publishedAt.slice(0, 10))}` : ""}
      </p>
    </div>
  );

  if (coverImageUrl) {
    return (
      <div className="mt-8 overflow-hidden rounded-card border border-black/10 dark:border-white/10">
        {/* aspect-video (16:9) only from sm: up. Below that, a fixed 16:9
            box is too short for a long title at mobile width -- the title
            wraps to more lines than the box has room for, and since it's
            absolutely positioned inside that box, the overflow gets clipped
            instead of pushing the box taller. On mobile the text block is
            back in normal flow (no sm:absolute) so it drives the box's
            height itself; min-h-64 is just a floor so a short title doesn't
            leave a token sliver of image above it. The image is absolute
            inset-0 at every breakpoint so it always fills however tall that
            ends up being, sm:aspect-video and all. */}
        <div className="relative min-h-64 sm:aspect-video">
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded/external URL, not a local/optimized asset */}
          <img src={coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          {/* Never fades to fully transparent -- the top of the image stays
              tinted at 40% instead of bare, so a title that wraps to more
              lines than expected doesn't run out of contrast floor. Matches
              Evoke's own hero treatment (a single from-opaque/to-40% scrim),
              just tied to the site's own near-black instead of a brand
              color Haarchive doesn't have. */}
          <div className="absolute inset-0 bg-gradient-to-t from-black to-black/40" />
          <div className="relative p-6 sm:absolute sm:inset-x-0 sm:bottom-0 sm:p-10">
            {evidenceLabel ? <Badge tone="research">{evidenceLabel}</Badge> : null}
            <Heading className={`text-white text-balance sm:text-5xl ${evidenceLabel ? "mt-3" : ""}`}>{title}</Heading>
            {mission ? <p className="mt-3 max-w-3xl text-base text-white/80 sm:text-lg">{mission}</p> : null}
          </div>
        </div>
        {creditsRow ? (
          <div className="border-t border-black/5 bg-white px-6 py-5 dark:border-white/10 dark:bg-zinc-900 sm:px-10">
            {creditsRow}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-8">
      {evidenceLabel ? <Badge tone="research">{evidenceLabel}</Badge> : null}
      <Heading className={`text-balance ${evidenceLabel ? "mt-3" : ""}`}>{title}</Heading>
      {mission ? <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">{mission}</p> : null}
      {creditsRow ? <div className="mt-6 border-t border-black/5 pt-5 dark:border-white/10">{creditsRow}</div> : null}
    </div>
  );
}

// "A" / "A and B" / "A, B, and C" -- reads naturally regardless of whether
// one contributor was added or ten, which a comma-joined string wouldn't
// (no "and" before the last name) and a bullet list would overweight
// (this is a supporting credit, not its own section).
function NameList({ people }: { people: ContributorAttribution[] }): ReactNode {
  return people.map((person, i) => (
    <span key={person.userId}>
      {i === 0 ? "" : i === people.length - 1 ? (people.length > 2 ? ", and " : " and ") : ", "}
      <Link href={`/contributors/${person.userId}`} className="hover:underline">
        {person.name}
      </Link>
    </span>
  ));
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 text-accent-success" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10.5l3.5 3.5L16 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
