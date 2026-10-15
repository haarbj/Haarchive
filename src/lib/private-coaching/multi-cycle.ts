// Part G: multi-cycle progression. What this athlete has already done, and
// what the next buildup should be.
//
// Pure, coach-only, advisory. It proposes; the coach decides.
//
// The ladder below is not invented. It is the five seeded frameworks and
// their real peak-volume variants, in order, which makes it both the
// catalogue of what can be assigned and the progression itself. Worth
// noticing: every single step on that ladder is +5 or +10 miles a week,
// which is exactly the per-cycle limit the methodology sets. The ladder and
// the rule agree because the ladder was built from the same methodology,
// and a test asserts it stays that way.
//
// WHEN THERE IS NO COMPLETED BUILDUP ON THIS PLATFORM. The original version
// of this module only ever had on-platform cycles to work from, so "no
// completed buildup" fell back to matching the ladder against current
// weekly mileage -- fine for a genuinely brand-new runner, wrong for an
// athlete whose entire marathon buildup happened before they ever saw this
// platform (see training-background.ts's own header for the real case that
// exposed this). `priorHistory`, an optional AnchorPeak from that module,
// lets this function anchor on a recorded peak from self-training, a
// previous coach, or another plan/app instead of an assumed prior Brody
// cycle, and says so explicitly when that peak is itself only a fallback
// assumption rather than confirmed history.

import type { AnchorPeak } from "@/lib/private-coaching/training-background";

export type FrameworkRung = {
  frameworkKey: string;
  frameworkName: string;
  variantKey: string;
  peakMileage: number;
  /** Position in the whole ladder, 0-based. */
  position: number;
  /** Position of this framework among the five, so "stepping up a tier" is checkable. */
  tier: number;
};

const LADDER_SOURCE: { key: string; name: string; tier: number; peaks: number[] }[] = [
  { key: "canyon", name: "Canyon", tier: 0, peaks: [40, 50] },
  { key: "mesa", name: "Mesa", tier: 1, peaks: [55, 65] },
  { key: "ridge", name: "Ridge", tier: 2, peaks: [70, 80] },
  { key: "peak", name: "Peak", tier: 3, peaks: [85, 95] },
  { key: "summit", name: "Summit", tier: 4, peaks: [100, 110, 120] },
];

export const FRAMEWORK_LADDER: FrameworkRung[] = LADDER_SOURCE.flatMap((framework) =>
  framework.peaks.map((peak) => ({
    frameworkKey: framework.key,
    frameworkName: framework.name,
    variantKey: `${framework.key}-${peak}`,
    peakMileage: peak,
    position: 0,
    tier: framework.tier,
  })),
).map((rung, index) => ({ ...rung, position: index }));

/** The most a peak should move in one cycle. */
export const PEAK_STEP = { min: 5, max: 10 } as const;
/** How many marathon buildups before a different kind of block is worth suggesting. */
export const NON_MARATHON_BLOCK_AFTER = { min: 2, max: 4 } as const;

// ---------------------------------------------------------------------------
// What the athlete has already done
// ---------------------------------------------------------------------------

/** One assigned phase, as the athlete's own schedule records it. */
export type CyclePhaseInput = {
  phaseKey: string;
  startDate: string;
  endDate: string;
  /** Null for a hand-built phase that came from no Program. */
  programId: string | null;
  programName: string | null;
  frameworkKey: string | null;
  volumeVariantKey: string | null;
  peakMileage: number | null;
};

export type TrainingCycle = {
  programId: string | null;
  programName: string | null;
  frameworkKey: string | null;
  volumeVariantKey: string | null;
  peakMileage: number | null;
  startDate: string;
  endDate: string;
  phaseKeys: string[];
};

/**
 * Group an athlete's phases into cycles.
 *
 * A cycle is a run of consecutive phases generated from the SAME program
 * and the same volume variant. Two separate buildups off the same program
 * are still two cycles, because a gap in the dates separates them -- which
 * is why the grouping breaks on a gap rather than only on a change of
 * program.
 *
 * Phases built by hand, with no program behind them, are grouped the same
 * way on a null program id. They are real training and should appear in the
 * history; they just cannot contribute a peak mileage or a tier.
 */
export function groupPhasesIntoCycles(phases: CyclePhaseInput[], maxGapDays = 21): TrainingCycle[] {
  const ordered = [...phases].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
  const cycles: TrainingCycle[] = [];

  for (const phase of ordered) {
    const current = cycles[cycles.length - 1];
    const sameAssignment =
      current != null &&
      current.programId === phase.programId &&
      current.volumeVariantKey === phase.volumeVariantKey &&
      daysBetween(current.endDate, phase.startDate) <= maxGapDays;

    if (sameAssignment) {
      current.endDate = phase.endDate > current.endDate ? phase.endDate : current.endDate;
      current.phaseKeys.push(phase.phaseKey);
      if (current.peakMileage == null) current.peakMileage = phase.peakMileage;
      continue;
    }

    cycles.push({
      programId: phase.programId,
      programName: phase.programName,
      frameworkKey: phase.frameworkKey,
      volumeVariantKey: phase.volumeVariantKey,
      peakMileage: phase.peakMileage,
      startDate: phase.startDate,
      endDate: phase.endDate,
      phaseKeys: [phase.phaseKey],
    });
  }

  return cycles;
}

