// Part A: laying a plan out backwards from race day, and the shape of the
// final two weeks into it.
//
// Pure and DB-free, like program-generation.ts: every number a coach sees
// here traces to a function a unit test can check (see
// tests/lib/private-coaching/race-anchored-planning.test.ts). Nothing in
// this module writes anything or decides anything on its own -- it returns
// a PROPOSAL plus the reasoning behind it, and the coach confirms or
// adjusts before any plan is generated. That is a hard rule for this whole
// part, not a UI nicety: a phase layout is a coaching judgment about one
// athlete, and the platform's job is to do the arithmetic and show its
// work.
//
// WHERE THE PHASE RATIOS COME FROM. They are not invented and not a
// formula fitted to anything -- they are the real phase boundaries of the
// five seeded frameworks (scripts/data/framework-seeds/), which are this
// coach's own methodology at five different volume levels:
//
//     Canyon   40-50 mi    10 / 4 / 4     (little or no serious background)
//     Mesa     55-65 mi     8 / 5 / 5     (2+ years)
//     Ridge    70-80 mi     7 / 5 / 6     (3+ years)
//     Peak     85-95 mi     6 / 6 / 6     (4+ years)
//     Summit  100-120 mi    6 / 5 / 7     (very experienced)
//
// Read across them and the pattern the chapter describes is already there:
// as mileage and experience rise, General shrinks (10 -> 6) and Specific
// grows (4 -> 7), because a more experienced, higher-mileage athlete
// arrives with the general base already built and can spend more of the
// buildup on marathon-specific work. A less experienced athlete needs that
// general block, and the layout should say so rather than quietly handing
// them a specific-heavy plan.
//
// So a proposal for a NEW program is anchored to whichever of these five
// profiles the athlete actually resembles, then scaled to the weeks really
// available. For a seeded framework, whose phases are authored at fixed
// lengths, the proposal simply confirms the authored layout and the useful
// output is the FIT check instead ("this is an 18-week plan and the race
// is in 15 weeks").

/** A phase as the program authored it -- the proposal may never leave this range. */
export type PlannablePhase = {
  phaseDefinitionId: string;
  phaseKey: string;
  durationWeeksMin: number;
  durationWeeksMax: number;
  isOptional: boolean;
};

export type PhaseProfile = {
  key: string;
  /** Inclusive peak weekly mileage band this profile covers. */
  peakMileageMin: number;
  peakMileageMax: number;
  /** Years of running/marathon background this profile assumes. */
  experienceYearsMin: number;
  /** Authored week counts at the 18-week reference length. */
  general: number;
  supportive: number;
  specific: number;
};

/** The five real frameworks, lowest volume first. */
export const PHASE_PROFILES: PhaseProfile[] = [
  { key: "canyon", peakMileageMin: 0, peakMileageMax: 52, experienceYearsMin: 0, general: 10, supportive: 4, specific: 4 },
  { key: "mesa", peakMileageMin: 53, peakMileageMax: 67, experienceYearsMin: 2, general: 8, supportive: 5, specific: 5 },
  { key: "ridge", peakMileageMin: 68, peakMileageMax: 82, experienceYearsMin: 3, general: 7, supportive: 5, specific: 6 },
  { key: "peak", peakMileageMin: 83, peakMileageMax: 97, experienceYearsMin: 4, general: 6, supportive: 6, specific: 6 },
  { key: "summit", peakMileageMin: 98, peakMileageMax: Number.POSITIVE_INFINITY, experienceYearsMin: 5, general: 6, supportive: 5, specific: 7 },
];

/** The reference length every profile above is authored at. */
export const REFERENCE_PLAN_WEEKS = 18;

/**
 * Which profile an athlete resembles. Peak mileage selects the band;
 * experience can only pull the choice DOWN, never up.
 *
 * That asymmetry is deliberate. Running 85 miles a week in your second
 * year of marathon training does not make you a Peak athlete -- it makes
 * you someone carrying Peak's volume without Peak's background, and the
 * safer layout keeps more general work underneath it. The reverse case, a
 * very experienced athlete running modest mileage, is already well served
 * by the lower profile: their limiter is volume, not base.
 */
