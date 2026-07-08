import Link from "next/link";

import { disconnectStrava } from "@/app/(app)/dashboard/strava-actions";

type StravaConnectionProps = {
  connected: boolean;
};

export function StravaConnection({ connected }: StravaConnectionProps) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
        Strava
      </p>
      {connected ? (
        <>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
            Connected. Syncing activities into race results and workouts is
            coming in a later update.
          </p>
          <form action={disconnectStrava} className="mt-3">
            <button
              type="submit"
              className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
            >
              Disconnect
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Connect Strava to link your account. Activity syncing is coming
            in a later update.
          </p>
          <Link
            href="/auth/strava"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#FC4C02] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[#e34402]"
          >
            Connect Strava
          </Link>
        </>
      )}
    </div>
  );
}
