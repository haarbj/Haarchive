"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { approveStravaMatch, dismissStravaMatch } from "./completion-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { formatClock } from "@/lib/running-format";
import { MILE_METERS } from "@/lib/race-distances";

export type PendingStravaMatch = {
  id: string;
  scheduledWorkoutId: string;
  activityName: string | null;
  distanceM: number | null;
  durationS: number | null;
  avgHr: number | null;
};

// The athlete's review step for Strava-suggested matches (strava_pending_
// matches) -- nothing here has touched completed_workouts yet, so the
// coach can't see any of this until "Use this data" is clicked. Distinct
// from CompletionForm, which is the manual-entry/edit path.
//
// More than one candidate can be live at once (two runs on the same day
// both landing on the same scheduled workout) -- each renders as its own
// card with its own approve/dismiss, keyed by the pending-match row's own
// id, not the workout's. Dismissing one used to delete the workout's only
// candidate row outright, so saying "not this one" to the wrong run left
// nothing behind to review even when a second, correct run genuinely
// existed; now it only soft-dismisses that one row (see
// dismissStravaMatch), so any other real candidate for this workout is
// still here to ask about next.
export function StravaMatchReview({ matches }: { matches: PendingStravaMatch[] }) {
  return (
    <div className="space-y-3">
      {matches.length > 1 ? (
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Found {matches.length} possible matches on Strava -- which one was this?
        </p>
      ) : null}
      {matches.map((match) => (
        <StravaMatchCard key={match.id} match={match} />
      ))}
    </div>
  );
}

function StravaMatchCard({ match }: { match: PendingStravaMatch }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const distanceMi = match.distanceM != null ? (match.distanceM / MILE_METERS).toFixed(2) : null;

  return (
    <Card padding="md">
      <Badge tone="tip">Found on Strava</Badge>
      <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{match.activityName || "Untitled run"}</p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        {[
          distanceMi ? `${distanceMi} mi` : null,
          match.durationS != null ? formatClock(match.durationS) : null,
          match.avgHr != null ? `${match.avgHr} avg bpm` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "No details available"}
      </p>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        This hasn&rsquo;t been added to your assigned workout yet, and your coach can&rsquo;t see it. Use it, or log this workout
        yourself below.
      </p>

      {error && (
        <div className="mt-2">
          <FormError>{error}</FormError>
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await approveStravaMatch(match.scheduledWorkoutId, match.id);
              if (result.error) return setError(result.error);
              router.refresh();
            });
          }}
        >
          {isPending ? "Saving…" : "Use this data"}
        </Button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await dismissStravaMatch(match.scheduledWorkoutId, match.id);
              if (result.error) return setError(result.error);
              router.refresh();
            });
          }}
          className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        >
          Not this one
        </button>
      </div>
    </Card>
  );
}
