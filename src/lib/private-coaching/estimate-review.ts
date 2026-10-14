// Part F: the fitness-estimate review.
//
// Pure, DB-free, coach-only, and advisory: it proposes a revised estimate
// and shows which sessions drove it. The coach confirms before anything is
// written. An athlete never sees any of this -- their own estimate stays
// theirs to edit (see fitness-estimates.ts).
//
// WHAT THE LOGGED DATA CAN AND CANNOT SUPPORT. This is the central design
// constraint and it is worth stating plainly, because it decides what this
// module is allowed to claim.
//
// completed_workouts stores ONE distance and ONE duration for a whole
// session. A framework session is usually "2 mi progressive warm-up +
// 4 strides / 10 mi at 100% MP / 1 mi easy cool-down", so its average pace
// is a blend of three different intensities. There is no arithmetic that
// recovers the main set's pace from that blend without knowing the warm-up
// and cool-down paces, which are not recorded. So:
//
//   * Where a session's prescription is a SINGLE continuous pace clause and
//     nothing else, the implied reference pace is computed EXACTLY, with
//     computeReferencePaceSeconds (the established inverse of the
//     percent-of-pace formula this platform already prescribes with). No
//     new math, no fitted coefficients.
//
//   * Where it is not -- which is most framework sessions -- this module
//     does NOT invent a pace. It reports a DIRECTION ("the prescribed paces
//     are landing harder than prescribed") from how the sessions felt
//     against their prescribed difficulty, and says in as many words that
//     the data cannot support a precise revision, leaving the number to the
//     coach.
//
// The alternative would be to multiply an RPE gap by some
// seconds-per-RPE-point constant. There is no such constant in this
// codebase, nothing in the methodology supplies one, and inventing one
// would put a number on a coach's screen that looks derived and is not.
// A clearly-labelled direction is more useful than a precise-looking guess.

import { computeReferencePaceSeconds } from "@/lib/pace-percent-math";
import { phaseFamily, type PhaseFamily } from "@/lib/private-coaching/adjustment-playbook";
import { extractPacePercents, type PacePercentBasis, type PacePercentTarget } from "@/lib/private-coaching/plan-health";
import { MILE_METERS } from "@/lib/race-distances";

export type ReviewSession = {
  id: string;
  scheduledDate: string;
  dayLabel: string | null;
  prescription: string | null;
  /** Prescribed difficulty, as the plan asked for it. */
  plannedRpe: number | null;
  plannedRpeMax: number | null;
  phaseKey: string | null;
  isOptional: boolean;
  // --- what the athlete logged ---
  actualDistanceM: number | null;
  actualDurationS: number | null;
  /** How hard it actually felt, 1-10. */
  rpe: number | null;
  effortLevel: string | null;
  conditionsNotes: string | null;
  painReported: boolean;
};

/**
 * Which pace band is the real evidence for each phase.
 *
 * General training is indexed on 5K pace, and the sessions that say
 * something about that index are the ones run near it. Supportive and
 * specific work is indexed on marathon pace, and the informative band is
 * the one the race is actually rehearsed in.
 */
export const EVIDENCE_BANDS: Record<Exclude<PhaseFamily, "unknown">, { basis: PacePercentBasis; min: number; max: number }> = {
  general: { basis: "5k", min: 90, max: 100 },
  supportive: { basis: "marathon", min: 90, max: 105 },
  specific: { basis: "marathon", min: 90, max: 105 },
};

/**
 * Weight multipliers, stated here rather than inline so the whole scheme
 * can be read in one place.
 *
 * TWO WEIGHTS, NOT ONE, and the reason matters. A first version used a
 * single weight and down-weighted any session whose effort came in well
 * above the prescribed difficulty, as a "hero effort". That is wrong for
 * half of this module's job: a session run at the prescribed pace that
 * felt two points harder than prescribed is not noise, it is the single
 * clearest sign the estimate is optimistic. Down-weighting it deleted
 * exactly the evidence the review exists to find, and the tests caught it
 * by producing "not enough evidence" from two unambiguous sessions.
 *
 * So the two questions are weighted separately:
 *
 *   directionWeight -- how much this session's effort-versus-prescription
 *     gap should count toward "is the estimate fast or slow". Reduced only
 *     by things that make the gap itself untrustworthy: a day the athlete
 *     flagged, reported pain, or a prescription outside the band that
 *     indexes this phase. The SIZE of the gap never reduces this; that
 *     would be circular.
 *
 *   paceWeight -- how much this session's own result should count toward a
 *     proposed NUMBER. Here a hero effort genuinely does mislead: an
 *     athlete who buries themselves to hold a pace produces an implied
 *     reference that flatters them, so it counts for much less.
 */
