// Club intake: the auto-match proposal a batch approval queue shows the
// coach per submission. Pure, DB-free, advisory -- same rule as every
// other proposal in this part (see race-anchored-planning.ts and
// plan-selection-guidance.ts): nothing here blocks or assigns anything,
// it returns a recommendation plus the reasoning behind it, and the coach
// confirms or adjusts via the existing assign-program flow before any
// real plan is generated.
//
// Reuses selectPhaseProfile (race-anchored-planning.ts) for the
// framework pick -- the exact same Canyon/Mesa/Ridge/Peak/Summit
// peak-mileage x experience-years lookup an assigning coach already sees
// in the regular assign-program-form, not a second, parallel tier
// recommender. A submission's OWN current weekly mileage stands in for
// "peak mileage" here (no multiplier): for a beginner-heavy club intake
// this is intentionally conservative -- the real peak the coach picks for
// this athlete in the assign-program wizard afterward is still their
// call, informed by this proposal plus everything else they can see
// (e.g. an injury-history flag), never silently escalated from what the
// athlete reported.
import { MARATHON_READINESS_MILEAGE } from "@/lib/private-coaching/onboarding";
import { PHASE_PROFILES, selectPhaseProfile } from "@/lib/private-coaching/race-anchored-planning";

export { MARATHON_READINESS_MILEAGE };

export type ClubIntakeReadiness = {
  ready: boolean;
  detail: string;
};

/**
 * Field 1's readiness gate, stated kindly rather than as a rejection: under
 * the readiness mileage routes to base-building guidance, not a marathon
 * plan ("don't start barely hanging on" -- mileageMatchCheck's own line in
 * onboarding.ts, reused here as the same real threshold rather than a
 * second, different number).
 */
export function checkClubIntakeReadiness(currentWeeklyMileage: number): ClubIntakeReadiness {
  const ready = currentWeeklyMileage >= MARATHON_READINESS_MILEAGE;
  return {
    ready,
    detail: ready
      ? `Currently running ${currentWeeklyMileage} mi/week, at or above the ${MARATHON_READINESS_MILEAGE} mi/week readiness line.`
      : `Currently running ${currentWeeklyMileage} mi/week, below the ${MARATHON_READINESS_MILEAGE} mi/week readiness line. Keep coming to club runs and build toward ${MARATHON_READINESS_MILEAGE} mi/week -- you'll be set for the next cycle.`,
  };
}

export type ClubIntakeRecommendation = {
  frameworkKey: string;
  frameworkName: string;
  peakMileageMin: number;
  peakMileageMax: number;
  detail: string;
};

const FRAMEWORK_NAMES: Record<string, string> = {
  canyon: "Canyon",
  mesa: "Mesa",
  ridge: "Ridge",
  peak: "Peak",
  summit: "Summit",
};

/**
 * Fields 1, 3, and 4 together (mileage, experience, goal) -> a proposed
 * framework. Goal (finish vs. time target) doesn't change which framework
 * selectPhaseProfile picks -- it feeds the athlete's own goals row and the
 * eventual race-pace targets, not the volume/experience lookup -- so it is
 * accepted here only to keep this function's inputs matching the form's
 * own fields one-to-one, and is otherwise unused.
 */
export function recommendClubFramework(input: {
  currentWeeklyMileage: number;
  yearsRunning: number | null;
  goalType: "finish" | "time";
}): ClubIntakeRecommendation {
  void input.goalType;
  const profile = selectPhaseProfile(input.currentWeeklyMileage, input.yearsRunning);
  const name = FRAMEWORK_NAMES[profile.key] ?? profile.key;
  const peakRange = Number.isFinite(profile.peakMileageMax)
    ? `${profile.peakMileageMin}-${profile.peakMileageMax} mi/week`
    : `${profile.peakMileageMin}+ mi/week`;
  return {
    frameworkKey: profile.key,
    frameworkName: name,
    peakMileageMin: profile.peakMileageMin,
    peakMileageMax: Number.isFinite(profile.peakMileageMax) ? profile.peakMileageMax : profile.peakMileageMin + 20,
    detail: `${name} (${peakRange} peak), based on ${input.currentWeeklyMileage} mi/week current and ${input.yearsRunning ?? 0} year(s) running.`,
  };
}

export { PHASE_PROFILES };
