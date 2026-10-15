"use server";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import {
  groupPhasesIntoCycles,
  suggestNextBuildup,
  type CyclePhaseInput,
  type NextBuildupSuggestion,
  type TrainingCycle,
} from "@/lib/private-coaching/multi-cycle";
import { getTrainingBackground, resolveAnchorPeakMileage } from "@/lib/private-coaching/training-background";

// Part G, coach-only. The athlete's buildup history and what should come
// next. Read-only: it derives the history from the phases already on their
// schedule rather than storing a second copy of it, so it cannot drift out
// of step with the training that actually happened.

export type MultiCycleView = {
  error?: string;
  cycles?: (TrainingCycle & { eventDistance: string | null })[];
  suggestion?: NextBuildupSuggestion;
  consecutiveMarathonCycles?: number;
};

type PhaseRow = {
  phase_type: string;
  start_date: string;
  end_date: string;
  source_program_id: string | null;
  source_program_volume_variant_id: string | null;
};

export async function loadMultiCycleHistory(input: {
  athleteId: string;
  /**
   * Whether the last cycle's injury cause is still unaddressed. The coach's
   * call, not something the platform can know: "was the root cause fixed"
   * is a clinical and contextual judgment, so it is asked rather than
   * inferred from logged pain.
   */
  unresolvedInjury?: boolean;
}): Promise<MultiCycleView> {
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

  const [{ data: phaseRows }, { data: profile }, background] = await Promise.all([
    supabase
      .from("training_phases")
      .select("phase_type, start_date, end_date, source_program_id, source_program_volume_variant_id")
      .eq("athlete_id", input.athleteId)
      .order("start_date", { ascending: true })
      .returns<PhaseRow[]>(),
    supabase
      .from("athlete_profiles")
      .select("current_weekly_mileage")
      .eq("user_id", input.athleteId)
      .maybeSingle<{ current_weekly_mileage: number | null }>(),
    getTrainingBackground(supabase, input.athleteId),
  ]);
  const priorHistory = resolveAnchorPeakMileage({
    background,
    currentWeeklyMileage: profile?.current_weekly_mileage ?? null,
  });

  const phases = phaseRows ?? [];
  if (phases.length === 0) {
    return {
      cycles: [],
      consecutiveMarathonCycles: 0,
      suggestion: suggestNextBuildup({ cycles: [], unresolvedInjury: false, consecutiveMarathonCycles: 0, priorHistory }),
    };
  }

  const programIds = [...new Set(phases.map((p) => p.source_program_id).filter((id): id is string => id != null))];
  const variantIds = [
    ...new Set(phases.map((p) => p.source_program_volume_variant_id).filter((id): id is string => id != null)),
  ];

  const [{ data: programs }, { data: variants }] = await Promise.all([
    programIds.length
      ? supabase
          .from("training_programs")
          .select("id, name, framework_key, event_distance")
          .in("id", programIds)
          .returns<{ id: string; name: string; framework_key: string | null; event_distance: string | null }[]>()
      : Promise.resolve({ data: [] as { id: string; name: string; framework_key: string | null; event_distance: string | null }[] }),
    variantIds.length
      ? supabase
          .from("program_volume_variants")
          .select("id, variant_key, peak_mileage")
          .in("id", variantIds)
          .returns<{ id: string; variant_key: string; peak_mileage: number | null }[]>()
      : Promise.resolve({ data: [] as { id: string; variant_key: string; peak_mileage: number | null }[] }),
  ]);

  const programById = new Map((programs ?? []).map((p) => [p.id, p]));
  const variantById = new Map((variants ?? []).map((v) => [v.id, v]));

  const inputs: CyclePhaseInput[] = phases.map((p) => {
    const program = p.source_program_id ? programById.get(p.source_program_id) : undefined;
    const variant = p.source_program_volume_variant_id ? variantById.get(p.source_program_volume_variant_id) : undefined;
    return {
      phaseKey: p.phase_type,
      startDate: p.start_date,
      endDate: p.end_date,
      programId: p.source_program_id,
      programName: program?.name ?? null,
      frameworkKey: program?.framework_key ?? null,
      volumeVariantKey: variant?.variant_key ?? null,
      peakMileage: variant?.peak_mileage ?? null,
    };
  });

  const grouped = groupPhasesIntoCycles(inputs);
  const eventDistanceForProgram = (programId: string | null) =>
    programId ? (programById.get(programId)?.event_distance ?? null) : null;
  const cycles = grouped.map((c) => ({ ...c, eventDistance: eventDistanceForProgram(c.programId) }));

  // Consecutive marathon buildups counting back from the most recent. A
  // cycle of unknown distance breaks the run rather than being assumed to
  // be a marathon: guessing would inflate the count and trigger the
  // longevity suggestion early.
  let consecutiveMarathonCycles = 0;
  for (let i = cycles.length - 1; i >= 0; i -= 1) {
    if (cycles[i].eventDistance === "marathon") consecutiveMarathonCycles += 1;
    else break;
  }

  return {
    cycles,
    consecutiveMarathonCycles,
    suggestion: suggestNextBuildup({
      cycles: grouped,
      unresolvedInjury: input.unresolvedInjury === true,
      consecutiveMarathonCycles,
      priorHistory,
    }),
  };
}