export const WEIGHTS = {
  /** A session squarely in its phase's evidence band. */
  inBand: 1,
  /** Near the band but outside it: weak evidence, not none. */
  adjacent: 0.4,
  /** Pace evidence where effort and prescribed difficulty agreed within a point. */
  paceDifficultyMatched: 1,
  /** Pace evidence where they drifted by more than a point. */
  paceDifficultyDrifted: 0.6,
  /** Pace evidence from a session run two or more points harder than prescribed. */
  paceHeroEffort: 0.3,
  /** Conditions the athlete flagged themselves. */
  statedConditions: 0.5,
  /** Pain was reported. */
  pain: 0.2,
} as const;

/**
 * Words that mean "this day was not clean evidence", scanned in the
 * athlete's own conditions note.
 *
 * A keyword scan, used ONLY to down-weight. It never excludes a session and
 * never changes a pace, so a false positive costs a little confidence and
 * nothing else -- which is the right trade for reading free prose. The list
 * is deliberately visible and editable rather than buried in a regex.
 */
export const ADVERSE_CONDITION_WORDS = [
  "hot", "heat", "humid", "humidity", "wind", "windy", "gale",
  "cold", "snow", "ice", "icy", "rain", "storm",
  "sick", "ill", "illness", "cough", "cold symptoms", "fever",
  "tired", "exhausted", "fatigued", "sore", "stressed", "stress",
  "poor sleep", "no sleep", "slept badly", "travel", "jet lag", "altitude",
  "hilly", "hills", "trail", "treadmill",
];

export function hasAdverseConditions(note: string | null | undefined): boolean {
  if (!note) return false;
  const value = note.toLowerCase();
  return ADVERSE_CONDITION_WORDS.some((word) => value.includes(word));
}

export type SessionWeighting = {
  session: ReviewSession;
  /** Toward "is the estimate fast or slow". See WEIGHTS. */
  weight: number;
  /** Toward a proposed number. Never larger than `weight`. */
  paceWeight: number;
  /** Which target made this session relevant, when one did. */
  band: PacePercentTarget | null;
  /** Plain-language reasons, shown to the coach so the weighting is never a black box. */
  reasons: string[];
};

function prescribedDifficulty(session: ReviewSession): number | null {
  // The top of a prescribed range is the honest comparison point: a
  // session written "7-8/10" is not supposed to feel like a 7.
  return session.plannedRpeMax ?? session.plannedRpe;
}

/**
 * How much a single logged session should count, and why.
 *
 * Weight 0 means "tells us nothing about this estimate" -- an easy run, an
 * optional session, or one never completed. Those are excluded rather than
 * counted at a low weight, because including them would let sheer volume of
 * easy running outvote the handful of sessions that are actually evidence.
 */
