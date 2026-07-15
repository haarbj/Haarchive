import Link from "next/link";

import { formatDate } from "@/lib/format";
import { EVIDENCE_CATEGORY_LABELS, type EvidenceCategory } from "@/lib/articles/constants";

export type ContributorAttribution = {
  userId: string;
  name: string;
  title: string | null;
  avatarUrl: string | null;
};

export type ArticleAttribution = {
  authors: ContributorAttribution[];
  reviewers: ContributorAttribution[];
  publishedAt: string | null;
  evidenceCategory: string | null;
};

// Only rendered for database-backed articles (see [slug]/page.tsx's
// articles-table fallback) -- Foundations pages never pass `attribution` at
// all, so they render exactly as before this existed.
export function ArticleByline({ authors, reviewers, publishedAt, evidenceCategory }: ArticleAttribution) {
  if (authors.length === 0) return null;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4 border-y border-black/5 py-5 dark:border-white/10">
      <ContributorGroup label="Written by" contributors={authors} />
      <ContributorGroup label="Reviewed by" contributors={reviewers} />

      {publishedAt ? (
        <div>
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            Published
          </p>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">{formatDate(publishedAt.slice(0, 10))}</p>
        </div>
      ) : null}

      {evidenceCategory && EVIDENCE_CATEGORY_LABELS[evidenceCategory as EvidenceCategory] ? (
        <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-white/10 dark:text-zinc-200">
          {EVIDENCE_CATEGORY_LABELS[evidenceCategory as EvidenceCategory]}
        </span>
      ) : null}
    </div>
  );
}

function ContributorGroup({ label, contributors }: { label: string; contributors: ContributorAttribution[] }) {
  if (contributors.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">{label}</p>
      <div className="mt-2 flex flex-wrap gap-4">
        {contributors.map((contributor) => (
          <Link
            key={contributor.userId}
            href={`/contributors/${contributor.userId}`}
            className="group flex items-center gap-2"
          >
            {contributor.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URL, see contributor-profile-form.tsx
              <img
                src={contributor.avatarUrl}
                alt=""
                className="h-9 w-9 rounded-full border border-black/10 object-cover dark:border-white/10"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-black/5 dark:bg-white/10" />
            )}
            <div>
              <p className="text-sm font-semibold text-zinc-900 group-hover:underline dark:text-white">
                {contributor.name}
              </p>
              {contributor.title ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{contributor.title}</p>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
