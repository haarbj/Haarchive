import type { ReactNode } from "react";
import Link from "next/link";

import type { ContentBlock } from "@/lib/sections";
import { formatDate } from "@/lib/format";
import { ARTICLE_TYPE_LABELS, EVIDENCE_CATEGORY_LABELS, type ArticleType, type EvidenceCategory } from "@/lib/articles/constants";
import type { ArticleAttribution, ContributorAttribution } from "@/lib/articles/attribution";
import { ArticleNotes } from "@/components/notes/article-notes";

type ArticleHeroProps = {
  title: string;
  mission: string | null;
  articleType: string;
  attribution: ArticleAttribution;
  readingMinutes: number;
  // Threaded through to ArticleNotes, rendered inline in the eyebrow row
  // below (see that row's own comment) -- this is the one place a DB
  // article's Save/Notes render now, not a separate row further down the
  // page (see article-layout.tsx, which no longer renders it at all).
  contentSlug: string;
  content: ContentBlock[];
  initialBookmarked: boolean;
};

// Text-only hero: eyebrow (+ Save/Notes inline on the same line), serif
// title, subtitle, then a single restrained author/metadata line -- no
// image here (see article-layout.tsx, which renders the cover image, if
// any, as an editorial artifact further down the page). Matches the
// homepage's own section-opening pattern (eyebrow -> serif heading ->
// body-scale copy) rather than a boxed hero card. Foundations pages never
// call this; they keep ArticleOverview's own breadcrumb+Save/Notes row.
export function ArticleHero({
  title,
  mission,
  articleType,
  attribution,
  readingMinutes,
  contentSlug,
  content,
  initialBookmarked,
}: ArticleHeroProps) {
  const { authors, contributors, reviewers, publishedAt, evidenceCategory } = attribution;
  const evidenceLabel =
    evidenceCategory && EVIDENCE_CATEGORY_LABELS[evidenceCategory as EvidenceCategory]
      ? EVIDENCE_CATEGORY_LABELS[evidenceCategory as EvidenceCategory]
      : null;
  const typeLabel = ARTICLE_TYPE_LABELS[articleType as ArticleType] ?? "Article";

  // Every author renders at the same size/weight, whether there's one or
  // several -- some articles are genuinely co-written with no single lead,
  // so nothing here singles one out as "the" author. A solo author still
  // gets their title shown inline; with several, individual titles are
  // dropped rather than picking whose to show.
  const creditsRow = authors.length > 0 && (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <div className="flex shrink-0 -space-x-2">
        {authors.slice(0, 4).map((author) =>
          author.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URL, see contributor-profile-form.tsx
            <img
              key={author.userId}
              src={author.avatarUrl}
              alt=""
              className="h-8 w-8 rounded-full border border-zinc-50 object-cover dark:border-zinc-950"
            />
          ) : (
            <div key={author.userId} className="h-8 w-8 rounded-full border border-zinc-50 bg-black/5 dark:border-zinc-950 dark:bg-white/10" />
          ),
        )}
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        <span className="font-semibold text-zinc-900 dark:text-white">
          <NameList people={authors} />
        </span>
        {authors.length === 1 && authors[0].title ? ` · ${authors[0].title}` : ""}
        {` · ${readingMinutes} min read`}
        {publishedAt ? ` · ${formatDate(publishedAt.slice(0, 10))}` : ""}
      </p>
    </div>
  );

  const supportingCredits = (contributors.length > 0 || reviewers.length > 0) && (
    <div className="mt-2 space-y-1 text-sm text-zinc-500 dark:text-zinc-400">
      {contributors.length > 0 ? (
        <p>
          With contributions from <NameList people={contributors} />
        </p>
      ) : null}
      {reviewers.length > 0 ? (
        <p className="flex items-center gap-1.5">
          <CheckIcon />
          Reviewed by <NameList people={reviewers} />
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="mt-8">
      {/* Save/Notes render inline on the right of this same eyebrow line,
          not as a separate row further down the page -- reads as the
          masthead's own two lines of business (what shelf this belongs on,
          and what you can do with it) rather than injected utility chrome
          appearing mid-page. ArticleNotes' own returned fragment has more
          than one possible child (its trigger row, the selection toolbar,
          the notes drawer portal), so it's wrapped in its own div rather
          than spread directly as a flex child -- otherwise a
          conditionally-rendered sibling (e.g. the drawer opening) would
          silently change how many items justify-between is distributing
          space across. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
          {typeLabel}
          {evidenceLabel ? ` · ${evidenceLabel}` : ""}
        </p>
        <div className="shrink-0">
          <ArticleNotes contentSlug={contentSlug} content={content} initialBookmarked={initialBookmarked} />
        </div>
      </div>
      <h1 className="font-serif mt-3 text-4xl leading-[1.1] font-medium tracking-tight text-balance text-zinc-900 sm:text-5xl lg:text-6xl dark:text-white">
        {title}
      </h1>
      {mission ? <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">{mission}</p> : null}
      {creditsRow}
      {supportingCredits}
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