export function weighSession(session: ReviewSession, phaseKeyOverride?: string | null): SessionWeighting {
  const reasons: string[] = [];
  const family = phaseFamily(phaseKeyOverride ?? session.phaseKey);

  if (session.isOptional) return { session, weight: 0, paceWeight: 0, band: null, reasons: ["Optional session."] };
  if (session.rpe == null) {
    return { session, weight: 0, paceWeight: 0, band: null, reasons: ["No effort logged, so nothing to read."] };
  }
  if (family === "unknown") {
    return { session, weight: 0, paceWeight: 0, band: null, reasons: ["Not in a general, supportive or specific phase."] };
  }

  const evidence = EVIDENCE_BANDS[family];
  const targets = extractPacePercents(session.prescription).filter((t) => t.basis === evidence.basis);
  if (targets.length === 0) {
    return {
      session,
      weight: 0,
      paceWeight: 0,
      band: null,
      reasons: [`Prescribes no ${evidence.basis === "5k" ? "5K" : "marathon"}-pace target.`],
    };
  }

  const inBand = targets.find((t) => t.max >= evidence.min && t.min <= evidence.max) ?? null;
  // "Adjacent" is within ten percentage points of the band: close enough to
  // say something, far enough that it should not drive the number.
  const adjacent = inBand
    ? null
    : (targets.find((t) => t.max >= evidence.min - 10 && t.min <= evidence.max + 10) ?? null);
  const band = inBand ?? adjacent;
  if (!band) {
    return {
      session,
      weight: 0,
      paceWeight: 0,
      band: null,
      reasons: ["Prescribed pace is too far from the band that indexes this phase."],
    };
  }

  let weight = inBand ? WEIGHTS.inBand : WEIGHTS.adjacent;
  reasons.push(
    inBand
      ? `Prescribed at ${formatBand(band)}, squarely in the band this phase is indexed on.`
      : `Prescribed at ${formatBand(band)}, near but outside the band this phase is indexed on.`,
  );

  // The difficulty gap only ever scales the PACE weight. See WEIGHTS.
  let paceFactor: number;
  const prescribed = prescribedDifficulty(session);
  if (prescribed == null) {
    paceFactor = WEIGHTS.paceDifficultyDrifted;
    reasons.push("No prescribed difficulty to compare the effort against.");
  } else {
    const gap = session.rpe - prescribed;
    if (gap >= 2) {
      paceFactor = WEIGHTS.paceHeroEffort;
      reasons.push(
        `Ran ${gap} points harder than prescribed. Strong evidence about the estimate's direction; weak evidence for a number, since burying yourself to hold a pace flatters it.`,
      );
    } else if (Math.abs(gap) <= 1) {
      paceFactor = WEIGHTS.paceDifficultyMatched;
      reasons.push("Effort matched the prescribed difficulty.");
    } else {
      paceFactor = WEIGHTS.paceDifficultyDrifted;
      reasons.push(`Felt ${Math.abs(gap)} points ${gap > 0 ? "harder" : "easier"} than prescribed.`);
    }
  }

  if (session.painReported) {
    weight *= WEIGHTS.pain;
    reasons.push("Pain was reported on this session.");
  }
  if (hasAdverseConditions(session.conditionsNotes)) {
    weight *= WEIGHTS.statedConditions;
    reasons.push("The athlete flagged conditions on this day.");
  }

  return { session, weight, paceWeight: weight * paceFactor, band, reasons };
}

function formatBand(target: PacePercentTarget): string {
  const percent = target.min === target.max ? `${target.min}%` : `${target.min}-${target.max}%`;
  return `${percent} ${target.basis === "5k" ? "5K pace" : "marathon pace"}`;
}

// ---------------------------------------------------------------------------
// Exact implied reference, where the data genuinely supports one
// ---------------------------------------------------------------------------

/**
 * Is this prescription a single continuous pace clause and nothing else?
 *
 * That is the only shape whose logged average pace can be attributed to the
 * prescribed target. A warm-up, a cool-down, intervals, strides or a second
 * pace segment all mean the recorded average is a blend.
 */
const SINGLE_SEGMENT = /^\s*\d+(?:\.\d+)?(?:\s*[-–—]\s*\d+(?:\.\d+)?)?\s*(?:mi|km)\s+at\s+\d{2,3}(?:\s*[-–—]\s*\d{2,3})?\s*%\s*(?:MP|5k)(?:\s+pace)?\s*$/i;

export function isSingleSegmentSession(prescription: string | null | undefined): boolean {
  if (!prescription) return false;
  // An ALLOWLIST, not a blocklist. A blocklist of "warm-up", "strides",
  // "jog" and so on was tried first and let real sessions through that are
  // nothing like a single pace: "6-8 mi easy with 28 min of (1 min at ~95%
  // 5k effort, 3 min easy) in the middle" contains exactly one percentage
  // and none of the blocked words, so it looked single-segment and would
  // have had an entire easy run's average pace attributed to a 95% 5K
  // target. Here a wrong match produces a wrong NUMBER on a coach's
  // screen, so the test has to be "the whole string is one pace clause",
  // with anything unrecognised failing closed.
  return SINGLE_SEGMENT.test(prescription.trim());
}

/**
 * The reference pace a session's own result implies, in seconds per mile,
 * or null when the data cannot support one.
 *
 * Exact: the percent-of-pace formula this platform prescribes with, run
 * backwards. The midpoint of a prescribed range is used when the
 * prescription is a range, which is the only assumption here and is stated
 * in the returned reasoning.
 */
export function impliedReferenceSecondsPerMile(session: ReviewSession): { basis: PacePercentBasis; secondsPerMile: number } | null {
  if (!isSingleSegmentSession(session.prescription)) return null;
  if (session.actualDistanceM == null || session.actualDurationS == null) return null;
  if (session.actualDistanceM <= 0 || session.actualDurationS <= 0) return null;

  const [target] = extractPacePercents(session.prescription);
  if (!target) return null;

  const actualSecondsPerMile = (session.actualDurationS / session.actualDistanceM) * MILE_METERS;
  const percent = (target.min + target.max) / 2;
  // 200% of pace would be a zero-length reference; nothing real reaches it,
  // but guard rather than divide by zero.
  if (percent >= 200) return null;

  return { basis: target.basis, secondsPerMile: computeReferencePaceSeconds(actualSecondsPerMile, percent, "pace") };
}

