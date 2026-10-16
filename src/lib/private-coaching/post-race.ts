// Part H: the post-race flow.
//
// Three things live here: the recovery program's own content, the
// athlete-facing explanations that go with it, and the coach-facing
// guidance that fires once a race date has passed. All pure; the server
// action and the panel are thin wrappers.
//
// The recovery program's days are transcribed from
// scripts/data/framework-seeds/post-marathon-recovery-program.md, which is
// original coaching copy written for this platform (its own footer says
// so). Transcribed into typed data here rather than parsed out of the
// markdown at seed time for the same reason the frameworks keep their
// interpretation in one tested module: a markdown table is a presentation
// format, and silently mis-parsing a row would put the wrong session on an
// athlete's calendar.
//
// THE 3-5 DAYS OFF ARE NOT A PHASE. The source opens with "Phase 0 - full
// rest: 3-5 days off", which is deliberately not week-aligned and
// deliberately a range. Modelling it as a one-week phase of seven "Off"
// days would both overstate it and put four invented rest days on the
// calendar. It is carried as program and phase prose instead, and the
// coach starts the program when the athlete starts running again.

import { parseDifficulty, type FrameworkSeedPlan, type SeedDay } from "@/lib/private-coaching/framework-seed";

export const RECOVERY_FRAMEWORK_KEY = "post-marathon-recovery";
export const RETURN_TO_RUNNING_PHASE = "Return to running";
export const RETURN_TO_TRAINING_PHASE = "Return to training";

/** One authored day of the recovery program. 1 = Monday. */
export type RecoveryDay = { phaseKey: string; weekNumber: number; dayOfWeek: number; prescription: string };

const RETURN_TO_RUNNING: string[][] = [
  // Week 1, Monday through Sunday.
  ["3-4 mi very easy", "Off", "4-5 mi very easy", "Off", "5 mi very easy", "5-6 mi easy", "Off"],
  // Week 2.
  [
    "5-6 mi easy",
    "4-5 mi light progression",
    "Off or 3-5 mi very easy",
    "5-7 mi very easy",
    "4-5 mi easy",
    "6-8 mi easy to moderate",
    "Off",
  ],
];

// The starred sessions in the source carry "a 1-2 mile progressive warm-up
// and a 1-2 mile easy cool-down"; that instruction is written into each of
// those days rather than left as a footnote the athlete has to carry.
const WARM_UP_NOTE = "1-2 mi progressive warm-up and 1-2 mi easy cool-down.";

const RETURN_TO_TRAINING: string[][] = [
  [
    "5 mi Kenyan-style progression + 1 mi easy",
    "4-5 mi very easy",
    "3 mi easy progressing to moderate, then 8-10 x 20 sec strides",
    "4-5 mi very easy",
    "6-8 mi easy to moderate",
    "5-8 mi very easy",
    "Off or 4-5 mi very easy",
  ],
  [
    "6-7 mi easy",
    "6 mi Kenyan-style progression + 1 mi easy",
    "5-7 mi easy",
    "3 mi easy progressing to moderate, then 8-10 x 20 sec strides (3-4 min rest), then 4 min fast (~116% of marathon pace effort), 1 mi easy cool-down",
    "5-7 mi very easy",
    "8-10 mi easy through rolling hills",
    "Off or 4-5 mi very easy to easy",
  ],
  [
    "6 mi Kenyan-style progression with fast finish + 1 mi easy",
    "5-8 mi easy",
    "8-12 x 1 min fast uphill (~115% of marathon pace effort), easy jog down (can do on flat ground)",
    "5-8 mi easy",
    `4-5 mi strong at 98-100% of marathon pace. ${WARM_UP_NOTE}`,
    "5-8 mi very easy",
    "11-12 mi easy through rolling hills",
  ],
  [
    "Off or 4-5 mi very easy",
    `5-8 x 3 min at 105% of marathon pace, 45 sec jog. ${WARM_UP_NOTE}`,
    "5-8 mi very easy",
    `4 km at 110% of marathon pace, 4-5 min walk/jog, then 6-8 x 1 min fast (~115% effort), 2 min jog. ${WARM_UP_NOTE}`,
    "5-8 mi very easy",
    `6-10 x 1 min fast uphill (~112-115% of marathon pace effort), easy jog down (can do on flat ground). ${WARM_UP_NOTE}`,
    "Off or 3-5 mi very easy",
  ],
];

