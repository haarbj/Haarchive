// Part L: fueling oversight. Under-fueling awareness, the gut-training
// plan-health check, and the ferritin check.
//
// Pure, coach-only, advisory. Follows the same never-diagnose discipline
// as setbacks.ts: every guidance object carries the medical note, nothing
// here names a condition, and every recommendation routes to a
// conversation or a professional rather than a verdict. Reuses
// setbacks.ts's MEDICAL_NOTE and guidance shape directly rather than
// defining a second, slightly different version of the same boundary.

import { MEDICAL_NOTE, type SetbackGuidance } from "@/lib/private-coaching/setbacks";
import { LOAD_BEARING_MP_BAND, targetsMarathonPaceBand } from "@/lib/private-coaching/plan-health";
import { MILE_METERS } from "@/lib/race-distances";

function guidance(input: Omit<SetbackGuidance, "medicalNote">): SetbackGuidance {
  return { ...input, medicalNote: MEDICAL_NOTE };
}

// ---------------------------------------------------------------------------
// Item 34: under-fueling / low energy availability awareness
// ---------------------------------------------------------------------------

export type UnderFuelingSignals = {
  frequentIllness: boolean;
  recurrentOveruseInjuries: boolean;
  troubleSleeping: boolean;
  hormoneDisruptions: boolean;
  /** Performance plateauing or declining despite training that looks solid on paper. */
  plateauingOrDecliningDespiteSolidTraining: boolean;
};

/**
 * How many of the five signals have to co-occur before this is worth
 * surfacing. A single signal alone is common and usually means nothing --
 * everyone gets sick occasionally, everyone sleeps badly sometimes. What
 * the methodology actually describes is a CLUSTER: several of these
 * together, which is a different and much more specific thing than any
 * one of them. Two is the threshold rather than three, because waiting for
 * three lets a real, developing pattern run longer before anyone looks at it.
 */
export const UNDER_FUELING_CLUSTER_THRESHOLD = 2;

export type UnderFuelingAssessment = {
  signalCount: number;
  clusterPresent: boolean;
  guidance: SetbackGuidance | null;
};

/**
 * Surface low energy availability and low carbohydrate availability as a
 * CANDIDATE CAUSE -- "under-recovery," not overtraining -- before anything
 * about cutting training gets suggested. That ordering is the actual point
 * of this function: the instinctive response to this symptom picture is to
 * train less, and training less does nothing if the real problem is that
 * the athlete is not eating enough to support the training they are
 * already doing. Cutting training first is treating the symptom the
 * athlete is least likely to raise on their own, while leaving the one
 * that actually explains it unexamined.
 */
export function assessUnderFueling(signals: UnderFuelingSignals): UnderFuelingAssessment {
  const signalCount = Object.values(signals).filter(Boolean).length;
  const clusterPresent = signalCount >= UNDER_FUELING_CLUSTER_THRESHOLD;

  if (!clusterPresent) {
    return { signalCount, clusterPresent, guidance: null };
  }

  return {
    signalCount,
    clusterPresent,
    guidance: guidance({
      key: "under-fueling:cluster",
      title: "Consider under-fueling before cutting training",
      detail:
        "Frequent illness, recurring overuse injuries, poor sleep, hormone disruption, and a performance plateau despite training that looks right on paper are the pattern of low energy availability or low carbohydrate availability, not overtraining -- and the two call for opposite fixes. Cutting volume addresses overtraining and does nothing for under-fuelling, because the athlete is still not eating enough to support whatever is left. Carbohydrate availability specifically matters as much as total calories, and the classic pattern behind it is mundane: skipping breakfast, or under-eating around the workout itself, while still training hard.",
      actions: [
        "Have a direct conversation with the athlete about eating around training, especially breakfast and the window around workouts, before changing the plan.",
        "Do not respond by cutting volume alone -- that treats overtraining, not under-fuelling, and this pattern is usually the latter.",
        "Involve a sports dietitian or physician where appropriate, rather than managing this through training adjustments alone.",
      ],
    }),
  };
}

// ---------------------------------------------------------------------------
// Item 35: the gut-training plan-health check
// ---------------------------------------------------------------------------

export type FuelRelevantWorkout = {
  id: string;
  scheduledDate: string;
  /** The authored prescription, used only to decide whether this session called for fuelling practice. */
  prescription: string | null;
  phaseKey: string | null;
  plannedDistanceM: number | null;
  /** Whether the athlete actually completed it. An unlogged session has nothing to check. */
  completed: boolean;
  /** athlete_notes and conditions_notes, combined, for the fuelling-mention scan. Null when nothing was logged. */
  loggedNotes: string | null;
};

/** How far before the race this check looks. */
export const GUT_TRAINING_WINDOW_WEEKS = 8;
/** A long run worth practising fuelling on. */
export const LONG_RUN_DISTANCE_MILES = 13;

const FUELING_MENTION_WORDS = [
  "gel", "gels", "gu ", "maurten", "carb", "carbs", "carbohydrate",
  "sports drink", "electrolyte", "chews", "blocks", "g/hr", "grams per hour",
  "fuel", "fueled", "fuelled", "fueling", "fuelling",
];

/**
 * A free-text scan over the athlete's OWN logged notes, used only to
 * decide whether to raise the check -- never to measure a rate or grade
 * the fuelling itself. Same discipline as plan-health.ts's
 * hasAdverseConditions: a false positive (the athlete mentioned fuelling
 * for an unrelated reason) costs nothing, and a false negative just means
 * the check fires when it did not need to, which the coach resolves in a
 * glance at the log.
 */
