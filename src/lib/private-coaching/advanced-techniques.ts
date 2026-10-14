// Part J: advanced training techniques. High mileage, depletion workouts,
// double-threshold sessions, special blocks, and the strength framework.
//
// Pure, coach-only, advisory. Every gated technique returns an ELIGIBILITY
// result the caller must check before anything is offered -- none of these
// functions can be called in a way that silently skips the gate, because
// the guidance functions below take the eligibility result as an input
// rather than recomputing it, so there is exactly one place each gate is
// evaluated.
//
// These techniques exist in the seeded frameworks already (Ridge through
// Summit author double-threshold days and special blocks directly), so
// this module is not inventing new workout content. Its job is the
// decision support around them: who this is appropriate for, and the hard
// stops for who it is not.

import { phaseFamily } from "@/lib/private-coaching/adjustment-playbook";
import { PEAK_STEP } from "@/lib/private-coaching/multi-cycle";

export type AdvancedGuidance = {
  key: string;
  title: string;
  detail: string;
  actions: string[];
};

function note(input: Omit<AdvancedGuidance, "key"> & { key: string }): AdvancedGuidance {
  return input;
}

// ---------------------------------------------------------------------------
// Item 26: high mileage
// ---------------------------------------------------------------------------

/** The useful ceiling the methodology describes. Past this, more miles stop being the lever. */
export const HIGH_MILEAGE_CEILING = { min: 120, max: 150 } as const;
/** The extended per-cycle step available only to an already-high-mileage athlete taking on real risk. */
export const EXTENDED_PEAK_STEP_MAX = 15;
/** Below this, the extended step is not on the table regardless of ambition. */
export const EXTENDED_STEP_MILEAGE_FLOOR = 85;

export function highMileageGuidance(input: {
  currentPeakMileage: number;
  respondedWellToEarlyIncreases: boolean;
  lifestyleSupportsDoubles: boolean;
  /** Is the athlete stagnating or breaking down AT this mileage, rather than progressing on it? */
  stagnatingOrBreakingDown: boolean;
}): AdvancedGuidance {
  if (input.stagnatingOrBreakingDown) {
    return note({
      key: "high-mileage:trap",
      title: "Stagnating or breaking down here usually means less mileage, not more",
      detail:
        "The trap at this volume runs the opposite direction from what it looks like. An athlete stagnating or breaking down at high mileage typically needs LESS mileage with MORE workout volume, intensity and recovery, not more miles stacked on top of a load that is already not working. Adding miles to fix a plateau the miles themselves caused makes the plateau worse.",
      actions: [
        "Cut weekly mileage rather than raising it.",
        "Put the freed capacity into workout quality and recovery, not more easy volume.",
        "Re-evaluate after a genuine down block, not after one hard week.",
      ],
    });
  }

  if (!input.respondedWellToEarlyIncreases || !input.lifestyleSupportsDoubles) {
    return note({
      key: "high-mileage:not-yet",
      title: "High mileage is not the next lever for this athlete yet",
      detail:
        "High mileage exists to enable marathon-specific workouts too long and too fast to run otherwise -- it is the support, not the stimulus. It suits athletes who have already responded well to earlier mileage increases and whose life genuinely supports doubles, disrupted sleep from early-morning runs, and roughly four thousand or more calories a day of fuelling. Without that foundation, more mileage is just more mileage.",
      actions: [
        "Build the response history at a lower rung first.",
        "Address the lifestyle constraint directly rather than prescribing around it.",
        "Revisit once both are genuinely true, not once the athlete is asking for it.",
      ],
    });
  }

  const extendedAvailable = input.currentPeakMileage >= EXTENDED_STEP_MILEAGE_FLOOR;

  return note({
    key: "high-mileage:progression",
    title: "Volume first, intensity second, never the reverse",
    detail: `Add volume through longer easy runs and doubles while holding workout volume constant, and only increase day-to-day variability once mileage has stabilised at the new level. The normal step is ${PEAK_STEP.min} to ${PEAK_STEP.max} miles a week at peak per cycle.${
      extendedAvailable
        ? ` At ${input.currentPeakMileage} miles already, up to ${EXTENDED_PEAK_STEP_MAX} is available if the athlete has ambitious goals and knowingly accepts the extra risk -- but that is a choice to make explicitly, not a default.`
        : ""
    } Once high-calibre workouts begin, let the weekly total be the RESULT of the workouts rather than a target chased in its own right. The useful ceiling is around ${HIGH_MILEAGE_CEILING.min} to ${HIGH_MILEAGE_CEILING.max} miles a week; past that, more mileage stops being the lever at all.`,
    actions: [
      `Step peak mileage by ${PEAK_STEP.min} to ${PEAK_STEP.max} miles a week this cycle${extendedAvailable ? `, or up to ${EXTENDED_PEAK_STEP_MAX} only with the athlete's explicit buy-in on the added risk` : ""}.`,
      "Hold workout volume constant while volume climbs; increase variability only after mileage settles.",
      "Let the weekly total follow the workouts, not the other way round, once real quality sessions are in the plan.",
    ],
  });
}