export const RECOVERY_DAYS: RecoveryDay[] = [
  ...RETURN_TO_RUNNING.flatMap((week, weekIndex) =>
    week.map((prescription, dayIndex) => ({
      phaseKey: RETURN_TO_RUNNING_PHASE,
      weekNumber: weekIndex + 1,
      dayOfWeek: dayIndex + 1,
      prescription,
    })),
  ),
  ...RETURN_TO_TRAINING.flatMap((week, weekIndex) =>
    week.map((prescription, dayIndex) => ({
      phaseKey: RETURN_TO_TRAINING_PHASE,
      weekNumber: weekIndex + 1,
      dayOfWeek: dayIndex + 1,
      prescription,
    })),
  ),
];

/**
 * Athlete-facing explanations for the two recovery phases (item 21), in
 * the same format and voice as phase-explainers.ts's defaults, and gated
 * the same way: coached athletes and their coaches only.
 *
 * These exist because the recovery arc is the part of coaching an athlete
 * is most likely to quietly override. Easy running feels pointless when
 * you are not training for anything, and two full weeks on the couch feels
 * like the responsible choice. Both instincts are wrong, and an athlete who
 * knows WHY is far more likely to follow it than one handed a calendar.
 */
export const RECOVERY_PHASE_EXPLAINERS: Record<string, string> = {
  [RETURN_TO_RUNNING_PHASE]: `The marathon took two things from you, and they come back at different speeds. The sore, heavy legs are the obvious damage and they recover fairly quickly if you arrived well trained. The harder one is mental: a marathon is an enormous act of sustained concentration, and your motivation and appetite for structure are genuinely depleted afterwards in a way that has nothing to do with fitness.

So these two weeks are aimed at your head, not your body. Every run is very easy, every other day at most, and the only job is to make running feel like something you want to do again. Run with people. Run your favourite routes. Go somewhere scenic. If you get the urge to jump into a club workout or a long trail run, follow it, because the psychological benefit outweighs whatever it theoretically costs your recovery right now.

Expect these runs to feel slow and laborious. That is completely normal and completely unimportant. You are not trying to hold any pace, and there is nothing here to measure.

One rule is worth stating plainly: do not take two full weeks of complete rest. It feels like the responsible choice and it is not. It costs a meaningful amount of aerobic fitness, and more importantly the sudden drop in loading degrades the structural integrity of the tendons, bone and muscle that were adapted to carrying your training. That makes the first weeks back MORE likely to hurt you, not less. A few days off, then gentle movement, is what the tissue actually wants.

The exception is pain, or an injury the race caused or aggravated. That takes as long as it takes to resolve properly, and many injuries need active rehabilitation rather than rest. Tell your coach rather than running through it.`,

  [RETURN_TO_TRAINING_PHASE]: `This block rebuilds what the marathon specifically spent. The specific phase of your buildup narrowed you on purpose: it traded away speed, general fitness and anything far from marathon pace in order to make one pace sustainable for 26.2 miles. That trade was correct, and it leaves a gap.

So what comes back first is the general end of your fitness: progression runs, strides, short hills, moderate running, and a little genuinely fast work. None of it is marathon-specific, and that is the point. Whatever you do next, whether that is another marathon, a shorter distance, or nothing structured at all, it starts from a more complete base than the one you finished the race with.

Get the effort right and do not obsess over pacing. Weekly mileage totals are not important in this block either. Where a percentage of marathon pace appears, it is anchored to the marathon you just ran and it is a guide for effort rather than a split to hit.

You do not need the whole four weeks if your time is short. And when your legs feel good again and easy running feels like running again, you are done, even if that happens before the end.`,
};

/**
 * The recovery program as a seedable, coach-editable Program. Six weeks of
 * authored days across two phases, no volume variants: this block
 * deliberately prescribes no weekly mileage total, and inventing one would
 * contradict its own "weekly mileage totals are not critical" instruction.
 */
