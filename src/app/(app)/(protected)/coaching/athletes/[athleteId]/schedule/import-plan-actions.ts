"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { resolvePlanImport, type AthleteReferenceInputs } from "@/lib/private-coaching/plan-import";
import { resolvePaceReference, type AthleteMostRecentRace } from "@/lib/private-coaching/pace-reference";
import { trainingPlanMap } from "@/lib/training-plans/data";
import type { TrackKey, DurationWeeks } from "@/lib/training-plans/types";
import { mostRecentMonday } from "@/lib/week";

export type ImportPlanInput = {
  athleteId: string;
  trackKey: TrackKey;
  durationWeeks: DurationWeeks;
  targetPeakWeeklyMiles: number;
  startDate: string; // must be a Monday
  // All optional -- none of this is stored anywhere on this platform
  // today (no persisted resting/max-HR field, and a reference race is
  // whatever the coach confirms in the import form, not a guaranteed
  // fact), so omitting any of it just means the days that would have
  // needed it keep their prose-only prescription (see plan-import.ts's
  // own comment on AthleteReferenceInputs) -- never a fabricated number.
  restingHr: number | null;
  maxHr: number | null;
  referenceRace: { distanceM: number; finishTimeS: number } | null;
};

export type ImportPlanResult = {
  error?: string;
  importedCount?: number;
  skippedDates?: string[];
  weeksCreated?: number;
};

