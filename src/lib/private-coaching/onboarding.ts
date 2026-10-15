// Part K: athlete onboarding, prerequisites, and the 5K Crash Course.
//
// Pure, coach-only, advisory. Nothing here blocks an assignment; it tells
// the coach what is missing and offers the fix.
//
// ONE ITEM BUILT HERE THAT BELONGS TO PART D. The mileage-match check
// (originally Part D item 8) was never implemented as its own function --
// Part D's items 7-10 were not built as a single deliverable, and for a
// while only the phase-layout tool (Part A, which doubles as a rough tier
// recommender via selectPhaseProfile) existed from that part. Part K's
// own item 31 explicitly needs the mileage-match check ("don't start
// barely hanging on," linking Part D's check), so it is built here, as a
// plain, reusable function, rather than left as a dangling reference to
// something that does not exist. Part D items 9 and 10 (nonstandard
// durations, risk-framing copy) have since been built in
// plan-selection-guidance.ts, alongside this one but as their own module
// rather than folded into Part K's file.

export const MARATHON_READINESS_MILEAGE = 25;

export type PrerequisiteCheck = {
  mileageReady: boolean;
  estimateReady: boolean;
  /** True only when BOTH prerequisites are met. */
  readyForMarathonPlan: boolean;
  notes: string[];
};

/**
 * Item 31. Two prerequisites, checked independently so a coach sees both
 * gaps at once rather than fixing one and discovering the other.
 */
export function checkOnboardingPrerequisites(input: {
  currentWeeklyMileage: number | null;
  has5kEstimate: boolean;
}): PrerequisiteCheck {
  const mileageReady = input.currentWeeklyMileage != null && input.currentWeeklyMileage >= MARATHON_READINESS_MILEAGE;
  const estimateReady = input.has5kEstimate;
  const notes: string[] = [];

  if (!mileageReady) {
    notes.push(
      input.currentWeeklyMileage == null
        ? `No current weekly mileage on file. A marathon plan assumes at least ${MARATHON_READINESS_MILEAGE} miles a week already; get that recorded before assigning one.`
        : `Currently running ${input.currentWeeklyMileage} miles a week, below the ${MARATHON_READINESS_MILEAGE} mile/week readiness threshold. Build easy mileage first rather than starting the marathon plan now -- starting a plan already at its limit is harder to recover from than starting a level below it.`,
    );
  }
  if (!estimateReady) {
    notes.push(
      "No current 5K fitness estimate on file. Every pace in a marathon plan is built from this, so guessing it is worse than taking four weeks to measure it. The 5K Crash Course is built for exactly this gap.",
    );
  }
  if (mileageReady && estimateReady) {
    notes.push("Both prerequisites are met.");
  }

  return { mileageReady, estimateReady, readyForMarathonPlan: mileageReady && estimateReady, notes };
}

// ---------------------------------------------------------------------------
// Part D item 8, built to unblock the prerequisites check above
// ---------------------------------------------------------------------------

export type MileageMatchResult = {
  /** True when the plan's starting mileage is a real stretch from where the athlete is now. */
  isStretch: boolean;
  detail: string;
};

/**
 * Compare an athlete's recent RUNNING mileage against a plan's starting
 * mileage. Cross-training mileage is deliberately excluded from the
 * comparison -- it adds to fitness but does not replace the biomechanical
 * adaptation of running miles, so a plan's starting mileage has to be
 * matched against running volume specifically, not total training volume.
 */