export function buildRecoveryProgramSeed(): FrameworkSeedPlan {
  const days: SeedDay[] = RECOVERY_DAYS.map((day) => ({
    phaseKey: day.phaseKey,
    weekNumber: day.weekNumber,
    dayOfWeek: day.dayOfWeek,
    sessionSlot: null,
    notes: day.prescription,
    isOptional: false,
    alternativeText: null,
    // The source publishes no difficulty ratings for this block, and
    // inventing them would be asserting something it does not say.
    difficultyLabel: parseDifficulty(null).label,
    plannedRpe: null,
    plannedRpeMax: null,
    isEventDay: false,
  }));

  return {
    program: {
      frameworkKey: RECOVERY_FRAMEWORK_KEY,
      name: "Post-marathon recovery",
      description:
        "About six weeks from finishing a marathon back to structured training: three to five days of full rest, then two weeks of return-to-running, then four weeks of return-to-training.\n\nThe three to five days off are not part of the authored weeks. They are deliberately a range and not week-aligned, so start this program on the day the athlete starts running again rather than the day after the race.\n\nThe early weeks target psychology rather than physiology. Easy, enjoyable running whose only job is to refill the tank. The one firm rule is that two full weeks of complete rest is the wrong choice: it costs real aerobic fitness and the sudden drop in loading degrades the structural integrity that makes the first weeks back safe.",
      eventDistance: "marathon",
      sourceReference:
        "Haarchive coaching platform default, authored for the post-race flow. Paces, where given, are percentages of the marathon just run.",
      typicalGoalTimes: null,
      recommendedFor: "Any athlete in the days after finishing a goal marathon.",
      initialMileageMin: null,
      initialMileageMax: null,
      peakMileageMin: null,
      peakMileageMax: null,
      glossaryTerms: null,
    },
    phases: [
      {
        phaseKey: RETURN_TO_RUNNING_PHASE,
        position: 1,
        durationWeeksMin: 2,
        durationWeeksMax: 2,
        notes:
          "Begin after at least three days of rest. Every run very easy to easy, every other day at most. Aimed at motivation rather than fitness, so enjoyment is the brief.",
        absoluteWeeks: [1, 2],
      },
      {
        phaseKey: RETURN_TO_TRAINING_PHASE,
        position: 2,
        durationWeeksMin: 4,
        durationWeeksMax: 4,
        notes:
          "Begin when the athlete feels ready for structure. Rebuilds the general fitness the specific phase traded away, so it also works as an introductory block whatever comes next. Stop early if they feel good before the end.",
        absoluteWeeks: [3, 4, 5, 6],
      },
    ],
    durationVariantName: "6-Week",
    volumeVariants: [],
    phaseWeeks: [],
    phaseWeekVolumes: [],
    days,
  };
}

// ---------------------------------------------------------------------------
// Item 19: the flow once a race date has passed
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((new Date(`${toDate}T00:00:00Z`).getTime() - new Date(`${fromDate}T00:00:00Z`).getTime()) / DAY_MS);
}

export type PostRaceStep = {
  key: "recovery-program" | "post-season-review" | "next-cycle";
  title: string;
  detail: string;
  /** Already dealt with, so the step is shown as done rather than nagged about. */
  done: boolean;
};

export type PostRaceFlow = {
  /** False when the race has not happened yet, or there is no race at all. */
  active: boolean;
  daysSinceRace: number | null;
  steps: PostRaceStep[];
  notes: string[];
};

/** How long after a race the flow keeps offering itself before going quiet. */
export const POST_RACE_FLOW_WINDOW_DAYS = 56;

/**
 * The three things to do after a goal race, in order, with whatever is
 * already done marked as such.
 *
 * Ordered deliberately: recovery is assigned first because it starts
 * immediately and the other two can wait; the review comes before planning
 * because planning the next cycle without it is how a coach repeats a
 * mistake; and the next cycle comes last for the same reason.
 *
 * Goes quiet after eight weeks. A flow that is still asking three months
 * later is noise, and by then the recovery arc has either happened or been
 * deliberately skipped.
 */