const DAY_MS = 24 * 60 * 60 * 1000;
function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((new Date(`${toDate}T00:00:00Z`).getTime() - new Date(`${fromDate}T00:00:00Z`).getTime()) / DAY_MS);
}

// ---------------------------------------------------------------------------
// What should come next
// ---------------------------------------------------------------------------

export type NextBuildupSuggestion = {
  /** The rung being suggested, when the ladder has an answer. */
  rung: FrameworkRung | null;
  /** Suggest a block that is not a marathon buildup at all. */
  suggestNonMarathonBlock: boolean;
  title: string;
  detail: string;
  actions: string[];
};

export function findRung(variantKey: string | null | undefined): FrameworkRung | null {
  if (!variantKey) return null;
  return FRAMEWORK_LADDER.find((rung) => rung.variantKey === variantKey) ?? null;
}

/**
 * Suggest the next buildup.
 *
 * The rules, in the order they override each other:
 *
 *   1. An unresolved injury cause outranks everything. Rebuild at a level
 *      already completed, because the thing that broke has not changed.
 *   2. Enough marathon buildups in a row, and the suggestion is to stop
 *      doing marathon buildups for a while. Longevity is the point, and it
 *      is the easiest thing to spend.
 *   3. Otherwise step one rung. Volume first, intensity second: finish a
 *      framework's own range before stepping up a tier, because the low and
 *      high ends of one framework are a smaller change than the jump to a
 *      harder one.
 */
