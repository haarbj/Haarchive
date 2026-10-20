import type { TodayConditionsCardData } from "./today-conditions-service";

// Today's conditions guidance -- the forward-looking twin of
// conditions-section.tsx (completed-workout-conditions.ts's own display),
// same voice: real figures, a plain "run this by effort" instruction, and
// the adjusted number always labeled as an estimate, never a new
// prescription. Rendered identically whether the data came from a stored
// location (plan-view.tsx, server-rendered) or the geolocation action
// (today-conditions-geolocation.tsx, client-triggered) -- this component
// itself never fetches anything.
export function TodayConditionsCard({ data }: { data: TodayConditionsCardData }) {
  return (
    <div className="mt-6 rounded-card border border-black/10 p-4 dark:border-white/10">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
        Today&rsquo;s conditions — {data.locationLabel}
      </p>
      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
        {data.currentTempF}°F now, ~{data.peakTempF}°F at today&rsquo;s peak.
      </p>

      {data.heatCaution ? (
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
          <span className="font-semibold text-zinc-900 dark:text-white">{data.heatCaution.title}.</span> {data.heatCaution.sub}
        </p>
      ) : null}

      <div className="mt-3 space-y-2">
        {data.workouts.map((workout) =>
          workout.plannedPaceText && workout.adjustedPaceText ? (
            <p key={workout.id} className="text-sm text-zinc-900 dark:text-white">
              <span className="font-semibold">{workout.label}</span> is {workout.plannedPaceText}; in today&rsquo;s conditions that&rsquo;s
              an estimated ~{workout.adjustedPaceText} at the same effort. Run it by effort, not the number.
            </p>
          ) : (
            <p key={workout.id} className="text-sm text-zinc-600 dark:text-zinc-300">
              <span className="font-semibold text-zinc-900 dark:text-white">{workout.label}</span> — no pace target to adjust; use the
              conditions above to judge effort.
            </p>
          ),
        )}
      </div>
    </div>
  );
}