export function selectPhaseProfile(peakMileage: number, experienceYears: number | null): PhaseProfile {
  const byMileage =
    PHASE_PROFILES.find((p) => peakMileage >= p.peakMileageMin && peakMileage <= p.peakMileageMax) ?? PHASE_PROFILES[0];
  if (experienceYears == null) return byMileage;

  const allowedByExperience = [...PHASE_PROFILES]
    .filter((p) => experienceYears >= p.experienceYearsMin)
    .sort((a, b) => b.peakMileageMin - a.peakMileageMin)[0];
  if (!allowedByExperience) return PHASE_PROFILES[0];

  return allowedByExperience.peakMileageMin < byMileage.peakMileageMin ? allowedByExperience : byMileage;
}

export type PhaseLayoutFit =
  | { kind: "exact"; weeks: number }
  | { kind: "short"; weeksAvailable: number; weeksNeeded: number; shortfall: number }
  | { kind: "long"; weeksAvailable: number; weeksUsed: number; surplus: number };

export type ProposedPhaseWeeks = { phaseDefinitionId: string; phaseKey: string; weeks: number; include: boolean };

export type PhaseLayoutProposal = {
  profileKey: string;
  phases: ProposedPhaseWeeks[];
  totalWeeks: number;
  fit: PhaseLayoutFit;
  /** Advisory copy explaining the proposal. Never blocking, always shown before anything generates. */
  notes: string[];
};

const PHASE_ORDER_KEYS = ["general", "supportive", "specific"] as const;
type PhaseOrderKey = (typeof PHASE_ORDER_KEYS)[number];

function phaseOrderKey(phaseKey: string): PhaseOrderKey | null {
  const normalized = phaseKey.trim().toLowerCase();
  return (PHASE_ORDER_KEYS as readonly string[]).includes(normalized) ? (normalized as PhaseOrderKey) : null;
}

/**
 * Propose a week count per phase for a plan that has to finish on race day.
 *
 * Optional phases are proposed as EXCLUDED when the available weeks are
 * already fully committed, and included only when there is real room for
 * them. An optional lead-in block is the first thing to drop when time is
 * short, and the last thing to add when there is spare time.
 *
 * Every returned week count sits inside its phase's own authored
 * min/max -- this never proposes a plan the program does not allow.
 */
