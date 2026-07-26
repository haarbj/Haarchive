import { formatClock } from "@/lib/format";
import { MILE_METERS } from "@/lib/race-distances";
import { AerobicDecouplingCheck } from "./aerobic-decoupling-check";

// Shared between the self-serve WorkoutCard, the coach's read-only plan
// view, and the group-schedule athlete view -- every completion, whichever
// table it lives in (workout_completions.workout_id or
// .group_plan_workout_id), has this same shape. Once logged, showing the
// real detail (not just a "Completed" badge) is the whole point of a
// running log: "go back and look at how you felt."
export type CompletionDetail = {
  actual_distance_m: number | null;
  actual_time_s: number | null;
  rpe: number | null;
  avg_hr: number | null;
  notes: string | null;
  // Optional: only the self-serve plan view's query selects this today, so
  // the aerobic-decoupling check only appears there, not the coach/team
  // views -- checking someone else's decoupling isn't in scope for v1, and
  // making this optional means those other query sites don't need updating.
  strava_activity_id?: number | null;
};

const METERS_PER_MILE = MILE_METERS;

function formatPace(distanceM: number, timeS: number): string {
  const miles = distanceM / METERS_PER_MILE;
  if (miles <= 0) return "";
  return `${formatClock(timeS / miles)}/mi`;
}

export function CompletionSummary({ completion }: { completion: CompletionDetail }) {
  const parts: string[] = [];
  if (completion.actual_distance_m) parts.push(`${(completion.actual_distance_m / METERS_PER_MILE).toFixed(1)} mi`);
  if (completion.actual_time_s) parts.push(formatClock(completion.actual_time_s));
  if (completion.actual_distance_m && completion.actual_time_s) {
    parts.push(formatPace(completion.actual_distance_m, completion.actual_time_s));
  }
  if (completion.avg_hr) parts.push(`${completion.avg_hr}bpm avg`);
  if (completion.rpe) parts.push(`RPE ${completion.rpe}/10`);

  if (parts.length === 0 && !completion.notes) return null;

  return (
    <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
      {parts.length > 0 && <p>{parts.join(" · ")}</p>}
      {completion.notes && <p className="mt-0.5 italic text-zinc-500 dark:text-zinc-400">&ldquo;{completion.notes}&rdquo;</p>}
      {completion.strava_activity_id && <AerobicDecouplingCheck stravaActivityId={completion.strava_activity_id} />}
    </div>
  );
}