export function mileageMatchCheck(input: {
  athleteCurrentWeeklyRunningMileage: number | null;
  planStartingMileage: number | null;
  /**
   * Recorded training-background peak, when available (see
   * training-background.ts's AnchorPeak). Appended as extra context rather
   * than changing the stretch calculation itself, which stays about
   * CURRENT running mileage vs. the plan's own start -- but a coach reading
   * "don't start barely hanging on" should also see whether this athlete
   * has already handled more than that recently, from training that never
   * happened on this platform.
   */
  anchorPeak?: { peakMileage: number | null; reliable: boolean; note: string } | null;
}): MileageMatchResult {
  const anchorSuffix = input.anchorPeak?.peakMileage != null ? ` ${input.anchorPeak.note}` : "";

  if (input.athleteCurrentWeeklyRunningMileage == null || input.planStartingMileage == null) {
    return {
      isStretch: false,
      detail: `Not enough data to compare current mileage against the plan's starting point.${anchorSuffix}`,
    };
  }

  const gap = input.planStartingMileage - input.athleteCurrentWeeklyRunningMileage;
  if (gap <= 0) {
    return {
      isStretch: false,
      detail: `Currently running ${input.athleteCurrentWeeklyRunningMileage} mi/week, at or above the plan's ${input.planStartingMileage} mi/week starting point.${anchorSuffix}`,
    };
  }

  // More than 20% below the plan's own starting point is treated as a
  // real stretch -- a plan that already assumes more than this at week one
  // is asking the athlete to begin at their limit rather than build into it.
  const isStretch = input.athleteCurrentWeeklyRunningMileage < input.planStartingMileage * 0.8;

  return {
    isStretch,
    detail: isStretch
      ? `Currently running ${input.athleteCurrentWeeklyRunningMileage} mi/week against a plan that starts at ${input.planStartingMileage}. Don't start barely hanging on -- consider a lower-volume plan rather than this one.${anchorSuffix}`
      : `Currently running ${input.athleteCurrentWeeklyRunningMileage} mi/week against a plan that starts at ${input.planStartingMileage}. Close enough to build into over the first couple of weeks.${anchorSuffix}`,
  };
}

// ---------------------------------------------------------------------------
// Item 32: the 5K Crash Course
// ---------------------------------------------------------------------------

export type CrashCourseLevel = "I" | "II" | "III";

export const CRASH_COURSE_LEVELS: { level: CrashCourseLevel; mileage: number; frameworkKey: string }[] = [
  { level: "I", mileage: 25, frameworkKey: "crash-course-i" },
  { level: "II", mileage: 32, frameworkKey: "crash-course-ii" },
  { level: "III", mileage: 40, frameworkKey: "crash-course-iii" },
];

/** Which level matches an athlete's current mileage best -- the closest level, never the nearest-rounded-down, so a mileage between two levels gets whichever is the smaller real step. */
export function crashCourseLevelFor(currentWeeklyMileage: number | null): CrashCourseLevel {
  if (currentWeeklyMileage == null) return "I";
  let closest = CRASH_COURSE_LEVELS[0];
  for (const candidate of CRASH_COURSE_LEVELS) {
    if (Math.abs(candidate.mileage - currentWeeklyMileage) < Math.abs(closest.mileage - currentWeeklyMileage)) {
      closest = candidate;
    }
  }
  return closest.level;
}

export type CrashCourseOffer = { level: CrashCourseLevel; frameworkKey: string; detail: string };

export function offerCrashCourse(currentWeeklyMileage: number | null): CrashCourseOffer {
  const level = crashCourseLevelFor(currentWeeklyMileage);
  const match = CRASH_COURSE_LEVELS.find((l) => l.level === level)!;
  return {
    level,
    frameworkKey: match.frameworkKey,
    detail: `Level ${level} (~${match.mileage} mi/week) matches their current mileage best. Four weeks, run by effort rather than pace, culminating in a 5K race or time trial. The result becomes their first 5K fitness estimate -- once they record it themselves in settings, it is real evidence for an estimate review rather than a guess at every pace in the marathon plan that follows.`,
  };
}

// ---------------------------------------------------------------------------
// Item 33: the Crash Course's effort table, transcribed for reuse
// ---------------------------------------------------------------------------
//
// Transcribed verbatim from scripts/data/framework-seeds/crash-course.json
// rather than read from the seed file at runtime, for the same reason
// everything else in this platform's content treats a source document as
// something to transcribe once into tested data rather than parse
// wherever it is needed (see framework-seed.ts's own header).

export type CrashCourseEffortLevel = { effort: string; feelsLike: string };

export const CRASH_COURSE_EFFORT_GUIDE: CrashCourseEffortLevel[] = [
  { effort: "Very easy", feelsLike: "Relaxing recovery run" },
  { effort: "Easy", feelsLike: "Normal training run" },
  { effort: "Moderate", feelsLike: "An uptempo run with smooth, rhythmic breathing" },
  { effort: "Strong", feelsLike: "Marathon to half marathon pace" },
  { effort: "Fast", feelsLike: "About 5K pace" },
  { effort: "Very fast", feelsLike: "About 3K / two-mile pace, roughly 5% faster than 5K pace" },
];