// ---------------------------------------------------------------------------
// Item 27: depletion workouts
// ---------------------------------------------------------------------------

export type DepletionContraindicationInput = {
  redsHistory: boolean;
  disorderedEatingHistory: boolean;
  menstrualDisturbanceHistory: boolean;
  overtrainingHistory: boolean;
};

export type DepletionEligibility = {
  eligible: boolean;
  /** True when a HARD contraindication is present -- never offer regardless of anything else. */
  contraindicated: boolean;
  reasons: string[];
};

/**
 * Item 27's eligibility gate. HARD contraindications on RED-S, disordered
 * eating, menstrual disturbance or a history of overtraining are absolute:
 * they are checked FIRST and nothing else can override them. This function
 * never asks "how severe" or "how long ago" -- a history is a history, and
 * weighing it against anything else is exactly the overreach "never
 * diagnoses" exists to prevent. The coach's actual knowledge of the
 * athlete's current state belongs in the conversation this gate routes to,
 * not in a second input this function would use to talk itself out of the
 * contraindication.
 */
export function depletionWorkoutEligibility(input: DepletionContraindicationInput & {
  aerobicallyStrong: boolean;
  experiencedMultipleCycles: boolean;
  peakMileage: number;
  fadesLateInMarathon: boolean;
}): DepletionEligibility {
  const contraindications: string[] = [];
  if (input.redsHistory) contraindications.push("a history of RED-S");
  if (input.disorderedEatingHistory) contraindications.push("a history of disordered eating");
  if (input.menstrualDisturbanceHistory) contraindications.push("a history of menstrual disturbance");
  if (input.overtrainingHistory) contraindications.push("a history of overtraining");

  if (contraindications.length > 0) {
    return {
      eligible: false,
      contraindicated: true,
      reasons: [`Contraindicated: ${contraindications.join(", ")}. Never prescribe a depletion workout for this athlete.`],
    };
  }

  const reasons: string[] = [];
  if (!input.aerobicallyStrong) reasons.push("Not described as aerobically strong.");
  if (!input.experiencedMultipleCycles) reasons.push("Has not completed multiple marathon cycles.");
  if (input.peakMileage < 70) reasons.push("Peak mileage is below the 70 mile/week floor.");
  if (!input.fadesLateInMarathon) reasons.push("Does not have a documented pattern of fading late in the marathon.");

  return { eligible: reasons.length === 0, contraindicated: false, reasons };
}

export type DepletionForm = "general" | "marathon-specific";

/** Maximum depletion sessions of the marathon-specific form in one buildup. */
export const MARATHON_SPECIFIC_DEPLETION_MAX_PER_BUILDUP = 3;

