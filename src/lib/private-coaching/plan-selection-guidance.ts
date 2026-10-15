// Part D items 9 and 10: coach-only plan-selection guidance in the
// assignment flow, alongside the tier recommender (item 7, borrowed from
// Part A's selectPhaseProfile) and the mileage-match check (item 8,
// mileageMatchCheck in onboarding.ts).
//
// Pure, DB-free, advisory -- same rule as everything else in this part:
// nothing here blocks an assignment, it tells the coach what the horizon
// implies and lets them decide.

/** The only two lengths a program's own variants are actually authored at. See race-anchored-planning.ts's REFERENCE_PLAN_WEEKS for the 18-week default this agrees with. */
export const STANDARD_PLAN_WEEKS = [12, 18] as const;
export const DEFAULT_PLAN_WEEKS = 18;

/**
 * Item 10's own line, reused verbatim rather than restated per branch:
 * injury risk tracks how drastic a change is against what the athlete's
 * body already handles, not the absolute mileage or the absolute number
 * of weeks. A coach who wants the race sooner, wants it to still go fast,
 * and wants it low-risk is asking for all three at once -- this line says
 * that plainly instead of softening it into generic caution.
 */
export const CHOOSE_TWO_LINE = "Fast, soon, low-risk: choose two.";

export type DurationGuidance = {
  /** False when the horizon already matches a standard layout -- nothing to say. */
  flagged: boolean;
  title: string;
  detail: string;
  actions: string[];
};

/**
 * Item 9. What to do when the weeks until race day don't match either
 * standard layout (12 or 18 weeks), keyed off how far off it is:
 *
 *   - under 24 weeks, off either standard length (e.g. 14 or 21): close
 *     enough that stretching or compressing one of the two standard
 *     layouts is the right move -- the coach picks which.
 *   - exactly 24 weeks: long enough that stretching the 18-week layout by
 *     a third would itself be the drastic change. Prepend a dedicated
 *     base-building block instead of asking the standard layout to cover
 *     ground it was never authored for.
 *   - over 24 weeks: long enough that one buildup isn't the right shape
 *     at all. A mini-cycle (shorter distances, trail, or unstructured
 *     running) first, then the standard buildup once race day is within
 *     a normal horizon.
 *
 * 18 weeks stays the default recommendation throughout -- this function
 * only ever proposes adjusting around it, never replacing it with a new
 * standard length.
 */
export function durationSelectionGuidance(weeksUntilRace: number): DurationGuidance {
  if (!Number.isFinite(weeksUntilRace) || weeksUntilRace <= 0) {
    return { flagged: false, title: "", detail: "", actions: [] };
  }

  if ((STANDARD_PLAN_WEEKS as readonly number[]).includes(weeksUntilRace)) {
    return {
      flagged: false,
      title: "",
      detail: `${weeksUntilRace} weeks matches the standard ${weeksUntilRace}-week layout.`,
      actions: [],
    };
  }

  if (weeksUntilRace > 24) {
    return {
      flagged: true,
      title: "Longer than one buildup",
      detail:
        `Race day is ${weeksUntilRace} weeks out -- far enough that one mega-plan isn't the right shape. ` +
        `A mini-cycle first (shorter distances, trail, or unstructured running), then the standard ` +
        `${DEFAULT_PLAN_WEEKS}-week buildup once the race is within a normal horizon, asks less of this athlete's ` +
        `body than one long, stretched plan would. Injury risk tracks how drastic the change is against what ` +
        `this athlete's body already handles, not the number of weeks on the calendar. ${CHOOSE_TWO_LINE}`,
      actions: [
        "Run a mini-cycle first: shorter distances, trail, or unstructured running.",
        `Start the standard ${DEFAULT_PLAN_WEEKS}-week buildup once the race is within its normal range.`,
      ],
    };
  }

  if (weeksUntilRace === 24) {
    return {
      flagged: true,
      title: "24 weeks out",
      detail:
        `Race day is 24 weeks out. Rather than stretching the ${DEFAULT_PLAN_WEEKS}-week layout to fill that time, ` +
        `prepend a dedicated base-building block before it -- stretching the standard layout changes how drastic its ` +
        `own progression is, which is what drives injury risk, not the total mileage. ${CHOOSE_TWO_LINE}`,
      actions: [`Prepend about 6 weeks of base building before the standard ${DEFAULT_PLAN_WEEKS}-week plan.`],
    };
  }

  // Anything else that isn't 12 or 18: close enough to one of the two
  // standard layouts that extending or compressing it is the right move,
  // not a new block prepended in front of it.
  return {
    flagged: true,
    title: "Nonstandard horizon",
    detail:
      `Race day is ${weeksUntilRace} weeks out, which doesn't match either standard layout (12 or 18 weeks). ` +
      `Extend the 12-week layout or compress the ${DEFAULT_PLAN_WEEKS}-week layout to fit, rather than picking ` +
      `whichever is closer and letting it run short or long. Injury risk tracks how drastic that stretch or ` +
      `compression is against what this athlete's body already handles, not the absolute mileage. ${CHOOSE_TWO_LINE}`,
    actions: [
      "Extend the 12-week layout to fit the weeks available.",
      `Or compress the ${DEFAULT_PLAN_WEEKS}-week layout to fit instead.`,
    ],
  };
}