/** Weighted median -- "the typical day", not the best one and not an average a single hero session can drag. */
export function weightedMedian(values: { value: number; weight: number }[]): number | null {
  const usable = values.filter((v) => v.weight > 0 && Number.isFinite(v.value)).sort((a, b) => a.value - b.value);
  if (usable.length === 0) return null;
  const total = usable.reduce((sum, v) => sum + v.weight, 0);
  let running = 0;
  for (const entry of usable) {
    running += entry.weight;
    if (running >= total / 2) return entry.value;
  }
  return usable[usable.length - 1].value;
}

// ---------------------------------------------------------------------------
// The review itself
// ---------------------------------------------------------------------------

export type EstimateVerdict = "about-right" | "looks-optimistic" | "looks-conservative" | "not-enough-evidence";

export type EstimateReviewProposal = {
  basis: PacePercentBasis;
  verdict: EstimateVerdict;
  /** Seconds for the reference distance, when the evidence supports a real number. Null means "direction only". */
  proposedTimeS: number | null;
  /** The estimate currently on file, for comparison. */
  currentTimeS: number | null;
  /** Sessions that actually counted, heaviest first. */
  contributions: SessionWeighting[];
  /** Why this verdict, in sentences the coach reads. */
  notes: string[];
};

/** Below this total weight there simply is not enough evidence to say anything. */
export const MIN_TOTAL_WEIGHT = 1;

/**
 * How far back a review looks by default. The methodology's own cadence is
 * every two to four weeks.
 *
 * Lives here rather than in the server action that uses it because a
 * "use server" module may only export async functions -- exporting this
 * constant from there broke the build with "Export runEstimateReview
 * doesn't exist in target module", which is how Next reports that the
 * whole actions module failed to compile.
 */
export const REVIEW_WINDOW_DAYS = 28;

