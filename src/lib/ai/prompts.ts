import type { RetrievedExcerpt } from "@/lib/ai/retrieval";
import type { CoachingContext } from "@/lib/ai/context";
import type { MesocyclePhase, WorkoutType } from "@/lib/coaching-engine";
import { formatDate, formatDistance } from "@/lib/format";

// Keywords to seed retrieval from a workout's own attributes -- there's no
// free-text question yet in this phase (that's Phase 5's conversational
// layer), so the query has to be constructed from what's already known
// about the workout being explained.
const WORKOUT_TYPE_KEYWORDS: Record<WorkoutType, string> = {
  easy: "easy running aerobic conversational effort",
  recovery: "recovery jog cutback easy",
  long: "long run aerobic base durability",
  tempo: "tempo threshold sustained effort",
  vo2: "vo2max interval speed",
  race: "race day pacing execution",
  strength: "strength training",
};

const PHASE_KEYWORDS: Record<MesocyclePhase, string> = {
  base: "aerobic base building volume capillary",
  build: "building threshold work sharpening",
  peak: "race specific peak sharpening",
  taper: "taper reducing volume before race",
  recovery: "cutback recovery week absorbing training",
};

export function buildRetrievalQuery(workoutType: WorkoutType, phase: MesocyclePhase | null): string {
  const parts = [WORKOUT_TYPE_KEYWORDS[workoutType]];
  if (phase) parts.push(PHASE_KEYWORDS[phase]);
  return parts.join(" ");
}

const GUARDRAILS = `You are explaining a single prescribed training session for an athlete using The
Haarchive, a running-coaching platform. Your only job right now is to explain, in plain
language, why today's workout looks the way it does -- not to invent a workout, change one,
or answer unrelated questions.

Ground rules, follow all of them:
- Every number you mention (distance, pace, date) must come from the structured data given
  to you below. Never estimate or invent a number of your own.
- Never state a race-time prediction as a certainty -- always frame it as an estimate if you
  mention one at all.
- Never diagnose an injury or give medical advice. If soreness, pain, or an injury comes up,
  suggest talking to a medical professional -- don't assess it yourself.
- If more than one training philosophy could explain a choice, name the tradeoff rather than
  presenting one approach as universally correct.
- Only attribute a claim to this site's own content if it's actually present in the reference
  excerpts below -- don't invent a source.
- Keep it short: 2-4 sentences, plain language, minimal jargon.`;

function serializeContext(context: CoachingContext): string {
  const lines: string[] = [];

  if (context.goal) {
    const { raceName, distanceM, goalTimeS, goalDate } = context.goal;
    const timePart = goalTimeS ? `, goal time ${Math.round(goalTimeS / 60)} minutes` : "";
    const datePart = goalDate ? `, race day ${formatDate(goalDate)}` : "";
    lines.push(`Goal: ${raceName} (${formatDistance(distanceM)}${timePart}${datePart}).`);
  }

  if (context.workout) {
    const { workoutType, scheduledDate, phase, focusNotes } = context.workout;
    lines.push(`Today's workout: a "${workoutType}" session scheduled for ${formatDate(scheduledDate)}.`);
    if (phase) lines.push(`Training phase: ${phase}.${focusNotes ? ` Focus: ${focusNotes}` : ""}`);
  }

  if (context.recentCompletions.length > 0) {
    lines.push("Recently completed workouts (most recent first):");
    for (const c of context.recentCompletions) {
      const distancePart = c.actualDistanceM ? `${(c.actualDistanceM / 1609.34).toFixed(1)} mi` : "distance not logged";
      const rpePart = c.rpe ? `, RPE ${c.rpe}/10` : "";
      lines.push(`- ${formatDate(c.scheduledDate)}: ${c.workoutType}, ${distancePart}${rpePart}`);
    }
  }

  if (context.recentCheckin) {
    const { fatigue, soreness, sleepQuality, stress } = context.recentCheckin;
    lines.push(
      `Most recent weekly check-in (1-5 scale): fatigue ${fatigue}, soreness ${soreness}, sleep quality ${sleepQuality}, stress ${stress}.`,
    );
  }

  return lines.join("\n");
}

function serializeExcerpts(excerpts: RetrievedExcerpt[]): string {
  if (excerpts.length === 0) return "No specific reference material retrieved for this session.";
  return excerpts
    .map((e, i) => `[${i + 1}] ${e.sectionTitle}${e.heading ? ` -- ${e.heading}` : ""}: ${e.text}`)
    .join("\n");
}

export function buildSystemPrompt(context: CoachingContext, excerpts: RetrievedExcerpt[]): string {
  return [
    GUARDRAILS,
    "",
    "Athlete and workout data:",
    serializeContext(context),
    "",
    "Reference excerpts from this site's own educational content (cite these by number if you use them):",
    serializeExcerpts(excerpts),
  ].join("\n");
}

export const EXPLAIN_WORKOUT_PROMPT = "Explain why today's workout is what it is.";
