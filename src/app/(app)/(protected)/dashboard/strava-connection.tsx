import Link from "next/link";

import { disconnectStrava } from "@/app/(app)/(protected)/dashboard/strava-actions";
import { SyncStravaButton } from "@/app/(app)/(protected)/dashboard/sync-strava-button";
import { workoutTypeLabel } from "@/app/(app)/(protected)/plan/format-workout";
import { formatDate, formatMiles, formatRelativeTime } from "@/lib/format";
import type { WorkoutType } from "@/lib/coaching-engine";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type LatestStravaActivity = {
  distanceM: number;
  workoutType: WorkoutType;
  matchedScheduledDate: string;
};

type StravaConnectionProps = {
  connected: boolean;
  lastSyncedAt: string | null;
  latestActivity: LatestStravaActivity | null;
};

export function StravaConnection({ connected, lastSyncedAt, latestActivity }: StravaConnectionProps) {
  return (
    <Card padding="md">
      <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
        Strava
      </p>
      {connected ? (
        <>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
            <span className="font-semibold text-zinc-900 dark:text-white">Last synced </span>
            {lastSyncedAt ? formatRelativeTime(lastSyncedAt) : "Never synced yet"}
          </p>
          {latestActivity && (
            <>
              <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-200">
                <span className="font-semibold text-zinc-900 dark:text-white">Latest activity </span>
                {formatMiles(latestActivity.distanceM)} {workoutTypeLabel(latestActivity.workoutType)}
              </p>
              <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                Matched to {formatDate(latestActivity.matchedScheduledDate)} workout ✓
              </p>
            </>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <SyncStravaButton />
            <form action={disconnectStrava}>
              <Button type="submit" variant="outline" size="sm">
                Disconnect
              </Button>
            </form>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Connect Strava to automatically match your runs to scheduled workouts.
          </p>
          <Link
            href="/auth/strava"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#FC4C02] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[#e34402]"
          >
            Connect Strava
          </Link>
        </>
      )}
    </Card>
  );
}