// Bridges a self-serve training-plan track (src/lib/training-plans/) into
// real scheduled_workouts/training_week_plans/training_phases rows for a
// specific athlete -- "auto-select a pre-made plan, then edit the fields
// as needed" instead of building every week by hand. All resolution
// (scaling, day-label guessing, AM/PM splitting, date math) happens in the
// pure resolvePlanImport (see plan-import.ts); this action only handles
// authorization, conflict-avoidance, and the actual writes, mirroring
// copyWeek's own bulk-write shape (per-row loop, best-effort continue-on-
// error, never overwrite an occupied day or an existing week plan).
export async function importTrainingPlanTrack(input: ImportPlanInput): Promise<ImportPlanResult> {
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

  if (mostRecentMonday(new Date(`${input.startDate}T00:00:00Z`)) !== input.startDate) {
    return { error: "Start date must be a Monday." };
  }
  if (!Number.isFinite(input.targetPeakWeeklyMiles) || input.targetPeakWeeklyMiles <= 0) {
    return { error: "Enter a target peak weekly mileage greater than 0." };
  }

  const plan = trainingPlanMap.get(`${input.trackKey}-${input.durationWeeks}`);
  if (!plan) return { error: "Unknown training plan." };

  // The plan's own "at 96-102% 5k"/"at 108-110% MP" language becomes a
  // real pace target by projecting the confirmed reference race onto 5K
  // and marathon distance via the exact same Riegel-based resolution
  // pace-reference.ts already uses for the live pace-reference system --
  // reused here as a one-time snapshot computation instead (this import
  // bakes in a literal number once, like copyWeek copying a literal
  // value, not a continuously-recalculated reference; see plan-import.ts).
  let fiveKPaceSPerMi: number | null = null;
  let marathonPaceSPerMi: number | null = null;
  if (input.referenceRace) {
    const syntheticRace: AthleteMostRecentRace = {
      id: "import-reference",
      raceName: "reference race",
      raceDate: input.startDate,
      distanceM: input.referenceRace.distanceM,
      finishTimeS: input.referenceRace.finishTimeS,
    };
    fiveKPaceSPerMi = resolvePaceReference("5k", syntheticRace)?.minSPerMi ?? null;
    marathonPaceSPerMi = resolvePaceReference("marathon", syntheticRace)?.minSPerMi ?? null;
  }
  const athleteInputs: AthleteReferenceInputs = { restingHr: input.restingHr, maxHr: input.maxHr, fiveKPaceSPerMi, marathonPaceSPerMi };

  const resolved = resolvePlanImport(plan, input.targetPeakWeeklyMiles, input.startDate, athleteInputs);

  // Overlap check first -- training_phases has a real EXCLUDE constraint
  // per athlete (see savePhase's own identical in-app check, schedule/
  // actions.ts). Failing partway through a 100+ row import on a raw
  // constraint violation would leave a real mess to clean up, so this is
  // checked before any insert at all, not caught after the fact.
  const { data: existingPhases } = await supabase
    .from("training_phases")
    .select("id, start_date, end_date")
    .eq("athlete_id", input.athleteId)
    .returns<{ id: string; start_date: string; end_date: string }[]>();
  const overlaps = (existingPhases ?? []).some((p) => input.startDate <= p.end_date && resolved.endDate >= p.start_date);
  if (overlaps) return { error: "This date range overlaps an existing training phase for this athlete." };

  // Never overwrite an already-occupied day -- same never-clobber rule
  // copyWeek already uses for its own per-day skip logic.
  const { data: occupiedRows } = await supabase
    .from("scheduled_workouts")
    .select("scheduled_date")
    .eq("athlete_id", input.athleteId)
    .eq("coach_id", session.userId)
    .gte("scheduled_date", input.startDate)
    .lte("scheduled_date", resolved.endDate)
    .returns<{ scheduled_date: string }[]>();
  const occupiedDates = new Set((occupiedRows ?? []).map((r) => r.scheduled_date));

  const toInsert = resolved.days.filter((d) => !occupiedDates.has(d.scheduledDate));
  const skippedDates = [...new Set(resolved.days.filter((d) => occupiedDates.has(d.scheduledDate)).map((d) => d.scheduledDate))];

  const { error: phaseError } = await supabase.from("training_phases").insert({
    athlete_id: input.athleteId,
    coach_id: session.userId,
    phase_type: plan.trackLabel,
    name: `${plan.trackLabel} ${plan.durationWeeks}-Week ${plan.raceType} Plan`,
    start_date: input.startDate,
    end_date: resolved.endDate,
    goal_id: null,
    notes: null,
  });
  if (phaseError) return { error: phaseError.message };

  // Every generated workout lands as an unpublished draft -- the coach (or
  // self-coach) reviews the whole imported block before any of it becomes
  // visible, same safe-by-default convention copyWeek already uses.
  let importedCount = 0;
  for (const day of toInsert) {
    const { data: inserted, error } = await supabase
      .from("scheduled_workouts")
      .insert({
        athlete_id: input.athleteId,
        coach_id: session.userId,
        scheduled_date: day.scheduledDate,
        day_label: day.dayLabel,
        session_slot: day.sessionSlot,
        notes_from_coach: day.notesFromCoach,
        planned_distance_m: day.plannedDistanceM,
        planned_distance_max_m: day.plannedDistanceMaxM,
        planned_pace_s_per_mi: day.plannedPaceSPerMi,
        planned_pace_max_s_per_mi: day.plannedPaceMaxSPerMi,
        planned_hr_bpm: day.plannedHrBpm,
        planned_hr_max_bpm: day.plannedHrMaxBpm,
        published_at: null,
      })
      .select("id")
      .single();
    if (error || !inserted) continue; // best-effort -- one bad row shouldn't abort the rest of the import
    importedCount += 1;
  }

  let weeksCreated = 0;
  for (const week of resolved.weeks) {
    const { data: existingPlan } = await supabase
      .from("training_week_plans")
      .select("id")
      .eq("athlete_id", input.athleteId)
      .eq("week_start", week.weekStart)
      .maybeSingle();
    if (existingPlan) continue; // never overwrite a week plan the coach already set, same rule as saveWeekPlan/copyWeek

    const { error } = await supabase.from("training_week_plans").upsert(
      {
        athlete_id: input.athleteId,
        coach_id: session.userId,
        week_start: week.weekStart,
        label: null,
        target_volume_min: week.targetVolumeMin,
        target_volume_max: null,
        target_volume_unit: "miles",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "athlete_id,week_start" },
    );
    if (!error) weeksCreated += 1;
  }

  const admin = createServiceRoleClient();
  await admin.from("audit_log").insert({
    actor_id: session.userId,
    action: "training_plan_imported",
    entity_type: "training_phases",
    entity_id: input.athleteId,
    metadata: {
      track: input.trackKey,
      durationWeeks: input.durationWeeks,
      targetPeakWeeklyMiles: input.targetPeakWeeklyMiles,
      startDate: input.startDate,
      importedCount,
    },
  });

  revalidatePath(`/coaching/athletes/${input.athleteId}/schedule`);
  return { importedCount, skippedDates, weeksCreated };
}