export function depletionWorkoutGuidance(eligibility: DepletionEligibility, form: DepletionForm): AdvancedGuidance {
  if (eligibility.contraindicated) {
    return note({
      key: "depletion:contraindicated",
      title: "Do not prescribe a depletion workout for this athlete",
      detail: eligibility.reasons[0],
      actions: ["Do not offer either form of depletion training.", "This is not a judgment call -- the contraindication is absolute."],
    });
  }

  if (!eligibility.eligible) {
    return note({
      key: "depletion:ineligible",
      title: "Not eligible yet",
      detail:
        "Depletion training is for aerobically strong, experienced marathoners who fade late in the race -- a narrow and controversial tool, not a default option.",
      actions: eligibility.reasons,
    });
  }

  if (form === "general") {
    return note({
      key: "depletion:general",
      title: "General depletion",
      detail:
        "A few easy runs or workouts per week in a fasted state during the general phase, tapering to none by the specific phase. The aim is improving fat utilisation and metabolic flexibility while the stakes of any one session are low.",
      actions: [
        "Fasted, easy-to-moderate sessions only, a few per week.",
        "Taper the frequency down through the buildup and stop by the specific phase.",
        "Stand it down immediately if sleep, mood or recovery start to slip.",
      ],
    });
  }

  return note({
    key: "depletion:marathon-specific",
    title: "Marathon-specific depletion",
    detail: `Long or fast sessions at 90-100% of marathon pace with no carbohydrate -- "draining the tanks." Maximum ${MARATHON_SPECIFIC_DEPLETION_MAX_PER_BUILDUP} per buildup, run in the morning on an empty stomach with water or caffeine only. The pace achieved will underestimate true fitness, which is expected and not a sign anything is wrong.`,
    actions: [
      `No more than ${MARATHON_SPECIFIC_DEPLETION_MAX_PER_BUILDUP} of these in the whole buildup.`,
      "Morning, fasted, water or caffeine only.",
      "Warn the athlete in advance that the pace will look slow, so it is not mistaken for a bad day.",
    ],
  });
}

// ---------------------------------------------------------------------------
// Item 28: double-threshold sessions
// ---------------------------------------------------------------------------

/** The floors this gate checks. */
export const DOUBLE_THRESHOLD_FLOOR = { weeklyMileage: 65, singleThresholdMiles: 5 } as const;

export function doubleThresholdEligibility(input: {
  currentWeeklyMileage: number;
  currentSingleThresholdVolumeMiles: number;
}): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (input.currentWeeklyMileage < DOUBLE_THRESHOLD_FLOOR.weeklyMileage) {
    reasons.push(`Weekly mileage (${input.currentWeeklyMileage}) is below the ${DOUBLE_THRESHOLD_FLOOR.weeklyMileage} mile/week floor.`);
  }
  if (input.currentSingleThresholdVolumeMiles < DOUBLE_THRESHOLD_FLOOR.singleThresholdMiles) {
    reasons.push(
      `Current single-threshold volume (${input.currentSingleThresholdVolumeMiles} mi) is below the ${DOUBLE_THRESHOLD_FLOOR.singleThresholdMiles} mile floor -- build that up in one session first.`,
    );
  }
  return { eligible: reasons.length === 0, reasons };
}

export function doubleThresholdGuidance(eligibility: { eligible: boolean; reasons: string[] }): AdvancedGuidance {
  if (!eligibility.eligible) {
    return note({
      key: "double-threshold:ineligible",
      title: "Not ready for double-threshold days",
      detail: "These need an existing base of single-threshold volume and weekly mileage to split across two sessions safely.",
      actions: eligibility.reasons,
    });
  }

  return note({
    key: "double-threshold:guidance",
    title: "Supportive, not specific -- and intensity control is the whole game",
    detail:
      "Double-threshold sessions sit at sub-threshold (86-88% 5K) through supra-threshold (94-110% 5K) intensity, built to extend threshold volume rather than to build resilience -- they are marathon-SUPPORTIVE work, never marathon-specific, and should never be framed to the athlete as the latter. Keep warm-ups and rests short (20-45 seconds) so the two sessions blend into something close to a quasi-steady-state rather than two separate hard efforts. Evolve the structure over successive sessions rather than repeating one exactly, and never test limits inside them: they are controlled by design.",
    actions: [
      "Treat them as supportive volume, not specific-phase resilience work.",
      "Keep rests short (20-45 sec) and warm-ups brief.",
      "Change the structure session to session rather than repeating the same one.",
      "For an injury-prone athlete, remember that splitting volume across two sessions does not reduce biomechanical stress -- it is still the same total pounding.",
    ],
  });
}

