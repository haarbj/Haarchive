// Pure, deterministic Learning Progress scoring -- the same "a unit test
// can verify every number on screen" standard as src/lib/coaching-engine.
// No DB access here: this only ever operates on an already-fetched list of
// events for one (user, topic) pair. The caller (learning-actions.ts)
// fetches learning_events and writes the result into user_topic_mastery,
// which stays a recomputable cache, never a hand-edited source of truth.
//
// Two independent guardrails, both explicit boolean gates rather than
// emergent properties of score weights (weights can be retuned freely
// without risking either guarantee -- the gates are what tests assert
// against):
//   - passive reading alone must never reach Proficient/Advanced/Mastered
//     (`hasActiveSignal`, Phase 1).
//   - Mastered requires *verified* understanding, not just enough active
//     engagement to already qualify as Advanced -- reading, notes, tool
//     use, and revisits can carry a topic up through Advanced, but only a
//     correctly-answered knowledge check can cross into Mastered (Phase 2,
//     see the knowledge-check gates below).

export type MasteryLevel = "exploring" | "familiar" | "proficient" | "advanced" | "mastered";

export type LearningEventType =
  | "content_viewed"
  | "content_engaged"
  | "note_taken"
  | "topic_revisited"
  | "concept_engaged"
  | "tool_used"
  | "knowledge_check_answered";

export type KnowledgeCheckMetadata = {
  questionId?: string;
  selectedOptionId?: string;
  correct?: boolean;
  attemptNumber?: number;
};

export type MasteryEvent = {
  eventType: string;
  conceptId?: string | null;
  createdAt: string | Date;
  // Only meaningful for "knowledge_check_answered" -- every other event
  // type ignores this. Optional because every event before Phase 2 never
  // carried metadata at all.
  metadata?: KnowledgeCheckMetadata | Record<string, unknown> | null;
};

export type MasteryResult = {
  // 0-100, internal only. Never render this number directly in the UI --
  // it exists so thresholds have room to be tuned without every level
  // boundary needing a separate hand-picked cutoff. See learning-progress.tsx.
  score: number;
  level: MasteryLevel;
  // Everything below is exposed so the UI can explain *why* a topic is at
  // its current level (see mastery-explanation.ts) without duplicating any
  // of this scoring logic -- these are the same values computeMastery
  // already derives internally to decide `level`, just no longer thrown
  // away. None of these are new scoring concepts; this is the existing
  // algorithm made legible, not a second one.
  hasActiveSignal: boolean;
  activeSignalCount: number;
  conceptCount: number;
  knowledgeCheckAttempted: number;
  knowledgeCheckCorrect: number;
  // null (not 0) when nothing has been attempted yet -- 0% accuracy would
  // falsely imply failed attempts that never happened.
  knowledgeCheckAccuracy: number | null;
};

const WEIGHT_FIRST_VIEW = 10;
const WEIGHT_DEEP_ENGAGEMENT = 8;
const WEIGHT_NOTE = 12;
const WEIGHT_REVISIT = 10;
const WEIGHT_CONCEPT = 6;
const WEIGHT_TOOL = 8;

// A correct answer on the first attempt is a stronger signal than one that
// took retries (the second, reduced weight below) -- "resistant to
// guessing" without punishing retries: an incorrect attempt never
// subtracts anything, it just means the eventual correct answer is worth
// less. Applied once per *distinct* question (see distinctKnowledgeCheck
// below), never per attempt, and never diminished further across multiple
// different questions -- unlike notes/revisits/concepts, this set is
// small and curated (2-3 questions per topic) by design, so it doesn't
// need the same unbounded-repetition guard.
const WEIGHT_KNOWLEDGE_CHECK_FIRST_TRY = 15;
const WEIGHT_KNOWLEDGE_CHECK_RETRY = WEIGHT_KNOWLEDGE_CHECK_FIRST_TRY * 0.5;

// Passive signals (content_viewed, content_engaged) can never contribute
// more than this to the total score -- well under the Proficient
// threshold, so even unlimited reading days can't cross it on score alone.
// The `hasActiveSignal` gate below is the second, independent enforcement
// of the same rule.
const PASSIVE_SCORE_CAP = 30;

const FAMILIAR_THRESHOLD = 20;
const PROFICIENT_THRESHOLD = 45;
const ADVANCED_THRESHOLD = 75;