export function postRaceFlow(input: {
  raceDate: string | null;
  today: string;
  recoveryAssigned: boolean;
  reviewSent: boolean;
  nextCyclePlanned: boolean;
}): PostRaceFlow {
  if (!input.raceDate) return { active: false, daysSinceRace: null, steps: [], notes: [] };

  const daysSinceRace = daysBetween(input.raceDate, input.today);
  if (daysSinceRace < 0) return { active: false, daysSinceRace, steps: [], notes: [] };
  if (daysSinceRace > POST_RACE_FLOW_WINDOW_DAYS) return { active: false, daysSinceRace, steps: [], notes: [] };

  const notes: string[] = [];
  if (daysSinceRace <= 2) {
    notes.push(
      "Three to five days of full rest come first, and they are not part of the recovery program's authored weeks. Assign it now if you like, starting on the day they expect to run again.",
    );
  }

  return {
    active: true,
    daysSinceRace,
    steps: [
      {
        key: "recovery-program",
        title: "Assign the post-marathon recovery program",
        detail:
          "Six weeks: three to five days off, two weeks of return-to-running aimed at motivation rather than fitness, then four weeks rebuilding the general fitness the specific phase traded away. It carries its own explanations for the athlete, including why two full weeks of complete rest is the wrong choice.",
        done: input.recoveryAssigned,
      },
      {
        key: "post-season-review",
        title: "Send the post-season review",
        detail:
          "Before planning anything next. The athlete's own answers about which sessions they responded to, where they struggled, and what happened on race day are the raw material for making the next buildup theirs rather than another plan off the shelf. Asking afterwards gets you a worse answer, because by then the cycle has blurred.",
        done: input.reviewSent,
      },
      {
        key: "next-cycle",
        title: "Plan the next cycle",
        detail:
          "Another marathon buildup, a block at a different distance, or a period with no structure. The across-cycles suggestion covers which, and the review above should inform it.",
        done: input.nextCyclePlanned,
      },
    ],
    notes,
  };
}

// ---------------------------------------------------------------------------
// Item 20: the no-redemption-race guardrail
// ---------------------------------------------------------------------------

/** Inside this many days of a completed marathon, a new marathon buildup gets a warning. */
export const REDEMPTION_WINDOW_DAYS = 42;

export type RedemptionGuardrail = {
  flagged: boolean;
  title: string;
  detail: string;
  actions: string[];
};

/**
 * Starting a new marathon buildup too soon after the last marathon.
 *
 * The case this exists for is the disappointing race, where the instinct is
 * to find another marathon in six weeks and fix it. The physical damage is
 * the smaller half of why that fails; the depleted appetite for sustained
 * concentration is the larger half, and it does not respond to motivation.
 *
 * The DNF exception is real and deliberately narrow. An athlete who rolled
 * an ankle at 10K, got food poisoning the night before, or had the race
 * cancelled under them never ran the marathon. They are carrying a taper,
 * not a marathon, and redoing the final weeks for a race a few weeks later
 * is a reasonable plan rather than a redemption attempt. That is why it is
 * an input the coach sets rather than something inferred from a missing
 * finish time: "did not finish" and "did not run" look identical in the
 * data and are completely different situations.
 */
export function redemptionRaceGuardrail(input: {
  lastMarathonDate: string | null;
  newBuildupStartDate: string;
  /** The coach's judgment: the last race was a DNF from a one-off mishap, not a marathon that was run. */
  dnfFromMishap: boolean;
}): RedemptionGuardrail {
  const notFlagged: RedemptionGuardrail = { flagged: false, title: "", detail: "", actions: [] };
  if (!input.lastMarathonDate) return notFlagged;

  const gap = daysBetween(input.lastMarathonDate, input.newBuildupStartDate);
  if (gap < 0 || gap > REDEMPTION_WINDOW_DAYS) return notFlagged;

  if (input.dnfFromMishap) {
    return {
      flagged: false,
      title: "",
      detail: "",
      actions: [],
    };
  }

  return {
    flagged: true,
    title: `This buildup starts ${gap} day${gap === 1 ? "" : "s"} after a marathon`,
    detail:
      "A disappointing race is not a reason to race again immediately, and this is the single most common way a good athlete loses a season. The legs come back faster than people expect; the appetite for months of sustained concentration does not, and starting a buildup on an empty tank produces a worse race than the one being avenged. The full recovery arc first is the faster route to the time they want.",
    actions: [
      "Run the recovery arc first: the days off, the return to running, the return to training.",
      "Do the post-season review before committing to another date. It usually changes which race, and sometimes whether.",
      "If this was a did-not-finish from a one-off mishap rather than a marathon actually run, say so and this stops applying: there is no marathon to recover from and redoing the final weeks is reasonable.",
    ],
  };
}

// ---------------------------------------------------------------------------
// Item 19b: the post-season review
// ---------------------------------------------------------------------------
//
// Transcribed from scripts/data/framework-seeds/post-season-review-
// questionnaire.md, for the same reason the recovery days are: the markdown
// is the source artifact, and the app should not be parsing a presentation
// format to decide what to send.
//
// Sent through the coach-athlete messaging that already exists AND, as of
// the structured-capture follow-up below, as a real per-question record
// (see post-season-review-actions.ts and the post_season_review_requests/
// post_season_review_answers tables). The thread message stays the
// notification path -- an athlete who has the thread open sees the
// questions without navigating anywhere else -- but it is no longer the
// source of truth for the athlete's answers or for whether a review has
// already been sent.

