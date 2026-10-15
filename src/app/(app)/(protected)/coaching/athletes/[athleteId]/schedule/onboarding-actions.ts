"use server";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import {
  checkOnboardingPrerequisites,
  mileageMatchCheck,
  offerCrashCourse,
  type CrashCourseOffer,
  type MileageMatchResult,
  type PrerequisiteCheck,
} from "@/lib/private-coaching/onboarding";
import { getTrainingBackground, resolveAnchorPeakMileage } from "@/lib/private-coaching/training-background";

// Part K item 31, coach-only. Reads the athlete's own profile and fitness
// estimate -- both already coach-readable -- rather than asking the coach
// to answer the checklist from memory.

export type OnboardingView = {
  error?: string;
  prerequisites?: PrerequisiteCheck;
  currentWeeklyMileage?: number | null;
  crashCourseOffer?: CrashCourseOffer;
  /** This coach's crash-course program ids, keyed by framework_key, for a direct assign link. */
  crashCourseProgramIds?: Record<string, string>;
};

async function requireCoachOf(athleteId: string) {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." as const };
  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("id")
    .eq("coach_id", session.userId)
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!relationship) return { error: "You don't coach this athlete." as const };
  return { session, supabase };
}

export async function loadOnboardingChecklist(input: { athleteId: string }): Promise<OnboardingView> {
  const auth = await requireCoachOf(input.athleteId);
  if ("error" in auth) return { error: auth.error };
  const { session, supabase } = auth;

  const [{ data: profile }, { data: estimate }, background] = await Promise.all([
    supabase
      .from("athlete_profiles")
      .select("current_weekly_mileage")
      .eq("user_id", input.athleteId)
      .maybeSingle<{ current_weekly_mileage: number | null }>(),
    supabase
      .from("athlete_fitness_estimates")
      .select("reference_key")
      .eq("athlete_id", input.athleteId)
      .eq("reference_key", "5k")
      .maybeSingle<{ reference_key: string }>(),
    getTrainingBackground(supabase, input.athleteId),
  ]);

  const currentWeeklyMileage = profile?.current_weekly_mileage ?? null;
  const prerequisites = checkOnboardingPrerequisites({ currentWeeklyMileage, has5kEstimate: estimate != null });

  const { data: crashProgramRows } = await supabase
    .from("training_programs")
    .select("id, framework_key")
    .eq("coach_id", session.userId)
    .in("framework_key", ["crash-course-i", "crash-course-ii", "crash-course-iii"])
    .returns<{ id: string; framework_key: string }[]>();
  const crashCourseProgramIds = Object.fromEntries((crashProgramRows ?? []).map((r) => [r.framework_key, r.id]));

  // New to structured training: assume nothing about a buildup that never
  // happened, even if some current mileage is on file -- always Level I,
  // never a mileage-matched guess.
  const crashCourseMileage = background?.source === "new_to_structured" ? null : currentWeeklyMileage;

  return {
    prerequisites,
    currentWeeklyMileage,
    crashCourseOffer: prerequisites.estimateReady ? undefined : offerCrashCourse(crashCourseMileage),
    crashCourseProgramIds,
  };
}

/** Part D item 8, exposed here since Part K's assignment flow needs it and Part D never got its own wiring. */
export async function checkMileageMatch(input: {
  athleteId: string;
  programId: string;
  /** The volume variant the coach picked, when the program has them. Its own starting mileage is a more specific comparison than the program-wide range. */
  volumeVariantId?: string | null;
}): Promise<{ error?: string; result?: MileageMatchResult }> {
  const auth = await requireCoachOf(input.athleteId);
  if ("error" in auth) return { error: auth.error };
  const { supabase } = auth;

  const [{ data: profile }, { data: program }, { data: variant }, background] = await Promise.all([
    supabase
      .from("athlete_profiles")
      .select("current_weekly_mileage")
      .eq("user_id", input.athleteId)
      .maybeSingle<{ current_weekly_mileage: number | null }>(),
    supabase
      .from("training_programs")
      .select("initial_mileage_min")
      .eq("id", input.programId)
      .maybeSingle<{ initial_mileage_min: number | null }>(),
    input.volumeVariantId
      ? supabase
          .from("program_volume_variants")
          .select("initial_mileage")
          .eq("id", input.volumeVariantId)
          .maybeSingle<{ initial_mileage: number | null }>()
      : Promise.resolve({ data: null as { initial_mileage: number | null } | null }),
    getTrainingBackground(supabase, input.athleteId),
  ]);

  const currentWeeklyMileage = profile?.current_weekly_mileage ?? null;

  return {
    result: mileageMatchCheck({
      athleteCurrentWeeklyRunningMileage: currentWeeklyMileage,
      // The variant's own starting mileage, when one was chosen, since
      // Canyon-40 and Canyon-50 start at genuinely different points and
      // the program-wide range would blur that.
      planStartingMileage: variant?.initial_mileage ?? program?.initial_mileage_min ?? null,
      // Real recorded history (self-trained, a previous coach, another
      // app), not an assumed prior cycle with this platform -- see
      // training-background.ts.
      anchorPeak: resolveAnchorPeakMileage({ background, currentWeeklyMileage }),
    }),
  };
}
