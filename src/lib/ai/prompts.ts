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

export function buildRetrievalQuery(
  workoutType: WorkoutType,
  phase: MesocyclePhase | null,
  athleteMessage?: string,
): string {
  const parts = [WORKOUT_TYPE_KEYWORDS[workoutType]];
  if (phase) parts.push(PHASE_KEYWORDS[phase]);
  if (athleteMessage) parts.push(athleteMessage);
  return parts.join(" ");
}

// Shared by both prompts below -- every answer must stay inside these
// rules regardless of which specific job (explaining vs. adapting) it's
// doing. The "keep it short" instruction is deliberately NOT here: it's
// specific to the free-form adaptation reply, and explain-workout has its
// own, more specific format instruction below instead.
const SHARED_GUARDRAILS = `Ground rules, follow all of them:
- Every number you mention (distance, pace, date) must come from the structured data given
  to you below, or from a tool's result. Never estimate or invent a number of your own.
- Never state a race-time prediction as a certainty -- always frame it as an estimate if you
  mention one at all.
- Never diagnose an injury or give medical advice. If soreness, pain, or an injury comes up,
  suggest talking to a medical professional -- don't assess it yourself.
- If more than one training philosophy could explain a choice, name the tradeoff rather than
  presenting one approach as universally correct.
- Only attribute a claim to this site's own content if it's actually present in the reference
  excerpts below -- don't invent a source.`;

const GUARDRAILS = `You are explaining a single prescribed training session for an athlete using The
Haarchive, a running-coaching platform. Your only job right now is to explain, in plain
language, why today's workout looks the way it does -- not to invent a workout, change one,
or answer unrelated questions.

You must write all five of the following lines, every time, in this exact order, and nothing
else -- no headers, no preamble, no markdown, no restating the label's instructions. Replace
each <bracketed> placeholder with 1-2 plain-language sentences of your own and write only
that on the line, nothing more:
GOAL: <what this specific session is meant to accomplish>
WHY: <why it belongs today, given the training phase and recent training -- ground this in
  the retrieved reference excerpts below when one is actually relevant to this workout; if
  none of the excerpts fit, fall back to classic Lydiard-style periodization reasoning
  (aerobic base before sharpening, hard/easy alternation, a gradual build toward a specific
  race) instead, without claiming that reasoning came from this site's own content>
FEEL: <what effort or sensation the athlete should expect during the session>
MISTAKE: <the most common way athletes get this specific type of session wrong>
RECOVERY: <what to do afterward to absorb the work>
Do not stop after only some of these lines -- a response missing GOAL, WHY, FEEL, MISTAKE, or
RECOVERY is incomplete and unusable.

${SHARED_GUARDRAILS}`;

