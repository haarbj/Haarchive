import type { WorkoutPrescription } from "@/lib/coaching-engine/types";

export type CompletionInput = {
  actualDistanceM: number | null;
  actualTimeS: number | null;
  rpe: number | null;
};

type PaceState = "faster" | "within" | "slower" | null;

// The RPE above which an effort cost more than this kind of session is
// meant to ask for, regardless of whether the pace itself landed in range.
const EXPECTED_RPE_CEILING: Record<Exclude<WorkoutPrescription["kind"], "race">, number> = {
  easy: 5,
  recovery: 4,
  long: 6,
  tempo: 8,
  vo2: 9,
};

// Deterministic and templated on purpose, not an AI call: this runs on
// every completed workout, and the AI provider's free tier is rate-limited
// per day -- a per-completion model call would exhaust it almost
// immediately for anyone training daily. See adaptations.ts/ai/model.ts for
// the same reasoning applied elsewhere in this app.
export function generateCompletionFeedback(
  prescription: WorkoutPrescription,
  completion: CompletionInput,
): string | null {
  const { rpe, actualDistanceM, actualTimeS } = completion;

  if (prescription.kind === "race") {
    if (rpe === null) return null;
    return "Race day. However today went, that effort is the payoff of every week that led up to it -- take real recovery before starting the next build.";
  }

  let paceState: PaceState = null;
  if (actualDistanceM && actualTimeS) {
    const actualSecPerKm = actualTimeS / (actualDistanceM / 1000);
    const [fast, slow] = prescription.paceRangeSecPerKm;
    paceState = actualSecPerKm < fast ? "faster" : actualSecPerKm > slow ? "slower" : "within";
  }
  if (paceState === null && rpe === null) return null;

  const rpeHigh = rpe !== null && rpe > EXPECTED_RPE_CEILING[prescription.kind];
  const isEasyLike = prescription.kind !== "tempo" && prescription.kind !== "vo2";

  if (isEasyLike) {
    if (rpeHigh || paceState === "faster") {
      return "That effort ran harder than an easy day is meant to. If you're feeling run-down, it's worth backing off tomorrow's workout too, not just today's.";
    }
    return "Excellent -- you stayed comfortably aerobic throughout today's run, which is exactly the point of an easy day.";
  }

  // Tempo / VO2.
  if (paceState === "slower") {
    return rpeHigh
      ? "Today's effort came in slower than target and felt harder than planned. That combination is worth paying attention to over the next few days -- fatigue, heat, or under-recovery can all explain it."
      : "Today's pace came in slower than the target -- that's fine. Hitting the effort honestly matters more than hitting the number.";
  }
  return rpeHigh
    ? "You hit the pace, but it cost more than this session is meant to cost. Worth keeping an eye on recovery before the next hard day."
    : "Solid work -- that's the controlled-hard effort this session was built around.";
}