export function suggestNextBuildup(input: {
  /** Completed cycles, oldest first. */
  cycles: TrainingCycle[];
  /** True when an injury happened in the last cycle and its cause has not been addressed. */
  unresolvedInjury: boolean;
  /** How many of the recent cycles were marathon buildups. */
  consecutiveMarathonCycles: number;
  /**
   * Recorded training-background peak, when there's no completed buildup on
   * this platform to work from instead (see this module's own header).
   * Optional and only ever consulted in that one branch, so omitting it
   * reproduces the exact prior behaviour.
   */
  priorHistory?: AnchorPeak | null;
}): NextBuildupSuggestion {
  const lastWithRung = [...input.cycles].reverse().find((cycle) => findRung(cycle.volumeVariantKey) != null);
  const currentRung = findRung(lastWithRung?.volumeVariantKey);

  if (input.unresolvedInjury) {
    return {
      rung: currentRung,
      suggestNonMarathonBlock: false,
      title: "Rebuild at a level they have already handled",
      detail:
        "An injury whose cause has not been found or fixed is a reason to repeat, not to progress. The body that broke down is the same body, and the load that broke it is still the load. Returning at a previously-completed peak costs one cycle; returning above it often costs several.",
      actions: [
        currentRung
          ? `Repeat ${currentRung.frameworkName} at ${currentRung.peakMileage} miles a week rather than stepping up.`
          : "Repeat the level they last completed rather than stepping up.",
        "Identify the cause first: strength deficits, a change in surface or shoes, a jump in load, or sleep and fuelling.",
        "Progress again only once the cause has actually been addressed, not once the pain has stopped.",
      ],
    };
  }

  if (input.consecutiveMarathonCycles >= NON_MARATHON_BLOCK_AFTER.max) {
    return {
      rung: currentRung,
      suggestNonMarathonBlock: true,
      title: `${input.consecutiveMarathonCycles} marathon buildups in a row is enough`,
      detail:
        "Marathon training is narrow by design: it trades away speed and general fitness to specialise, and stacking cycles back to back compounds that trade. A block at a different distance, or on trails, or with no structure at all, rebuilds the qualities the marathon has been quietly spending and is the cheapest longevity insurance available.",
      actions: [
        "Offer a 5K or 10K block, a half marathon block, or trail and ultra work.",
        "An unstructured period is a legitimate choice here, not a gap in the plan.",
        "Come back to the marathon afterwards at the same peak, not a higher one.",
      ],
    };
  }

  if (!currentRung) {
    const priorPeak = input.priorHistory?.peakMileage ?? null;

    if (priorPeak != null) {
      const reliableWord = input.priorHistory!.reliable ? "recorded" : "assumed";
      // The highest rung their recorded peak already covers -- the level
      // their body has already shown it can handle, even though it was
      // never a cycle on this platform.
      const matched = [...FRAMEWORK_LADDER].reverse().find((rung) => rung.peakMileage <= priorPeak) ?? null;

      if (matched) {
        const next = FRAMEWORK_LADDER[matched.position + 1] ?? null;
        return {
          rung: next ?? matched,
          suggestNonMarathonBlock: false,
          title: next
            ? `Step up to ${next.frameworkName} at ${next.peakMileage} miles a week`
            : `Already near the top of the ladder at their ${reliableWord} peak`,
          detail: [
            input.priorHistory!.note,
            next
              ? `Their ${reliableWord} peak of ${priorPeak} mi/week matches ${matched.frameworkName} at ${matched.peakMileage}, so the next cycle steps ${next.peakMileage - matched.peakMileage} miles a week from there -- inside the ${PEAK_STEP.min} to ${PEAK_STEP.max} a cycle tissue can actually keep up with, not from an assumed cycle with this platform.`
              : "No higher rung remains above the level their recorded peak already matches.",
          ].join(" "),
          actions: [
            next
              ? `Assign ${next.frameworkName} at the ${next.peakMileage} mile variant.`
              : "Repeat at this peak and change the work inside it rather than the total.",
            `Do not exceed ${PEAK_STEP.max} more miles a week at peak than their ${reliableWord} ${matched.peakMileage} mi/week peak.`,
            input.priorHistory!.reliable
              ? "Record this cycle once assigned so the next suggestion has real on-platform history to work from."
              : "This peak is an assumption, not confirmed history -- check it with the athlete before assigning.",
          ],
        };
      }

      return {
        rung: FRAMEWORK_LADDER[0],
        suggestNonMarathonBlock: false,
        title: "No completed buildup on record yet",
        detail: `${input.priorHistory!.note} Their ${reliableWord} peak of ${priorPeak} mi/week is below this ladder's own bottom rung, so start from ${FRAMEWORK_LADDER[0].frameworkName} at ${FRAMEWORK_LADDER[0].peakMileage} and let the next cycle be the first real data point.`,
        actions: [
          `Start with ${FRAMEWORK_LADDER[0].frameworkName} at the ${FRAMEWORK_LADDER[0].peakMileage} mile variant.`,
          "Record the cycle so the next suggestion has something to work from.",
        ],
      };
    }

    return {
      rung: FRAMEWORK_LADDER[0],
      suggestNonMarathonBlock: false,
      title: "No completed buildup on record yet",
      detail:
        "There is no finished cycle at a known peak volume to progress from. Start from the framework that matches what they are running now rather than from the ladder's bottom rung by default, and let the next cycle be the first real data point.",
      actions: [
        "Pick the framework whose starting mileage matches their current weekly mileage.",
        "Record the cycle so the next suggestion has something to work from.",
      ],
    };
  }

  const next = FRAMEWORK_LADDER[currentRung.position + 1] ?? null;
  if (!next) {
    return {
      rung: currentRung,
      suggestNonMarathonBlock: input.consecutiveMarathonCycles >= NON_MARATHON_BLOCK_AFTER.min,
      title: "Already at the top of the ladder",
      detail:
        "There is no higher rung in this methodology. More volume is not the remaining lever: at this level, progress comes from the quality and variability of the work rather than from the weekly total, and an athlete stagnating here usually needs more workout volume and more recovery rather than more miles.",
      actions: [
        "Repeat at this peak and change the work inside it rather than the total.",
        "Treat a plateau here as a signal to look at recovery, fuelling and workout quality.",
      ],
    };
  }

  const step = next.peakMileage - currentRung.peakMileage;
  const steppingTier = next.tier > currentRung.tier;

  return {
    rung: next,
    suggestNonMarathonBlock: false,
    title: steppingTier
      ? `Step up to ${next.frameworkName} at ${next.peakMileage} miles a week`
      : `Repeat ${next.frameworkName} at its higher ${next.peakMileage} miles a week`,
    detail: steppingTier
      ? `They have completed ${currentRung.frameworkName} at ${currentRung.peakMileage}, which is the top of its range, so the next step is the following framework. That is ${step} more miles a week at peak, inside the ${PEAK_STEP.min} to ${PEAK_STEP.max} a cycle that tissue can actually keep up with: tendons take months to adapt and bone longer still, and the weekly total is the part that outruns them.`
      : `They have completed ${currentRung.frameworkName} at ${currentRung.peakMileage}. Finishing a framework's own range before changing framework is the cheaper progression, and it is ${step} more miles a week at peak rather than a change in how the training is shaped. Volume first, intensity second.`,
    actions: [
      `Assign ${next.frameworkName} at the ${next.peakMileage} mile variant.`,
      `Do not exceed ${PEAK_STEP.max} more miles a week at peak than the last completed cycle.`,
      input.consecutiveMarathonCycles >= NON_MARATHON_BLOCK_AFTER.min
        ? `This would be marathon buildup ${input.consecutiveMarathonCycles + 1} in a row. A different block instead is worth offering.`
        : "Keep peak mileage arriving by the end of the general phase, not later.",
    ],
  };
}