export const POST_SEASON_REVIEW_TITLE = "Post-Season Review";

/**
 * No longer used to detect a resend (that's a real post_season_review_
 * requests row now, see post-season-review-actions.ts) -- kept as the
 * thread message's own title line, which a resend-detection no longer
 * depends on, so renaming it is safe.
 */
export const POST_SEASON_REVIEW_MARKER = "Post-Season Review";

export const POST_SEASON_REVIEW_INTRO =
  "You've finished the marathon, so before we plan what's next let's capture what this cycle taught you while it's fresh. There are no wrong answers here; the goal is to learn your own patterns so your next buildup is better than this one. Write as much or as little as you want, but do write it down. You'll thank yourself in a few months.";

export const POST_SEASON_REVIEW_SECTIONS: { heading: string; questions: string[] }[] = [
  {
    heading: "Reviewing your training",
    questions: [
      "On which days did you feel your strongest in workouts?",
      "On which days did you struggle the most in workouts?",
      "When in the cycle were you improving the most?",
      "Did this training cycle go better or worse than your previous ones? What was different?",
      "Was the plan too ambitious, too conservative, or just about right for you?",
      "Are there types of workouts, or elements of training, you feel you're missing?",
      "How long did it usually take you to feel recovered after your biggest workouts?",
      "Are you happy with how this training cycle went? Why or why not?",
      "What are your weak points as a runner right now, and what could you do about them?",
      "If you could make one change with the biggest impact on your next cycle, what would it be?",
    ],
  },
  {
    heading: "Reviewing the race",
    questions: [
      "Did you go into the race feeling confident? Why or why not?",
      "Did your race-morning routine work? Would you change anything if you ran this race again next year?",
      "Did you get in enough fuel before and during the race?",
      "Did your fueling plan cause any stomach problems?",
      "Were you prepared for the conditions: heat, hills, wind, all of it?",
      "Did the race unfold the way you expected it to?",
      "When did you struggle the most? When did you feel your strongest?",
      "Do you think a few more weeks of training, or a few fewer, would have changed the outcome?",
      "If you could run it again tomorrow at the same fitness, what would you do differently?",
    ],
  },
];

export const POST_SEASON_REVIEW_CLOSING =
  "Keep your answers somewhere you'll find them. When we sit down to plan your next cycle we'll go through them together: what you respond to, where you struggle, and what went right on race day are the raw material for making the next buildup yours rather than a plan off the shelf.";

/**
 * The questionnaire as a single message body, ready to post into the
 * thread. `raceName`, when known, names the race in the title line
 * ("Post-Season Review: Chicago Marathon") -- optional and defaulting to
 * the plain title so every existing call site (and POST_SEASON_REVIEW_
 * MARKER's own resend-detection use of the plain title) keeps working
 * unchanged.
 */
export function postSeasonReviewMessage(raceName?: string | null): string {
  const title = raceName ? `${POST_SEASON_REVIEW_TITLE}: ${raceName}` : POST_SEASON_REVIEW_TITLE;
  const sections = POST_SEASON_REVIEW_SECTIONS.map(
    (section) =>
      `${section.heading}\n${section.questions.map((question, index) => `${index + 1}. ${question}`).join("\n")}`,
  );
  return [title, POST_SEASON_REVIEW_INTRO, ...sections, POST_SEASON_REVIEW_CLOSING].join("\n\n");
}

/** One question, flattened out of its section, with the position that keys its stored answer. */
export type PostSeasonReviewQuestionRef = { sectionHeading: string; questionIndex: number; question: string };

/**
 * Every question in the questionnaire, flattened in display order. Used
 * both to pre-create one empty answer row per question when the coach
 * sends it, and to render the athlete's form -- a single source for "what
 * are the questions" rather than the sections array and the DB rows
 * drifting apart.
 */
export function postSeasonReviewQuestions(): PostSeasonReviewQuestionRef[] {
  return POST_SEASON_REVIEW_SECTIONS.flatMap((section) =>
    section.questions.map((question, questionIndex) => ({
      sectionHeading: section.heading,
      questionIndex,
      question,
    })),
  );
}