export function proposePhaseLayout(input: {
  phases: PlannablePhase[];
  weeksAvailable: number;
  peakMileage: number;
  experienceYears: number | null;
}): PhaseLayoutProposal {
  const { phases, weeksAvailable, peakMileage, experienceYears } = input;
  const profile = selectPhaseProfile(peakMileage, experienceYears);
  const notes: string[] = [];

  if (phases.length === 0) {
    return {
      profileKey: profile.key,
      phases: [],
      totalWeeks: 0,
      fit: { kind: "short", weeksAvailable, weeksNeeded: 0, shortfall: 0 },
      notes: ["This plan has no phases to lay out."],
    };
  }

  // A phase authored at a single fixed length (min === max) has nothing to
  // decide. When every phase is fixed, the layout IS the program, and the
  // only useful answer is whether it fits.
  const everyPhaseFixed = phases.every((p) => p.durationWeeksMin === p.durationWeeksMax);

  const required = phases.filter((p) => !p.isOptional);
  const optional = phases.filter((p) => p.isOptional);

  const minimumRequiredWeeks = required.reduce((n, p) => n + p.durationWeeksMin, 0);

  // Start every required phase at the profile's OWN authored length, not at
  // a proportional share of the weeks available.
  //
  // Scaling all three phases proportionally was tried first and is wrong:
  // compressing an 18-week layout into 12 weeks took the same two weeks out
  // of Specific as out of General, which is the opposite of the intended
  // priority. The marathon-specific block is what makes the race go, and
  // three or four weeks of it is already thin. So the reference shape is
  // the starting point and the DIFFERENCE is absorbed in priority order
  // below, which keeps Specific whole until General and Supportive have
  // both given up everything their authored minimums allow.
  const profileWeeksFor = (phaseKey: string): number | null => {
    const key = phaseOrderKey(phaseKey);
    return key == null ? null : profile[key];
  };

  const proposal = new Map<string, number>();
  for (const phase of required) {
    const reference = profileWeeksFor(phase.phaseKey);
    const target = reference == null ? phase.durationWeeksMin : reference;
    proposal.set(phase.phaseDefinitionId, clamp(target, phase.durationWeeksMin, phase.durationWeeksMax));
  }

  const unrecognized = required.filter((p) => phaseOrderKey(p.phaseKey) == null);
  if (unrecognized.length > 0) {
    notes.push(
      `${unrecognized.map((p) => p.phaseKey).join(", ")} ${unrecognized.length === 1 ? "is" : "are"} not a General, Supportive or Specific phase, so ${unrecognized.length === 1 ? "it was" : "they were"} left at the shortest length the program allows. Adjust ${unrecognized.length === 1 ? "it" : "them"} by hand.`,
    );
  }

  // Settle the difference between what the profile wants and the weeks
  // that actually exist.
  let total = sum(proposal);
  if (total < weeksAvailable) {
    // Spare time goes into General first. Extra general aerobic work is the
    // lowest-risk place to spend weeks, and it is what the lower-volume
    // frameworks do with their longer buildups.
    total = redistribute(proposal, required, weeksAvailable - total, "add", ["general", "supportive", "specific"]);
  } else if (total > weeksAvailable) {
    // Time comes out of General first and Specific last: the marathon-
    // specific block is the part that makes the race go, and it is the last
    // thing to compress.
    total = redistribute(proposal, required, total - weeksAvailable, "remove", ["general", "supportive", "specific"]);
  }

  // Optional phases are included only if there is still room.
  const includedOptional = new Set<string>();
  for (const phase of optional) {
    const remaining = weeksAvailable - total;
    if (remaining >= phase.durationWeeksMin) {
      const weeks = clamp(remaining, phase.durationWeeksMin, phase.durationWeeksMax);
      proposal.set(phase.phaseDefinitionId, weeks);
      includedOptional.add(phase.phaseDefinitionId);
      total += weeks;
    }
  }

  const fit: PhaseLayoutFit =
    total === weeksAvailable
      ? { kind: "exact", weeks: total }
      : total < weeksAvailable
        ? { kind: "long", weeksAvailable, weeksUsed: total, surplus: weeksAvailable - total }
        : { kind: "short", weeksAvailable, weeksNeeded: total, shortfall: total - weeksAvailable };

  if (everyPhaseFixed) {
    notes.push(
      `Every phase in this plan is authored at a fixed length, so these week counts are the plan's own layout rather than a suggestion.`,
    );
  } else {
    notes.push(
      `Laid out from the ${profile.key} shape (${profile.general}/${profile.supportive}/${profile.specific} over ${REFERENCE_PLAN_WEEKS} weeks), chosen for a peak of about ${peakMileage} miles a week${experienceYears != null ? ` and ${experienceYears} year${experienceYears === 1 ? "" : "s"} of background` : ""}.`,
    );
    if (weeksAvailable !== REFERENCE_PLAN_WEEKS) {
      notes.push(
        `Fitting that shape into ${weeksAvailable} weeks changes General first and the Specific block last, so the marathon-specific work stays as intact as the program's own phase limits allow.`,
      );
    }
  }

  if (fit.kind === "short") {
    notes.push(
      `This plan needs ${fit.weeksNeeded} weeks and there ${fit.weeksAvailable === 1 ? "is" : "are"} ${fit.weeksAvailable} before race day, so it is ${fit.shortfall} week${fit.shortfall === 1 ? "" : "s"} short even at the shortest lengths the program allows. Either move the start earlier, pick a shorter plan, or accept starting mid-plan.`,
    );
  } else if (fit.kind === "long") {
    notes.push(
      `These phases use ${fit.weeksUsed} of the ${fit.weeksAvailable} weeks before race day, leaving ${fit.surplus} spare. Spare weeks are usually best spent as easy general running before the plan starts, not bolted onto the specific block.`,
    );
  }

  if (minimumRequiredWeeks > weeksAvailable) {
    notes.push(
      `Be careful compressing a buildup to fit a date. Injury risk tracks how big a change is against what this athlete's body already handles, not the raw mileage.`,
    );
  }

  return {
    profileKey: profile.key,
    phases: phases.map((phase) => ({
      phaseDefinitionId: phase.phaseDefinitionId,
      phaseKey: phase.phaseKey,
      weeks: proposal.get(phase.phaseDefinitionId) ?? phase.durationWeeksMin,
      include: !phase.isOptional || includedOptional.has(phase.phaseDefinitionId),
    })),
    totalWeeks: total,
    fit,
    notes,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function sum(proposal: Map<string, number>): number {
  let total = 0;
  for (const weeks of proposal.values()) total += weeks;
  return total;
}

/**
 * Move `amount` weeks into or out of the proposal, one week at a time,
 * walking the given phase priority and skipping any phase already at its
 * authored limit. Returns the new total, which may still differ from the
 * target when every phase has hit a limit -- that is a real "doesn't fit"
 * answer and the caller reports it rather than forcing a number.
 */
function redistribute(
  proposal: Map<string, number>,
  phases: PlannablePhase[],
  amount: number,
  direction: "add" | "remove",
  priority: readonly PhaseOrderKey[],
): number {
  const ordered = priority
    .map((key) => phases.filter((p) => phaseOrderKey(p.phaseKey) === key))
    .flat()
    .concat(phases.filter((p) => phaseOrderKey(p.phaseKey) == null));

  // STRICT priority, not round-robin: each phase gives up (or takes on)
  // everything its authored range allows before the next phase is touched
  // at all. An earlier version took one week from each phase per pass,
  // which spread a six-week compression evenly across General, Supportive
  // and Specific and so defeated the whole point of having a priority.
  let remaining = amount;
  for (const phase of ordered) {
    if (remaining === 0) break;
    const current = proposal.get(phase.phaseDefinitionId) ?? phase.durationWeeksMin;
    const slack = direction === "add" ? phase.durationWeeksMax - current : current - phase.durationWeeksMin;
    if (slack <= 0) continue;
    const change = Math.min(slack, remaining);
    proposal.set(phase.phaseDefinitionId, direction === "add" ? current + change : current - change);
    remaining -= change;
  }
  return sum(proposal);
}

/**
 * Whole training weeks between a start date and race day.
 *
 * Deliberately floors: 130 days before a race is 18 whole weeks with four
 * days spare, not 19. Reporting the spare days as another week would let a
 * proposal claim a week that does not exist. The remainder is returned
 * separately so the caller can say "18 weeks and 4 days" rather than
 * silently dropping it.
 *
 * UTC, like every other date calculation in this codebase, because these
 * are calendar dates and not instants.
 */
export function weeksAvailableBetween(startDate: string, raceDate: string): { weeks: number; spareDays: number } {
  const start = new Date(`${startDate}T00:00:00Z`);
  const race = new Date(`${raceDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) throw new Error(`Invalid start date: ${JSON.stringify(startDate)}`);
  if (Number.isNaN(race.getTime())) throw new Error(`Invalid race date: ${JSON.stringify(raceDate)}`);

  const days = Math.round((race.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return { weeks: 0, spareDays: 0 };
  return { weeks: Math.floor(days / 7), spareDays: days % 7 };
}
