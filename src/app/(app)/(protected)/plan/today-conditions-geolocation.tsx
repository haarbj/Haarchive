"use client";

import { useState, useTransition } from "react";

import { fetchTodayConditionsForCoordinates } from "./today-conditions-actions";
import { TodayConditionsCard } from "./today-conditions-card";
import type { TodayWorkoutInput } from "./today-conditions-service";

// The one quiet "use my location" affordance in this whole feature --
// rendered only when plan-view.tsx found no stored location to resolve
// server-side (today's actual common case: athlete_profiles.city/state/
// country exist as columns but no current form writes them). Never
// fires automatically: browser geolocation's own permission prompt only
// ever appears after this explicit click, never on page load -- the
// "no nagging" requirement met by simply not calling
// navigator.geolocation until asked to.
export function TodayConditionsGeolocation({ todayDate, workouts }: { todayDate: string; workouts: TodayWorkoutInput[] }) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchTodayConditionsForCoordinates>>>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (data) return <TodayConditionsCard data={data} />;
  if (dismissed) return null;

  function handleClick() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Your browser doesn't support location lookup.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        startTransition(async () => {
          const result = await fetchTodayConditionsForCoordinates(
            position.coords.latitude,
            position.coords.longitude,
            todayDate,
            workouts,
          );
          if (!result) {
            // Weather fetch failed, or no usable reading -- absent
            // entirely, same as the stored-location path; no error
            // banner for a routine fetch miss.
            setDismissed(true);
            return;
          }
          setData(result);
        });
      },
      () => setDismissed(true), // permission denied -- no card, no nag, no retry prompt
      { timeout: 8000 },
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="mt-4 text-sm font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
      >
        {isPending ? "Checking today's conditions…" : "Use my location for today's conditions"}
      </button>
      {error ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{error}</p> : null}
    </div>
  );
}