export function mentionsFuelingPractice(text: string | null | undefined): boolean {
  if (!text) return false;
  const value = text.toLowerCase();
  return FUELING_MENTION_WORDS.some((word) => value.includes(word));
}

/**
 * Is this session the kind that calls for practising race-rate fuelling --
 * a long run, or marathon-specific work in the same 95-105% of marathon
 * pace band Part F treats as load-bearing? Reuses that band rather than
 * defining a second notion of "marathon-specific" that could drift from it.
 */
export function isFuelRelevantSession(workout: FuelRelevantWorkout): boolean {
  const isLongRun = (workout.plannedDistanceM ?? 0) >= LONG_RUN_DISTANCE_MILES * MILE_METERS;
  const isMarathonSpecific = targetsMarathonPaceBand(
    { ...workout, dayLabel: null, plannedRpe: null, plannedRpeMax: null, pacePercentBasis: null, pacePercentMin: null, pacePercentMax: null, isOptional: false },
    LOAD_BEARING_MP_BAND.min,
    LOAD_BEARING_MP_BAND.max,
  );
  return isLongRun || isMarathonSpecific;
}

export type GutTrainingFinding = {
  fired: boolean;
  detail: string;
  /** The relevant, completed sessions in the window that had nothing logged about fuelling. */
  unpracticedSessions: FuelRelevantWorkout[];
};

/**
 * Item 35. Fires only when there is something real to flag: at least one
 * completed, fuel-relevant session inside the window, and NONE of them
 * logged any mention of fuelling. Silent otherwise -- including when the
 * window has not produced any relevant completed sessions yet, which is
 * "nothing to check" rather than "a gap," and flagging it would be noise
 * on a plan that has not reached that point.
 */
export function runGutTrainingCheck(input: { workouts: FuelRelevantWorkout[]; raceDate: string | null }): GutTrainingFinding {
  const notFired: GutTrainingFinding = { fired: false, detail: "", unpracticedSessions: [] };
  if (!input.raceDate) return notFired;

  const windowStart = new Date(`${input.raceDate}T00:00:00Z`);
  windowStart.setUTCDate(windowStart.getUTCDate() - GUT_TRAINING_WINDOW_WEEKS * 7);
  const windowStartIso = windowStart.toISOString().slice(0, 10);

  const relevant = input.workouts.filter(
    (w) => w.completed && w.scheduledDate >= windowStartIso && w.scheduledDate <= input.raceDate! && isFuelRelevantSession(w),
  );
  if (relevant.length === 0) return notFired;

  const unpracticed = relevant.filter((w) => !mentionsFuelingPractice(w.loggedNotes));
  if (unpracticed.length < relevant.length) return notFired; // at least one session shows real practice

  return {
    fired: true,
    unpracticedSessions: unpracticed,
    detail: `${relevant.length} long run${relevant.length === 1 ? "" : "s"} or marathon-specific session${relevant.length === 1 ? "" : "s"} logged in the final ${GUT_TRAINING_WINDOW_WEEKS} weeks before the race, and none of them mention fuelling in the athlete's own notes. Race-day fuelling is a trained skill, not something that works on the day just because the plan was followed -- the target rate needs practising in workouts exactly like these, well before race day asks for it. This is read from what the athlete happened to write down, not a measurement of what they actually ate, so it is worth a direct question rather than treated as certain.`,
  };
}

// ---------------------------------------------------------------------------
// Item 36: the iron/ferritin check
// ---------------------------------------------------------------------------

/** How much more likely women are to be iron-deficient than men, per the methodology's own figures. */
export const FEMALE_IRON_DEFICIENCY_RELATIVE_RISK = 3;
/** The cited elite-athlete study's ferritin floor and the share of each sex below it. */
export const LOW_FERRITIN_STUDY = { thresholdNgMl: 35, femalePercentBelow: 52, malePercentBelow: 15, sampleSize: 1000 } as const;

export function ferritinCheckGuidance(input: {
  underFuelingClusterPresent: boolean;
  /** The same deterioration signal Part F's estimate review already computes -- this reuses it rather than asking the coach to judge "stalling" a second time. */
  aerobicFitnessStalling: boolean;
}): SetbackGuidance | null {
  if (!input.underFuelingClusterPresent && !input.aerobicFitnessStalling) return null;

  return guidance({
    key: "ferritin-check",
    title: "Consider ferritin lab work",
    detail: `Low iron caps VO2max by limiting how much haemoglobin the body can make, and it is common: women are roughly ${FEMALE_IRON_DEFICIENCY_RELATIVE_RISK} times more likely than men to be iron-deficient, and in one study of more than ${LOW_FERRITIN_STUDY.sampleSize} elite athletes, ${LOW_FERRITIN_STUDY.femalePercentBelow}% of women and ${LOW_FERRITIN_STUDY.malePercentBelow}% of men sat below ${LOW_FERRITIN_STUDY.thresholdNgMl} ng/mL ferritin. ${
      input.underFuelingClusterPresent
        ? "This is worth raising alongside the under-fuelling pattern already flagged, since the two often travel together."
        : "This is worth raising because aerobic fitness is stalling in a way nothing in the training explains."
    } Testing has to come before any supplementation: some genetic iron-overload conditions make blind iron supplementation actively harmful, not just useless, which is exactly why this is lab work and a physician's call rather than something to self-treat.`,
    actions: [
      "Suggest ferritin lab work through a physician as a concrete next step.",
      "Test before supplementing, never the other way round.",
      "Treat this as one candidate worth ruling in or out, not a diagnosis.",
    ],
  });
}