// Mastered's own additional gates, on top of everything Advanced already
// requires (see the `level === "advanced"` prerequisite in computeMastery
// below) -- both explicit, both required, neither expressible as a score
// threshold alone:
//   - breadth: guessing your way through one question, once, isn't
//     "demonstrated understanding across the topic."
//   - accuracy: computed over *distinct questions attempted*, not raw
//     attempts, so retrying a missed question until it's right doesn't
//     silently repair your rate the way retrying-to-inflate-the-numerator
//     alone would.
// Exported -- mastery-explanation.ts imports this exact constant rather
// than hand-redeclaring it, so the "one more correct answer" / "answer one
// correctly" copy can never drift from the real gate below.
export const MASTERED_MIN_DISTINCT_CORRECT = 2;
const MASTERED_MIN_ACCURACY = 0.8;

// Each additional occurrence of the same repeatable signal is worth less,
// floored at 25% of the base weight -- diminishing returns after roughly
// 3-4 occurrences, per the feature spec (spaced returns and notes both use
// this), without a hard cutoff that would stop rewarding real continued
// engagement entirely.
function diminishing(base: number, occurrenceIndex: number): number {
  return Math.max(base * 0.25, base / (1 + occurrenceIndex * 0.75));
}

function toDateKey(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

function sortByTime(events: MasteryEvent[]): MasteryEvent[] {
  return [...events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

// Collapses same-day duplicates for a day-scoped signal, keeping only the
// earliest per calendar day. The database also enforces this (see the
// learning_progress migration's partial unique indexes), but the algorithm
// stays correct on its own so a test can exercise the guarantee directly
// without going through Postgres, and so recomputation is safe even
// against old data from before the constraint existed.
function distinctDays(events: MasteryEvent[]): MasteryEvent[] {
  const seen = new Set<string>();
  const out: MasteryEvent[] = [];
  for (const event of sortByTime(events)) {
    const key = toDateKey(event.createdAt);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(event);
  }
  return out;
}

function distinctConcepts(events: MasteryEvent[]): string[] {
  const seen = new Set<string>();
  for (const event of sortByTime(events)) {
    if (event.conceptId) seen.add(event.conceptId);
  }
  return [...seen];
}

function knowledgeCheckMetadata(event: MasteryEvent): KnowledgeCheckMetadata {
  return (event.metadata ?? {}) as KnowledgeCheckMetadata;
}

// Per distinct question: whether it was ever answered correctly, and if
// so, whether that first correct answer was a first-try answer or came
// after a retry. Malformed events (no questionId, e.g. from data that
// predates this metadata shape) are safely ignored rather than thrown on.
function summarizeKnowledgeChecks(events: MasteryEvent[]): {
  distinctAttempted: number;
  distinctCorrect: number;
  correctFirstTryQuestionIds: string[];
  correctRetryQuestionIds: string[];
} {
  const attempted = new Map<string, { anyCorrect: boolean; firstCorrectAttempt: number | null }>();

  for (const event of sortByTime(events)) {
    const meta = knowledgeCheckMetadata(event);
    if (!meta.questionId) continue;

    const existing = attempted.get(meta.questionId) ?? { anyCorrect: false, firstCorrectAttempt: null };
    if (meta.correct && !existing.anyCorrect) {
      existing.anyCorrect = true;
      existing.firstCorrectAttempt = meta.attemptNumber ?? null;
    }
    attempted.set(meta.questionId, existing);
  }

  const correctFirstTryQuestionIds: string[] = [];
  const correctRetryQuestionIds: string[] = [];
  for (const [questionId, info] of attempted) {
    if (!info.anyCorrect) continue;
    if (info.firstCorrectAttempt === 1) correctFirstTryQuestionIds.push(questionId);
    else correctRetryQuestionIds.push(questionId);
  }

  return {
    distinctAttempted: attempted.size,
    distinctCorrect: correctFirstTryQuestionIds.length + correctRetryQuestionIds.length,
    correctFirstTryQuestionIds,
    correctRetryQuestionIds,
  };
}

export function computeMastery(events: MasteryEvent[]): MasteryResult {
  if (events.length === 0) {
    return {
      score: 0,
      level: "exploring",
      hasActiveSignal: false,
      activeSignalCount: 0,
      conceptCount: 0,
      knowledgeCheckAttempted: 0,
      knowledgeCheckCorrect: 0,
      knowledgeCheckAccuracy: null,
    };
  }

  const byType = (type: LearningEventType) =>
    events.filter((e) => e.eventType === type);

  const viewed = byType("content_viewed");
  const engagedDays = distinctDays(byType("content_engaged"));
  // Phase 3.1 audit: note_taken has no DB-level "once ever" cap (retaking
  // multiple genuine notes on a topic over time is legitimate), but until
  // this fix it had no day-scoping either -- unlike every other repeatable
  // signal here. Since the diminishing-returns curve floors at 25% of base
  // weight rather than zero (see `diminishing`'s own comment), an unbounded
  // same-day count meant N trivial 15-character notes posted in one
  // sitting could buy real score and activeSignalCount, with no need to
  // ever come back on a different day -- the one gap in what's otherwise a
  // "trivial repetition can't masquerade as learning" guarantee across the
  // whole algorithm. distinctDays() closes it the same way it already does
  // for topic_revisited, and a matching DB index now backs it (see the
  // learning_progress migration this phase adds).
  const notes = distinctDays(byType("note_taken"));
  const revisitDays = distinctDays(byType("topic_revisited"));
  const concepts = distinctConcepts(byType("concept_engaged"));
  const toolUsed = byType("tool_used").length > 0;
  const knowledgeChecks = summarizeKnowledgeChecks(byType("knowledge_check_answered"));

  let passiveScore = 0;
  if (viewed.length > 0) passiveScore += WEIGHT_FIRST_VIEW;
  engagedDays.forEach((_, i) => {
    passiveScore += diminishing(WEIGHT_DEEP_ENGAGEMENT, i);
  });
  passiveScore = Math.min(passiveScore, PASSIVE_SCORE_CAP);

  let activeScore = 0;
  notes.forEach((_, i) => {
    activeScore += diminishing(WEIGHT_NOTE, i);
  });
  revisitDays.forEach((_, i) => {
    activeScore += diminishing(WEIGHT_REVISIT, i);
  });
  concepts.forEach((_, i) => {
    activeScore += diminishing(WEIGHT_CONCEPT, i);
  });
  if (toolUsed) activeScore += WEIGHT_TOOL;
  // Each distinct correctly-answered question contributes once, at full or
  // half weight depending on first-try-or-not (see the weight constants'
  // own comment) -- re-answering a question already answered correctly
  // contributes nothing further, since it isn't tracked as a "new"
  // distinct correct question at all.
  activeScore +=
    knowledgeChecks.correctFirstTryQuestionIds.length * WEIGHT_KNOWLEDGE_CHECK_FIRST_TRY +
    knowledgeChecks.correctRetryQuestionIds.length * WEIGHT_KNOWLEDGE_CHECK_RETRY;

  const score = Math.min(100, Math.round(passiveScore + activeScore));

  // The explicit guardrail: reading (content_viewed/content_engaged) alone
  // never sets this to true, so Proficient and above are structurally
  // unreachable from passive engagement no matter how score weights are
  // tuned later.
  const hasActiveSignal = activeScore > 0;
  const activeSignalCount =
    notes.length + revisitDays.length + concepts.length + (toolUsed ? 1 : 0) + knowledgeChecks.distinctCorrect;

  let level: MasteryLevel = "exploring";
  if (score >= FAMILIAR_THRESHOLD) level = "familiar";
  if (score >= PROFICIENT_THRESHOLD && hasActiveSignal) level = "proficient";
  if (
    score >= ADVANCED_THRESHOLD &&
    hasActiveSignal &&
    (concepts.length >= 2 || activeSignalCount >= 4)
  ) {
    level = "advanced";
  }

  // Mastered: everything Advanced already requires (the `level ===
  // "advanced"` check below, not a re-derived score/activity threshold),
  // plus verified understanding. A topic with zero knowledge checks has
  // distinctAttempted === 0 forever, so hasKnowledgeCheckAccuracy is never
  // true and Mastered stays permanently unreachable there -- exactly the
  // same as today, no regression for the ~36 topics with no curated
  // questions yet.
  const hasKnowledgeCheckBreadth = knowledgeChecks.distinctCorrect >= MASTERED_MIN_DISTINCT_CORRECT;
  const hasKnowledgeCheckAccuracy =
    knowledgeChecks.distinctAttempted > 0 &&
    knowledgeChecks.distinctCorrect / knowledgeChecks.distinctAttempted >= MASTERED_MIN_ACCURACY;

  if (level === "advanced" && hasKnowledgeCheckBreadth && hasKnowledgeCheckAccuracy) {
    level = "mastered";
  }

  return {
    score,
    level,
    hasActiveSignal,
    activeSignalCount,
    conceptCount: concepts.length,
    knowledgeCheckAttempted: knowledgeChecks.distinctAttempted,
    knowledgeCheckCorrect: knowledgeChecks.distinctCorrect,
    knowledgeCheckAccuracy:
      knowledgeChecks.distinctAttempted > 0 ? knowledgeChecks.distinctCorrect / knowledgeChecks.distinctAttempted : null,
  };
}
