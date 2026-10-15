// Training-background intake: who trained this athlete before Brody, and
// what that training actually looked like.
//
// WHY THIS EXISTS. A real beta athlete's Chicago marathon buildup turned
// out to be entirely self-trained -- not a prior cycle with this platform
// -- and the Run Club intake mixes brand-new runners in with athletes
// coming from other coaches, plans and apps. Onboarding copy, the
// assignment flow and Part G's progression had all quietly assumed every
// new athlete's history was a previous Brody cycle: "your last plan," "your
// last cycle with me." That assumption is false for most of this intake,
// and the fix is not softer copy, it's asking what actually happened and
// anchoring on the answer.
//
// Pure, coach-and-athlete-readable, advisory -- same rule as the rest of
// this platform's private-coaching modules: nothing here blocks an
// assignment, it tells whoever is deciding what the recorded history
// implies.
//
// THREE RULES THIS MODULE IS BUILT AROUND:
//
//   1. A previous coach or another plan/app is recorded as NEUTRAL CONTEXT,
//      never disparaged and never assumed to map onto this platform's own
//      phases or tiers. Different methodologies don't correspond to each
//      other by default.
//
//   2. New to structured training means assume nothing -- no peak, no
//      buildup, nothing inferred from a current mileage number that might
//      just be a few easy weeks. Route to the 5K Crash Course rather than
//      guessing.
//
//   3. Self-trained is still real training. It gets the SAME intake depth
//      as a previous coach's buildup (what was the peak week, what did it
//      look like), because a race time or a peak week is just as real
//      whoever was holding the stopwatch.

import type { createClient } from "@/lib/db/server";
import { MEDICAL_NOTE } from "@/lib/private-coaching/setbacks";

export const TRAINING_BACKGROUND_SOURCES = [
  "self_trained",
  "previous_coach",
  "other_plan_or_app",
  "new_to_structured",
] as const;
export type TrainingBackgroundSource = (typeof TRAINING_BACKGROUND_SOURCES)[number];

export const TRAINING_BACKGROUND_SOURCE_LABELS: Record<TrainingBackgroundSource, string> = {
  self_trained: "Self-trained / self-coached",
  previous_coach: "Previous coach",
  other_plan_or_app: "Another plan or app",
  new_to_structured: "New to structured training",
};

export type TrainingBackground = {
  source: TrainingBackgroundSource;
  /** Only meaningful for previous_coach. */
  coachName: string | null;
  /** Only meaningful for other_plan_or_app. */
  programName: string | null;
  /** Typical recent weekly mileage before anything changed to join -- distinct from current_weekly_mileage, which may already reflect a taper or a break since joining. */
  recentTypicalMileage: number | null;
  /** Peak weekly mileage of their most recent real buildup, whoever ran it. This is the number Part G and Part D/K anchor on. */
  peakMileage: number | null;
  /** For self_trained: what the buildup actually looked like (peak week, key sessions, what worked). For previous_coach/other_plan_or_app: neutral context about that training, never a judgment of it. */
  summary: string | null;
  /** Coach-visible injury history -- distinct from the athlete's own PRIVATE injury log (injuries-section.tsx), which a coach never sees. */
  injuryHistory: string | null;
};

export type IntakeQuestion = { id: string; prompt: string };

const COMMON_QUESTIONS: IntakeQuestion[] = [
  { id: "recentTypicalMileage", prompt: "What has their typical weekly mileage been recently?" },
  { id: "currentStatus", prompt: "What are they doing right now, training-wise?" },
  {
    id: "injuryHistory",
    prompt: "Any injury history worth knowing about? Not a diagnosis -- just what they've told you.",
  },
];

/**
 * Conditional intake questions, keyed by source. A self-trained athlete
 * gets asked what the buildup actually was, because there is no coach's
 * record of it anywhere else -- the same depth a previous coach's buildup
 * gets, not a lighter version of it. A brand-new runner gets asked nothing
 * about a buildup that never happened: "assume nothing" means don't ask
 * about history that doesn't exist, either.
 */
export function intakeQuestionsFor(source: TrainingBackgroundSource): IntakeQuestion[] {
  switch (source) {
    case "self_trained":
      return [
        { id: "peakMileage", prompt: "What was their peak week in their most recent self-built buildup?" },
        {
          id: "summary",
          prompt: "What did that buildup actually look like -- key sessions, what worked, what didn't?",
        },
        { id: "recentRaces", prompt: "Any recent races, with times? (Recorded as a race result, same as any other.)" },
        ...COMMON_QUESTIONS,
      ];
    case "previous_coach":
      return [
        { id: "coachName", prompt: "Who was coaching them?" },
        { id: "peakMileage", prompt: "What was their peak week in their most recent buildup with that coach?" },
        { id: "recentRaces", prompt: "Any recent races, with times?" },
        ...COMMON_QUESTIONS,
      ];
    case "other_plan_or_app":
      return [
        { id: "programName", prompt: "Which plan or app were they following?" },
        { id: "peakMileage", prompt: "What was their peak week on that plan?" },
        { id: "recentRaces", prompt: "Any recent races, with times?" },
        ...COMMON_QUESTIONS,
      ];
    case "new_to_structured":
      // No peak, no buildup, no prior races to ask about by default --
      // there is nothing there to assume. Still worth knowing what they're
      // doing right now and any injury history before routing straight to
      // the Crash Course.
      return COMMON_QUESTIONS;
  }
}

export type BackgroundContext = { title: string; detail: string; medicalNote: string | null };

/**
 * A coach-facing, training-source-neutral summary of what this athlete
 * brings into their first assignment. Never disparages a previous coach or
 * app, never assumes their training maps onto this platform's own phases.
 */