export function proposeEstimateReview(input: {
  sessions: ReviewSession[];
  /** Which phase family the review is about, which decides the evidence band. */
  phaseKey: string | null;
  /** The current estimate on file for the relevant basis, in seconds for the reference distance. */
  currentTimeS: number | null;
  /** Reference distance in metres, for turning a pace back into a total time. */
  referenceDistanceM: number;
}): EstimateReviewProposal {
  const family = phaseFamily(input.phaseKey);
  const basis: PacePercentBasis = family === "general" ? "5k" : "marathon";
  const notes: string[] = [];

  const weighed = input.sessions
    .map((session) => weighSession(session, input.phaseKey))
    .filter((w) => w.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  const totalWeight = weighed.reduce((sum, w) => sum + w.weight, 0);
  if (totalWeight < MIN_TOTAL_WEIGHT) {
    return {
      basis,
      verdict: "not-enough-evidence",
      proposedTimeS: null,
      currentTimeS: input.currentTimeS,
      contributions: weighed,
      notes: [
        "Not enough usable sessions since the last review to say anything about the estimate. Sessions count when they were completed, prescribed against the pace band this phase is indexed on, and logged with an effort.",
      ],
    };
  }

  // Direction, from how the prescribed paces actually felt. Positive means
  // sessions felt harder than prescribed, which points at an optimistic
  // estimate.
  let weightedGap = 0;
  let gapWeight = 0;
  for (const entry of weighed) {
    const prescribed = prescribedDifficulty(entry.session);
    if (prescribed == null || entry.session.rpe == null) continue;
    weightedGap += (entry.session.rpe - prescribed) * entry.weight;
    gapWeight += entry.weight;
  }
  const meanGap = gapWeight > 0 ? weightedGap / gapWeight : 0;

  // An exact number, only from sessions whose own result can carry one.
  const exact = weighed
    .map((entry) => ({ entry, implied: impliedReferenceSecondsPerMile(entry.session) }))
    .filter((e): e is { entry: SessionWeighting; implied: { basis: PacePercentBasis; secondsPerMile: number } } => e.implied != null)
    .filter((e) => e.implied.basis === basis);

  const impliedPace = weightedMedian(exact.map((e) => ({ value: e.implied.secondsPerMile, weight: e.entry.paceWeight })));
  const proposedTimeS = impliedPace == null ? null : Math.round(impliedPace * (input.referenceDistanceM / MILE_METERS));

  // Half a difficulty point of average drift is noise; a full point is a
  // pattern worth naming.
  const verdict: EstimateVerdict = meanGap >= 1 ? "looks-optimistic" : meanGap <= -1 ? "looks-conservative" : "about-right";

  notes.push(
    `${weighed.length} session${weighed.length === 1 ? "" : "s"} counted, weighted toward the ones prescribed in the ${basis === "5k" ? "90-100% of 5K pace" : "90-105% of marathon pace"} band where effort matched the prescription.`,
  );

  if (verdict === "looks-optimistic") {
    notes.push(
      `On average these sessions felt about ${formatGap(meanGap)} harder than prescribed, which usually means the estimate is a little fast and every prescribed pace is inheriting that.`,
    );
  } else if (verdict === "looks-conservative") {
    notes.push(
      `On average these sessions felt about ${formatGap(-meanGap)} easier than prescribed, which usually means there is more fitness here than the estimate reflects.`,
    );
  } else {
    notes.push("Effort and prescribed difficulty are tracking each other, which is what a good estimate looks like.");
  }

  if (proposedTimeS == null) {
    notes.push(
      "No number is proposed because none of these sessions can supply one. A logged session records one distance and one duration for the whole run, so a workout with a warm-up and cool-down gives a blended average rather than the pace of its main set. Set the revised estimate yourself using the direction above.",
    );
  } else {
    notes.push(
      `The proposed time comes from ${exact.length} session${exact.length === 1 ? "" : "s"} whose whole prescription was a single continuous pace, so the logged average can be attributed to it directly. Taken as the weighted middle of those, not the best of them.`,
    );
  }

  return { basis, verdict, proposedTimeS, currentTimeS: input.currentTimeS, contributions: weighed, notes };
}

function formatGap(gap: number): string {
  const rounded = Math.round(gap * 10) / 10;
  return `${rounded} point${rounded === 1 ? "" : "s"}`;
}

// ---------------------------------------------------------------------------
// Item 17: deterioration across reviews
// ---------------------------------------------------------------------------

export type PastReview = {
  /** ISO timestamp. */
  reviewedAt: string;
  /** The estimate in force after this review, in seconds for the reference distance. */
  estimateTimeS: number;
  /** Did the athlete actually do the work in the period this review covered? */
  workCompleted: boolean;
};

export type DeteriorationFlag = {
  flagged: boolean;
  title: string;
  detail: string;
  actions: string[];
};

/** How many consecutive downward reviews count as a trend rather than noise. */
export const DETERIORATION_REVIEW_COUNT = 3;

/**
 * A downward trend across reviews DESPITE the athlete completing the work.
 *
 * The "despite" is the whole point. An estimate drifting slower while
 * sessions are being missed is just a plan not happening. An estimate
 * drifting slower while the work is getting done is a different and more
 * serious thing, and the recommendation is to reduce intensity until the
 * cause is found rather than to push through it.
 *
 * Deliberately does not diagnose. It names candidates and routes to a
 * conversation.
 */
export function detectDeterioration(history: PastReview[]): DeteriorationFlag {
  const notFlagged: DeteriorationFlag = { flagged: false, title: "", detail: "", actions: [] };
  if (history.length < DETERIORATION_REVIEW_COUNT) return notFlagged;

  const recent = [...history]
    .sort((a, b) => (a.reviewedAt < b.reviewedAt ? -1 : 1))
    .slice(-DETERIORATION_REVIEW_COUNT);

  // A slower estimate is a LARGER time.
  const monotonicallySlower = recent.every(
    (review, index) => index === 0 || review.estimateTimeS > recent[index - 1].estimateTimeS,
  );
  if (!monotonicallySlower) return notFlagged;
  if (!recent.every((review) => review.workCompleted)) return notFlagged;

  return {
    flagged: true,
    title: `The estimate has moved slower ${DETERIORATION_REVIEW_COUNT} reviews in a row while the work got done`,
    detail:
      "Fitness going backwards through a block the athlete is completing is a signal in its own right. The usual causes are over-reaching and under-recovery, and they look identical from the outside: training load that outruns recovery, short or broken sleep, life stress, or simply not eating enough to support the work. None of them is fixed by training harder, and all of them get worse if you try.",
    actions: [
      "Reduce intensity, and keep it reduced until the cause is identified rather than until the numbers improve.",
      "Work through the candidates with the athlete: load, sleep, stress, fuelling.",
      "Treat persistent fatigue alongside frequent illness or niggles as a reason to involve a medical professional rather than a reason to adjust the plan again.",
    ],
  };
}
