// Intake gap-check: before a coach plans for an athlete, what does the
// plan actually depend on knowing? Daniels' own principle -- prescription
// follows what the athlete has access to, not a generic template -- is
// the whole reason this exists. A plan that prescribes track work to an
// athlete with no track access is a planning error, not a training one,
// and this module exists to make that error visible before it happens,
// never to block it from happening.
//
// FLAGS, NEVER BLOCKS. Every surface this feeds (the athlete's payoff
// view and profile, the coach's athlete page, the roster badge) is
// advisory. Assignment, planning, and publishing all work identically
// with an incomplete intake -- a coach who knows the athlete personally
// can proceed anyway, same rule as training-background.ts's own
// resolveAnchorPeakMileage.
//
// WHAT'S REUSED, NOT REBUILT. Two items were already covered elsewhere
// and are read from their real sources here, not duplicated:
//   - goal race: the `goals` table (goal-race.ts's getAthleteGoalRace)
//   - fitness anchor: race_results OR athlete_fitness_estimates
//     (pace-reference.ts's getAthleteMostRecentRace / fitness-
//     estimates.ts's getAthleteFitnessEstimates) -- exactly the same
//     "race result or fitness estimate" test plan-payoff.ts's
//     hasFitnessAnchor already uses for the "Your Plan" payoff.
// Three more items reuse existing, already-self-reported
// athlete_profiles columns that were either live but unused in this
// context (running_days_per_week) or on the table since the very first
// schema but never wired into any form (elevation_m, for home altitude)
// or already asked, just under a different module's name
// (training_background_injury_history, training-background.ts's own
// "any injury history worth knowing about" question -- its explicit-
// "none"-counts-as-answered semantics are exactly what this gap needs,
// which is why it's reused rather than a second injury field invented).
// Everything else (training_facilities, recent_training_detail,
// long_run_day, blackout_days) is genuinely new -- see this repo's
// matching migration for the columns.
//
// Pure, deterministic, Supabase-free -- same split as completion-
// comparison.ts/roster-row.ts: this file only evaluates already-fetched
// values; every loader that fetches those values lives elsewhere.

export type IntakeGapKey =
  | "goal_race"
  | "fitness_anchor"
  | "training_facilities"
  | "home_altitude"
  | "recent_training"
  | "injury_limitations"
  | "schedule_constraints";

export type IntakeGapItem = {
  key: IntakeGapKey;
  complete: boolean;
  /** What the athlete sees on a completion prompt -- a plain question, never alarm language. */
  athletePrompt: string;
  /** Where that prompt deep-links to -- always a real, existing field, never a placeholder route. */
  athleteHref: string;
  /** What the coach sees naming this item, present or missing. */
  coachLabel: string;
};

export type IntakeGapInput = {
  hasGoalRace: boolean;
  hasFitnessAnchor: boolean;
  /** Null or empty = never answered. A real, explicit empty-set answer isn't representable today -- this platform doesn't yet distinguish "no facilities at all" from "never asked," matching every other multi-select on this table. */
  trainingFacilities: string[] | null;
  /** Meters -- athlete_profiles.elevation_m. 0 (sea level) is a complete, real answer, never treated as missing. */
  homeAltitudeM: number | null;
  /** The last 2-4 weeks' baseline -- typical week shape, long-run distance, a recent key workout. A snapshot, not a log: free text is the whole storage format. */
  recentTrainingDetail: string | null;
  /** Current/recent injuries or anything that constrains training. Any non-empty text -- including literally "None" -- counts as answered; only a genuinely empty/unset field is a gap. */
  injuryLimitations: string | null;
  runningDaysPerWeek: number | null;
  longRunDay: string | null;
};

export type IntakeGapEvaluation = {
  items: IntakeGapItem[];
  missing: IntakeGapItem[];
  isComplete: boolean;
};

/** A real answer needs more than one word -- "fine," "ok," "5 miles" alone says nothing about week shape or a key session. Trimmed and whitespace-split, so extra spacing never falsely counts as more words than were actually written. */
function hasMoreThanOneWord(text: string | null): boolean {
  if (!text) return false;
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length > 1;
}

function hasNonEmptyText(text: string | null): boolean {
  return text != null && text.trim().length > 0;
}

/**
 * Evaluates every gap item for one athlete against already-fetched
 * values -- same data in, same evaluation out, every time. The caller
 * (any surface) decides what to fetch; this function decides what
 * counts as complete.
 */
export function evaluateIntakeGaps(input: IntakeGapInput): IntakeGapEvaluation {
  const items: IntakeGapItem[] = [
    {
      key: "goal_race",
      complete: input.hasGoalRace,
      athletePrompt: "Add your goal race -- the name and the date.",
      athleteHref: "/coaching/your-plan",
      coachLabel: "Goal race",
    },
    {
      key: "fitness_anchor",
      complete: input.hasFitnessAnchor,
      athletePrompt: "Add a recent race result or a current fitness estimate so your paces can be calculated.",
      athleteHref: "/settings#race-results",
      coachLabel: "Fitness anchor (race result or estimate)",
    },
    {
      key: "training_facilities",
      complete: input.trainingFacilities != null && input.trainingFacilities.length > 0,
      athletePrompt: "What do you have access to for training -- track, treadmill, trails, hills, a gym, a pool?",
      athleteHref: "/settings#athlete-profile",
      coachLabel: "Training environment / facilities access",
    },
    {
      key: "home_altitude",
      complete: input.homeAltitudeM != null,
      athletePrompt: "What's the elevation where you do most of your training?",
      athleteHref: "/settings#athlete-profile",
      coachLabel: "Home training altitude",
    },
    {
      key: "recent_training",
      complete: hasMoreThanOneWord(input.recentTrainingDetail),
      athletePrompt: "Describe your last 2-4 weeks of training -- a typical week, your long run distance, and one key workout.",
      athleteHref: "/settings#athlete-profile",
      coachLabel: "Detailed recent training",
    },
    {
      key: "injury_limitations",
      complete: hasNonEmptyText(input.injuryLimitations),
      athletePrompt: "Any current or recent injuries, or anything that limits your training? If none, just say so.",
      athleteHref: "/settings#training-background",
      coachLabel: "Injury / limitations history",
    },
    {
      key: "schedule_constraints",
      complete: input.runningDaysPerWeek != null && hasNonEmptyText(input.longRunDay),
      athletePrompt: "How many days a week can you train, and which day works best for your long run?",
      athleteHref: "/settings#athlete-profile",
      coachLabel: "Schedule constraints (days available, long-run day)",
    },
  ];

  const missing = items.filter((item) => !item.complete);
  return { items, missing, isComplete: missing.length === 0 };
}