export function describeBackgroundForCoach(background: TrainingBackground | null): BackgroundContext {
  if (!background) {
    return {
      title: "No training background on file",
      detail:
        "Nothing recorded yet for how this athlete trained before now. Record it before assigning a plan, so plan selection and progression have real history to anchor on instead of guessing.",
      medicalNote: null,
    };
  }

  const injurySuffix = background.injuryHistory ? ` Injury history noted: ${background.injuryHistory}` : "";
  const medicalNote = background.injuryHistory ? MEDICAL_NOTE : null;

  switch (background.source) {
    case "self_trained":
      return {
        title: "Self-trained",
        detail:
          (background.summary
            ? `Built their own training. ${background.summary}`
            : "Built their own training. No description of the buildup is on file yet -- worth asking what it actually looked like (peak week, key sessions, what worked) before assuming anything about it.") +
          injurySuffix,
        medicalNote,
      };
    case "previous_coach":
      return {
        title: background.coachName ? `Previously coached by ${background.coachName}` : "Previously coached by someone else",
        detail:
          `Recorded as neutral context, not mapped onto this platform's own phases -- a different coach's methodology doesn't automatically correspond to a tier or phase here.${injurySuffix}`,
        medicalNote,
      };
    case "other_plan_or_app":
      return {
        title: background.programName
          ? `Previously following ${background.programName}`
          : "Previously following another plan or app",
        detail: `Recorded as neutral context, not mapped onto this platform's own phases.${injurySuffix}`,
        medicalNote,
      };
    case "new_to_structured":
      return {
        title: "New to structured training",
        detail:
          `No prior buildup to reference -- assume nothing about pacing or volume beyond what they've reported about today. Route to the 5K Crash Course rather than a marathon plan.${injurySuffix}`,
        medicalNote,
      };
  }
}

type AthleteProfileBackgroundRow = {
  training_background_source: TrainingBackgroundSource | null;
  training_background_coach_name: string | null;
  training_background_program_name: string | null;
  training_background_recent_mileage: number | null;
  training_background_peak_mileage: number | null;
  training_background_summary: string | null;
  training_background_injury_history: string | null;
};

/**
 * Read one athlete's recorded training background, when they have one.
 * Shared by every coach-facing surface that needs it (onboarding, the
 * assignment flow, multi-cycle progression) so the shape is read the same
 * way everywhere rather than re-derived per call site.
 */
export async function getTrainingBackground(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
): Promise<TrainingBackground | null> {
  const { data } = await supabase
    .from("athlete_profiles")
    .select(
      "training_background_source, training_background_coach_name, training_background_program_name, training_background_recent_mileage, training_background_peak_mileage, training_background_summary, training_background_injury_history",
    )
    .eq("user_id", athleteId)
    .maybeSingle<AthleteProfileBackgroundRow>();

  if (!data?.training_background_source) return null;

  return {
    source: data.training_background_source,
    coachName: data.training_background_coach_name,
    programName: data.training_background_program_name,
    recentTypicalMileage: data.training_background_recent_mileage,
    peakMileage: data.training_background_peak_mileage,
    summary: data.training_background_summary,
    injuryHistory: data.training_background_injury_history,
  };
}

export type AnchorPeak = {
  /** The peak weekly mileage to anchor plan selection and progression on, when there's enough to anchor on at all. */
  peakMileage: number | null;
  /** False when peakMileage is a fallback assumption rather than a real recorded number. */
  reliable: boolean;
  /** Shown to whoever is deciding -- what's being used and why, so an assumption never reads as a confirmed fact. */
  note: string;
};

/**
 * What Part D/K's plan-selection guidance and Part G's progression should
 * anchor volume decisions on, given recorded background history instead of
 * an assumed prior Brody cycle.
 *
 * A recorded peak from ANY source -- self-trained, a previous coach,
 * another app -- is real evidence and is used as-is, reliable. New to
 * structured training, or no background recorded yet, has nothing real to
 * anchor on: fall back to current weekly mileage, flagged UNRELIABLE, so
 * whoever is deciding sees it's an assumption that needs confirming rather
 * than a fact.
 */
export function resolveAnchorPeakMileage(input: {
  background: TrainingBackground | null;
  currentWeeklyMileage: number | null;
}): AnchorPeak {
  const { background, currentWeeklyMileage } = input;

  if (background?.peakMileage != null) {
    const sourceNote =
      background.source === "self_trained"
        ? "from their self-trained buildup"
        : background.source === "previous_coach"
          ? `from their time with ${background.coachName ?? "their previous coach"}`
          : background.source === "other_plan_or_app"
            ? `from ${background.programName ?? "their previous plan or app"}`
            : "on record";
    return {
      peakMileage: background.peakMileage,
      reliable: true,
      note: `Anchored on a recorded peak of ${background.peakMileage} mi/week ${sourceNote}, not an assumed prior cycle with this platform.`,
    };
  }

  if (background?.source === "new_to_structured") {
    return {
      peakMileage: null,
      reliable: false,
      note: "New to structured training -- no peak to anchor on. Default conservatively and route through the 5K Crash Course rather than guessing a starting volume.",
    };
  }

  return {
    peakMileage: currentWeeklyMileage,
    reliable: false,
    note:
      currentWeeklyMileage != null
        ? `No recorded training-history peak on file. Defaulting to their current ${currentWeeklyMileage} mi/week as a conservative stand-in -- confirm this reflects a real recent peak, not just what they're running right now, before assigning.`
        : "No recorded training history and no current mileage on file. Nothing to anchor volume decisions on yet -- confirm with the athlete before assigning a plan.",
  };
}
