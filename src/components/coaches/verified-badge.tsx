import { formatDate } from "@/lib/format";

type VerifiedBadgeProps = {
  coachName: string;
  reviewedAt: string;
};

// Renders whenever a Coach's `review` field is set (see CoachReview in
// lib/coaches/types.ts) -- today that's never, since no coach has reviewed
// their page yet. Turning a real coach's feedback into this badge is a
// one-line data change (adding `review: { reviewedAt: "..." }` to that
// coach's entry in lib/coaches/data.ts), not a page redesign.
export function VerifiedBadge({ coachName, reviewedAt }: VerifiedBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/5 dark:text-emerald-400">
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M4 10.5l3.5 3.5L16 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Reviewed by {coachName} · {formatDate(reviewedAt)}
    </span>
  );
}
