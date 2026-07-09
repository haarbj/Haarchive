export type WeekCompletionInput = {
  actualDistanceM: number | null;
  rpe: number | null;
};

export type WeeklySummary = {
  mileageM: number;
  completedCount: number;
  scheduledCount: number;
  longestRunM: number;
  avgRpe: number | null;
  summary: string;
};

// Deterministic and templated, same reasoning as completion-feedback.ts --
// this renders once per athlete per week, but still shouldn't depend on a
// rate-limited AI call for something a few comparisons can already say.
export function summarizeWeek(completions: WeekCompletionInput[], scheduledCount: number): WeeklySummary {
  const mileageM = completions.reduce((sum, c) => sum + (c.actualDistanceM ?? 0), 0);
  const longestRunM = completions.reduce((max, c) => Math.max(max, c.actualDistanceM ?? 0), 0);
  const rpeValues = completions.map((c) => c.rpe).filter((r): r is number => r !== null);
  const avgRpe = rpeValues.length > 0 ? rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length : null;
  const completedCount = completions.length;
  const completionRate = scheduledCount > 0 ? completedCount / scheduledCount : 0;

  let summary: string;
  if (scheduledCount === 0) {
    summary = "No workouts were scheduled this week.";
  } else if (completionRate >= 0.9) {
    summary =
      "Excellent consistency this week. Your training stayed on track, so it's reasonable to keep building from here.";
  } else if (completionRate >= 0.6) {
    summary = "A solid week overall, even with a session or two missed. Consistency over time matters more than any single week.";
  } else if (completedCount > 0) {
    summary = "A lighter week than planned. That happens -- pick back up where the plan left off rather than trying to make up for lost time.";
  } else {
    summary = "No completed workouts logged this week. If something got in the way, the plan will still be here when you're ready.";
  }

  return { mileageM, completedCount, scheduledCount, longestRunM, avgRpe, summary };
}
