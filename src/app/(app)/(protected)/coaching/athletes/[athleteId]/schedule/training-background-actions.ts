"use server";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import {
  describeBackgroundForCoach,
  getTrainingBackground,
  resolveAnchorPeakMileage,
  type BackgroundContext,
  type TrainingBackground,
} from "@/lib/private-coaching/training-background";

// Coach-only read of an athlete's recorded training background, surfaced
// once on the schedule page so a coach sees it alongside everything else
// rather than having to go find it in the athlete's own settings.

export type TrainingBackgroundView = {
  error?: string;
  background?: TrainingBackground | null;
  context?: BackgroundContext;
  /** What volume-based guidance elsewhere on this page anchors on -- see training-background.ts's AnchorPeak. */
  anchorPeakMileage?: number | null;
  anchorReliable?: boolean;
};

export async function loadTrainingBackground(input: { athleteId: string }): Promise<TrainingBackgroundView> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("id")
    .eq("coach_id", session.userId)
    .eq("athlete_id", input.athleteId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!relationship) return { error: "You don't coach this athlete." };

  const [background, { data: profile }] = await Promise.all([
    getTrainingBackground(supabase, input.athleteId),
    supabase
      .from("athlete_profiles")
      .select("current_weekly_mileage")
      .eq("user_id", input.athleteId)
      .maybeSingle<{ current_weekly_mileage: number | null }>(),
  ]);

  const anchor = resolveAnchorPeakMileage({ background, currentWeeklyMileage: profile?.current_weekly_mileage ?? null });

  return {
    background,
    context: describeBackgroundForCoach(background),
    anchorPeakMileage: anchor.peakMileage,
    anchorReliable: anchor.reliable,
  };
}
