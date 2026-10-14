// The core logic behind Coach Home -- "who needs my attention today,"
// not a chart dashboard (see the product brief's own framing). A pure
// function over a plain per-athlete signal summary, so the actual
// triage rules are unit-testable without touching Supabase, and so the
// page component stays a thin "fetch signals, call this, render" shell.

export type AttentionReason =
  | "missed_workout"
  | "pain_reported"
  | "unusual_rpe"
  | "unread_message"
  | "missing_checkin";

export type AttentionFlag = {
  reason: AttentionReason;
  detail: string;
  // high: needs a real look today. medium: worth a glance. Ordering below
  // is itself the triage -- pain and missed work outrank an unread "hey,
  // question about Thursday."
  severity: "high" | "medium";
};

export type AthleteAttentionInput = {
  missedWorkoutCount: number;
  recentPainReportCount: number;
  highRpeCount: number;
  unreadMessageCount: number;
  hasCurrentWeekCheckin: boolean;
  // Whether this athlete has been coached long enough that a missing
  // check-in is actually meaningful -- a brand-new athlete invited three
  // days ago hasn't had a real chance to submit one yet.
  daysSinceRelationshipStarted: number;
};

const HIGH_RPE_THRESHOLD = 9;
const CHECKIN_GRACE_PERIOD_DAYS = 7;

export function computeAttentionFlags(input: AthleteAttentionInput): AttentionFlag[] {
  const flags: AttentionFlag[] = [];

  if (input.recentPainReportCount > 0) {
    flags.push({
      reason: "pain_reported",
      detail: input.recentPainReportCount === 1 ? "Pain reported" : `Pain reported ${input.recentPainReportCount} times`,
      severity: "high",
    });
  }

  if (input.missedWorkoutCount > 0) {
    flags.push({
      reason: "missed_workout",
      detail: input.missedWorkoutCount === 1 ? "1 missed workout" : `${input.missedWorkoutCount} missed workouts`,
      severity: input.missedWorkoutCount >= 2 ? "high" : "medium",
    });
  }

  if (input.highRpeCount > 0) {
    flags.push({
      reason: "unusual_rpe",
      detail: `RPE ${HIGH_RPE_THRESHOLD}+ on ${input.highRpeCount === 1 ? "a recent workout" : `${input.highRpeCount} recent workouts`}`,
      severity: "medium",
    });
  }

  if (input.unreadMessageCount > 0) {
    flags.push({
      reason: "unread_message",
      detail: input.unreadMessageCount === 1 ? "1 unread message" : `${input.unreadMessageCount} unread messages`,
      severity: "medium",
    });
  }

  if (!input.hasCurrentWeekCheckin && input.daysSinceRelationshipStarted > CHECKIN_GRACE_PERIOD_DAYS) {
    flags.push({ reason: "missing_checkin", detail: "No check-in this week", severity: "medium" });
  }

  // High severity first, then insertion order within a severity (pain
  // before missed work before everything else, matching push order above).
  return flags.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));
}

export function isHighRpe(rpe: number | null): boolean {
  return rpe !== null && rpe >= HIGH_RPE_THRESHOLD;
}