// ---------------------------------------------------------------------------
// Item 29: special blocks
// ---------------------------------------------------------------------------

export type SpecialBlockEligibility = { eligible: boolean; reasons: string[] };

export function specialBlockEligibility(input: {
  phaseKey: string | null;
  currentWeeklyMileage: number;
  marathonCyclesCompleted: number;
  pacingDisciplineGood: boolean;
  injuryProne: boolean;
  reboundingFromSetback: boolean;
  easyDaysBefore: number;
}): SpecialBlockEligibility {
  const reasons: string[] = [];
  const family = phaseFamily(input.phaseKey);
  if (family !== "supportive" && family !== "specific") {
    reasons.push("Only appropriate in the marathon-supportive or marathon-specific phases.");
  }
  if (input.currentWeeklyMileage < 70) reasons.push("Weekly mileage is below the 70 mile/week floor.");
  if (input.marathonCyclesCompleted < 1) reasons.push("No completed marathon cycle on record.");
  if (!input.pacingDisciplineGood) reasons.push("Pacing discipline is not strong enough for a session this dense.");
  if (input.injuryProne) reasons.push("Never for an injury-prone athlete.");
  if (input.reboundingFromSetback) reasons.push("Never when rebounding from a setback.");
  if (input.easyDaysBefore < 2) reasons.push("Needs at least two genuinely easy days immediately before it.");

  return { eligible: reasons.length === 0, reasons };
}

/** Maximum special blocks in a single buildup. */
export const SPECIAL_BLOCK_MAX_PER_BUILDUP = 3;
/** Multiplier cap on normal daily volume for a lower-mileage athlete's version of the block. */
export const SPECIAL_BLOCK_LOWER_MILEAGE_CAP = { min: 1.4, max: 1.7 } as const;

export type SpecialBlockDesignMode = "play-to-strengths" | "target-limiter";

export function specialBlockGuidance(
  eligibility: SpecialBlockEligibility,
  input: { designMode?: SpecialBlockDesignMode; isLowerMileageAthlete?: boolean } = {},
): AdvancedGuidance {
  if (!eligibility.eligible) {
    return note({
      key: "special-block:ineligible",
      title: "Not eligible for a special block right now",
      detail: "This is the densest single-day stimulus in the methodology and the eligibility bar is strict for a reason.",
      actions: eligibility.reasons,
    });
  }

  const modeNote =
    input.designMode === "target-limiter"
      ? "Designed here to target a limiter: aim the block at the specific quality that is actually holding this athlete back, accepting that it will feel uncomfortable precisely because it is not their strength."
      : "Designed here to play to strengths: let the block showcase what this athlete already does well, for a confidence-building, lower-risk version of the same stimulus.";

  return note({
    key: "special-block:guidance",
    title: "The power play: a massive, novel stimulus, used sparingly",
    detail: `AM and PM high-volume marathon-focused sessions (90-110% of marathon pace) delivered on one day for a stimulus no single session can replicate. Maximum ${SPECIAL_BLOCK_MAX_PER_BUILDUP} per buildup. The athlete needs to go in well-rested (two or more easy days before) and come out with three to six or more easy days after -- this is not a session to follow with anything but recovery.${
      input.isLowerMileageAthlete
        ? ` For a lower-mileage athlete, cap the day at ${SPECIAL_BLOCK_LOWER_MILEAGE_CAP.min} to ${SPECIAL_BLOCK_LOWER_MILEAGE_CAP.max} times their normal daily volume rather than running the full-mileage version.`
        : ""
    } ${modeNote}`,
    actions: [
      `No more than ${SPECIAL_BLOCK_MAX_PER_BUILDUP} in the whole buildup.`,
      "Confirm two or more easy days immediately before, and plan three to six or more easy days after.",
      input.isLowerMileageAthlete
        ? `Scale the day to ${SPECIAL_BLOCK_LOWER_MILEAGE_CAP.min}-${SPECIAL_BLOCK_LOWER_MILEAGE_CAP.max}x normal daily volume rather than the full version.`
        : "Keep the full-mileage version only for an athlete whose weekly volume genuinely supports it.",
      "Choose a design mode on purpose: play to strengths, or target the limiter, not an accident of what happened to be written.",
    ],
  });
}