function serializeContext(context: CoachingContext): string {
  const lines: string[] = [];

  if (context.goal) {
    const { raceName, distanceM, goalTimeS, goalDate } = context.goal;
    const timePart = goalTimeS ? `, goal time ${Math.round(goalTimeS / 60)} minutes` : "";
    const datePart = goalDate ? `, race day ${formatDate(goalDate)}` : "";
    lines.push(`Goal: ${raceName} (${formatDistance(distanceM)}${timePart}${datePart}).`);
  }

  if (context.workout) {
    const { workoutType, scheduledDate, phase, focusNotes, displayPhaseName, phasePrimaryGoal } = context.workout;
    lines.push(`Today's workout: a "${workoutType}" session scheduled for ${formatDate(scheduledDate)}.`);
    if (phase) {
      const phaseLabel = displayPhaseName ? `${displayPhaseName} (${phase})` : phase;
      lines.push(`Training phase: ${phaseLabel}.${focusNotes ? ` Focus: ${focusNotes}` : ""}`);
    }
    if (phasePrimaryGoal) lines.push(`This phase's primary goal: ${phasePrimaryGoal}.`);
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

function buildDataBlock(context: CoachingContext, excerpts: RetrievedExcerpt[]): string {
  return [
    "Athlete and workout data:",
    serializeContext(context),
    "",
    "Reference excerpts from this site's own educational content (cite these by number if you use them):",
    serializeExcerpts(excerpts),
  ].join("\n");
}

export function buildSystemPrompt(context: CoachingContext, excerpts: RetrievedExcerpt[]): string {
  return [GUARDRAILS, "", buildDataBlock(context, excerpts)].join("\n");
}

export const EXPLAIN_WORKOUT_PROMPT = "Explain why today's workout is what it is.";

const ADAPTATION_INSTRUCTIONS = `An athlete using The Haarchive, a running-coaching platform, has told you something
about today that might call for adjusting today's prescribed workout. You have tools that
can propose a specific, deterministic change -- compressWorkout (not enough time),
substituteForSurface (no track access), insertRecoveryDay (missed a day, feeling run-down,
or anything else that calls for backing off), and adjustForHeat (checks the actual forecast
for wherever the athlete says they're running and adjusts for heat if conditions call for
it -- ask for their city if they mention heat but don't say where). Recognize the athlete's
intent and call the matching tool if one applies -- never invent a new workout or new
numbers yourself, that's exactly what the tools are for. If nothing the athlete said
actually calls for a change, just say so in plain language and don't call a tool at all.

Always finish with a short plain-language reply for the athlete to read, even after calling
a tool -- a tool call on its own is not a response. Base that reply specifically on the
numbers and guidance the tool actually returned, not your own substitute suggestion -- if
substituteForSurface returns a guidance string, restate that guidance, don't invent a
different workaround (like a different route or terrain) instead of it.

${SHARED_GUARDRAILS}
- Keep it short: 2-4 sentences, plain language, minimal jargon.`;

export function buildAdaptationSystemPrompt(context: CoachingContext, excerpts: RetrievedExcerpt[]): string {
  return [ADAPTATION_INSTRUCTIONS, "", buildDataBlock(context, excerpts)].join("\n");
}

// Editorial assistant for the Questions dashboard -- helps Brody (the site
// owner, the only person who sees this) turn a reader question into either
// an expansion of an existing article or a brand-new one. The output is a
// draft for a human editor to revise, not something that gets auto-published
// -- sections.ts is a hand-authored, git-committed file, not a CMS. The
// prompt says this explicitly so the model doesn't overreach into a
// finished-feeling "final" voice it hasn't earned.
export type ContentSuggestionQuestion = {
  title: string;
  description: string | null;
  type: "question" | "topic_suggestion";
  category: string | null;
};

const CONTENT_SUGGESTION_INSTRUCTIONS = `You are an editorial assistant for The Haarchive, a running-education website written in
the voice of one experienced, opinionated coach -- not a textbook, not a listicle. You're
helping the site's single author turn a reader's question or topic suggestion into a content
draft. Nobody but the author will read your output; it is a starting draft for them to revise,
not a finished article and not something that gets published automatically.

Write in the site's established voice: explain mechanisms and the "why," not just the "what";
name tradeoffs and coaching implications; avoid textbook throat-clearing ("In this article we
will discuss..."); cite real research by author/year when you reference a specific finding,
and say plainly when you're drawing on general training knowledge instead.

${SHARED_GUARDRAILS}
- If the question is too vague or too narrow to justify real content, say so plainly in the
  outline rather than padding out a draft that shouldn't exist.`;

function serializeQuestion(question: ContentSuggestionQuestion): string {
  const lines = [
    `Reader ${question.type === "topic_suggestion" ? "topic suggestion" : "question"}: ${question.title}`,
  ];
  if (question.description) lines.push(`Additional detail from the reader: ${question.description}`);
  if (question.category) lines.push(`Reader-suggested category: ${question.category}`);
  return lines.join("\n");
}

export function buildContentSuggestionPrompt(
  question: ContentSuggestionQuestion,
  excerpts: RetrievedExcerpt[],
  mode: "expand" | "new_article",
): string {
  const modeInstruction =
    mode === "expand"
      ? "The author believes this belongs inside an existing page rather than as a new one. Identify which existing page (by title) it should extend, and draft the new section/paragraphs to add -- not a whole new article."
      : "The author believes this deserves a brand-new page. Recommend where it belongs in the site's category structure and draft a full first-pass article.";

  return [
    CONTENT_SUGGESTION_INSTRUCTIONS,
    "",
    modeInstruction,
    "",
    serializeQuestion(question),
    "",
    "Existing site content most relevant to this topic (cite/build on these where they genuinely overlap; don't repeat them verbatim):",
    serializeExcerpts(excerpts),
  ].join("\n");
}
