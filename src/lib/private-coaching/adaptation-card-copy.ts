import { formatMiles } from "@/lib/format";
import type { AdaptationCardRow } from "@/lib/private-coaching/adaptation-cards-service";
import type {
  FatigueEvidenceEntry,
  FitnessUpEvidenceEntry,
  GoingQuietSignal,
  PlanTooLowEvidenceEntry,
} from "@/lib/private-coaching/adaptation-signals";

// Pure presentation layer for a card: turns the stored evidence/action
// jsonb into the plain-language strings the card actually shows. Kept
// separate from the signal engine itself (adaptation-signals.ts) and the
// service layer so the "evidence includes the firing workouts' actual
// figures" requirement is directly, deterministically testable without a
// database.

const SIGNAL_LABELS: Record<AdaptationCardRow["signal"], string> = {
  fitness_up: "Fitness may have moved up",
  fatigue_accumulating: "Fatigue is accumulating",
  plan_too_low: "The plan may be set too low",
  going_quiet: "This athlete is going quiet",
};

export function adaptationSignalLabel(signal: AdaptationCardRow["signal"]): string {
  return SIGNAL_LABELS[signal];
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** One line per firing workout, with its real prescribed/logged figures -- never a summary number in place of the evidence itself. */
export function adaptationEvidenceLines(row: AdaptationCardRow): string[] {
  if (row.signal === "fitness_up") {
    return (row.evidence as FitnessUpEvidenceEntry[]).map(
      (e) => `${formatDate(e.scheduledDate)} ${e.dayLabel ?? "Workout"}: prescribed RPE ${e.prescribedRpe}, logged ${e.loggedRpe}`,
    );
  }
  if (row.signal === "fatigue_accumulating") {
    return (row.evidence as FatigueEvidenceEntry[]).map(
      (e) =>
        `${formatDate(e.scheduledDate)} ${e.dayLabel ?? "Workout"}: ${e.prescribedRpe != null ? `prescribed RPE ${e.prescribedRpe}, ` : ""}logged ${e.loggedRpe}`,
    );
  }
  if (row.signal === "plan_too_low") {
    return (row.evidence as PlanTooLowEvidenceEntry[]).map(
      (e) => `${formatDate(e.scheduledDate)} ${e.dayLabel ?? "Workout"}: planned ${formatMiles(e.plannedDistanceM)}, completed ${formatMiles(e.actualDistanceM)} (+${e.overPercent}%)`,
    );
  }
  const e = row.evidence as GoingQuietSignal["evidence"];
  return [
    `${formatDate(e.windowStart)}–${formatDate(e.windowEnd)}: completed ${e.completedCount} of ${e.scheduledCount} scheduled workouts (${Math.round(e.completionRate * 100)}%)`,
  ];
}

/** The concrete proposed action, stated in plain language -- never generic ("adjust the plan"). */
export function adaptationActionSummary(row: AdaptationCardRow): string {
  if (row.signal === "fitness_up") return "Insert a retest/threshold-check workout (you'll pick the day).";
  if (row.signal === "fatigue_accumulating") {
    const action = row.action as { scheduledDate: string };
    return `Convert the next key session (${formatDate(action.scheduledDate)}) to an easy session.`;
  }
  if (row.signal === "plan_too_low") {
    const action = row.action as { scheduledDate: string; currentDistanceM: number; newDistanceM: number };
    return `Raise the ${formatDate(action.scheduledDate)} workout from ${formatMiles(action.currentDistanceM)} to ${formatMiles(action.newDistanceM)}.`;
  }
  return "Send this athlete a check-in request.";
}