// ---------------------------------------------------------------------------
// Item 30: strength training framework
// ---------------------------------------------------------------------------

export type StrengthOption = {
  key: "foundation" | "heavy-lifting" | "plyometrics" | "hill-sprints";
  name: string;
  description: string;
  /** When in the buildup this fits, in plain terms. */
  timing: string;
  /** Relative to the other three options. */
  injuryRisk: "lowest" | "moderate" | "highest";
};

/**
 * All four options, described with their real tradeoffs rather than a
 * single "best" recommendation -- the framework is fully individualised by
 * design, and foundation work is the one piece every athlete gets by
 * default regardless of which performance option, if any, sits on top of
 * it.
 */
export const STRENGTH_OPTIONS: StrengthOption[] = [
  {
    key: "foundation",
    name: "Foundation: modified pedestal + hip stability",
    description:
      "No equipment, minimal time, and it will not impair a workout the next day. The default injury-prevention base for every athlete, performance options or not.",
    timing: "Year-round, underneath everything else.",
    injuryRisk: "lowest",
  },
  {
    key: "heavy-lifting",
    name: "Heavy lifting",
    description:
      "Twice a week, two to three sets of four reps, calves and quads with compound movements. Start in the general phase; drop to 60-70% maintenance volume once supportive and specific work begins. Always lift AFTER the day's run, never before it.",
    timing: "Build in general, maintain through supportive and specific.",
    injuryRisk: "moderate",
  },
  {
    key: "plyometrics",
    name: "Plyometrics",
    description:
      "Maximum height, minimum ground contact time, five to twelve reps, built up over eight or more weeks. The highest injury risk of the three performance options -- introduce it slowly and never as a late addition under time pressure.",
    timing: "Needs eight-plus weeks to build; not a last-minute addition.",
    injuryRisk: "highest",
  },
  {
    key: "hill-sprints",
    name: "Hill sprints",
    description:
      "Ten-second maximal efforts on a grade of five percent or more, after an easy run. The most running-specific of the three, with minimal soreness, and usable year-round rather than confined to one phase.",
    timing: "Usable in any phase, year-round.",
    injuryRisk: "moderate",
  },
];

export function strengthTrainingGuidance(input: { confidentInChoice: boolean }): AdvancedGuidance {
  if (!input.confidentInChoice) {
    return note({
      key: "strength:default",
      title: "When in doubt, stability work only",
      detail:
        "There is no single best strength routine -- it is fully individualised. Absent a clear reason to add a performance option, the foundation (modified pedestal and hip-stability work) is the whole programme: no equipment, minimal time, and it never impairs the next day's run.",
      actions: [
        "Start with foundation work alone.",
        "Add a performance option only once there is a specific reason to.",
      ],
    });
  }

  return note({
    key: "strength:options",
    title: "Four options, real tradeoffs between them",
    detail:
      "Foundation work is the default for every athlete. On top of it, heavy lifting, plyometrics and hill sprints each buy something different and cost something different -- choose based on what this athlete needs, not on habit.",
    actions: STRENGTH_OPTIONS.map((option) => `${option.name}: ${option.timing} (${option.injuryRisk} injury risk).`),
  });
}
