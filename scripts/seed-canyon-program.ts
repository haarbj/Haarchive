#!/usr/bin/env -S npx tsx
// SUPERSEDED as a template source. The canonical Canyon template is now the
// D2-seeded one from scripts/data/framework-seeds/canyon.json, loaded by
// scripts/seed-framework-programs.ts -- it carries the full peak-volume
// variant system (canyon-40/canyon-50), the real phase boundaries, and
// per-week goal mileage, none of which this script's source documents
// provide.
//
// This script and scripts/data/canyon-program.ts are deliberately KEPT, and
// are not dead: their structured content (per-day distances in meters, day
// labels, and real program_day_steps for the interval sessions) is exactly
// the material the D2 seeds lack, because those web-PDF transcriptions state
// each session as one prose string with its warm-up and cool-down bundled
// in. That content is the enrichment source for step-level authoring on the
// canonical template -- see docs/private-coaching/step-level-authoring-
// follow-up.md.
//
// Do not run this to create a template for a real athlete. Running it now
// produces a SECOND, competing Canyon program ("The Canyon Framework",
// framework_key NULL) alongside the canonical one.
// One-time loader for Brody's real Canyon Framework marathon template (see
// scripts/data/canyon-program.ts for the actual transcribed content and its
// own header comment on exactly what was and wasn't invented). Not run in
// CI -- a documented, manually-invoked script, matching this repo's
// scripts/ conventions (see audit-knowledge-checks.ts).
//
// Writes via a service-role client, not the coaching/programs Server
// Actions: a standalone script has no request-scoped session/cookies to
// call those with. Every value written here still passes through the same
// pure validators (validateDistanceRange/validateRpeRange/
// validatePacePercentRange) those Server Actions use, so a malformed
// source row fails loudly here rather than writing bad data silently.
//
// Can't import createServiceRoleClient from src/lib/db/service-role.ts
// as-is (that file starts with `import "server-only"`, which throws
// unconditionally under plain Node/tsx -- see
// src/lib/knowledge-checks/db.ts's own identical comment on this) --
// constructs the identical client inline instead.
//
// Usage:
//   npm run seed:canyon-program -- --coach-email=brody@example.com

import { createClient } from "@supabase/supabase-js";
import {
  CANYON_GENERAL_DAYS,
  CANYON_SUPPORTIVE_DAYS,
  CANYON_SPECIFIC_DAYS,
  CANYON_WEEK_NOTES,
  CANYON_DESCRIPTION,
  CANYON_INITIAL_MILEAGE_MIN,
  CANYON_INITIAL_MILEAGE_MAX,
  CANYON_PEAK_MILEAGE_MIN,
  CANYON_PEAK_MILEAGE_MAX,
  CANYON_TYPICAL_GOAL_TIMES,
  CANYON_RECOMMENDED_FOR,
  CANYON_GLOSSARY_TERMS,
  type CanyonDayInput,
} from "./data/canyon-program";
import { CANYON_STEPS, type CanyonStepInput } from "./data/canyon-steps";
import { validateDistanceRange, validatePacePercentRange } from "@/lib/private-coaching/workout-distance";

function createServiceRoleClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function validateRpeRangeInt(min: number | null, max: number | null): void {
  if (min != null && (min < 1 || min > 10)) throw new Error(`RPE out of range: ${min}`);
  if (max != null && (max < 1 || max > 10)) throw new Error(`RPE out of range: ${max}`);
  if (max != null && min != null && max < min) throw new Error(`RPE max < min: ${min}-${max}`);
}

async function resolveCoachIdByEmail(admin: ReturnType<typeof createServiceRoleClient>, email: string): Promise<string> {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (!data.nextPage) break;
    page = data.nextPage;
  }
  throw new Error(`No user found with email ${email}`);
}

// Mirrors steps.ts's own rangeError -- a min-only value is a point value,
// min+max is a range, max without min or max < min are both mistakes. Kept
// local (rather than importing validateStepRanges from steps.ts) since
// CanyonStepInput is a narrower authoring-time shape, not the full
// StepInput the app's editors round-trip through.
function stepRangeError(min: number | null, max: number | null, label: string): string | null {
  if (max != null && min == null) return `Enter a minimum ${label} before a maximum.`;
  if (max != null && min != null && max < min) return `A step's maximum ${label} can't be less than its minimum.`;
  return null;
}

function validateCanyonStep(step: CanyonStepInput): void {
  const distanceError = stepRangeError(step.distanceM, step.distanceMaxM, "distance");
  if (distanceError) throw new Error(distanceError);
  const durationError = stepRangeError(step.durationS, step.durationMaxS, "duration");
  if (durationError) throw new Error(durationError);
  const repsError = stepRangeError(step.repetitions, step.repetitionsMax, "repetitions");
  if (repsError) throw new Error(repsError);
  const restError = stepRangeError(step.restS, step.restMaxS, "rest");
  if (restError) throw new Error(restError);
  if (step.targetPacePercentMin != null || step.targetPacePercentMax != null) {
    const percentCheck = validatePacePercentRange(step.targetPacePercentMin, step.targetPacePercentMax);
    if (!percentCheck.valid) throw new Error(percentCheck.error);
  }
}

async function insertProgramDays(
  admin: ReturnType<typeof createServiceRoleClient>,
  programId: string,
  phaseDefinitionId: string,
  phaseKey: "General" | "Supportive" | "Specific",
  days: CanyonDayInput[],
): Promise<{ dayCount: number; stepCount: number }> {
  let dayCount = 0;
  let stepCount = 0;
  for (const day of days) {
    const distanceCheck = validateDistanceRange(day.plannedDistanceM, null);
    if (!distanceCheck.valid) throw new Error(distanceCheck.error);
    validateRpeRangeInt(day.plannedRpe, day.plannedRpeMax);
    const pacePercentCheck = validatePacePercentRange(day.pacePercentMin, day.pacePercentMax);
    if (!pacePercentCheck.valid) throw new Error(pacePercentCheck.error);

    const { data: dayRow, error } = await admin
      .from("program_days")
      .insert({
        program_id: programId,
        phase_definition_id: phaseDefinitionId,
        week_number: day.weekNumber,
        day_of_week: day.dayOfWeek,
        day_label: day.dayLabel,
        planned_distance_m: day.plannedDistanceM,
        planned_rpe: day.plannedRpe,
        planned_rpe_max: day.plannedRpeMax,
        pace_percent_basis: day.pacePercentBasis,
        pace_percent_min: day.pacePercentMin,
        pace_percent_max: day.pacePercentMax,
        notes: day.notes,
      })
      .select("id")
      .single();
    if (error) throw new Error(`program_days insert failed (week ${day.weekNumber}, day ${day.dayOfWeek}): ${error.message}`);
    dayCount += 1;

    const stepsEntry = CANYON_STEPS.find(
      (entry) => entry.phaseKey === phaseKey && entry.weekNumber === day.weekNumber && entry.dayOfWeek === day.dayOfWeek,
    );
    if (!stepsEntry) continue;

    for (const [index, step] of stepsEntry.steps.entries()) {
      validateCanyonStep(step);
      const { error: stepError } = await admin.from("program_day_steps").insert({
        program_day_id: dayRow.id,
        step_order: index,
        step_type: step.stepType,
        duration_s: step.durationS,
        duration_max_s: step.durationMaxS,
        distance_m: step.distanceM,
        distance_max_m: step.distanceMaxM,
        target_type: step.targetType,
        target_pace_percent_basis: step.targetPacePercentBasis,
        target_pace_percent_min: step.targetPacePercentMin,
        target_pace_percent_max: step.targetPacePercentMax,
        repetitions: step.repetitions,
        repetitions_max: step.repetitionsMax,
        rest_s: step.restS,
        rest_max_s: step.restMaxS,
        instructions: step.instructions,
      });
      if (stepError) {
        throw new Error(`program_day_steps insert failed (${phaseKey} week ${day.weekNumber}, day ${day.dayOfWeek}, step ${index}): ${stepError.message}`);
      }
      stepCount += 1;
    }
  }
  return { dayCount, stepCount };
}

async function main() {
  const emailArg = process.argv.find((a) => a.startsWith("--coach-email="));
  if (!emailArg) {
    console.error("Usage: npm run seed:canyon-program -- --coach-email=coach@example.com");
    process.exit(1);
  }
  const email = emailArg.split("=")[1];

  const admin = createServiceRoleClient();
  const coachId = await resolveCoachIdByEmail(admin, email);
  console.log(`Resolved coach ${email} -> ${coachId}`);

  const { data: existing } = await admin
    .from("training_programs")
    .select("id")
    .eq("coach_id", coachId)
    .eq("name", "The Canyon Framework")
    .maybeSingle();
  if (existing) {
    console.error(`A program named "The Canyon Framework" already exists for this coach (id ${existing.id}) -- delete it first if you want to reseed.`);
    process.exit(1);
  }

  const { data: program, error: programError } = await admin
    .from("training_programs")
    .insert({
      coach_id: coachId,
      name: "The Canyon Framework",
      description: CANYON_DESCRIPTION,
      // Deliberately false: scaling was built for the older imported-plan
      // format (training-plans/template.ts's own "[[N*multiplier]]"
      // placeholders), where quality/interval sessions are pace-based and
      // explicitly documented to pass through unscaled -- only generic
      // easy-day mileage used the placeholder. resolveProgramGeneration's
      // own distance scale (program-generation.ts Step 6) has no such
      // exemption: it multiplies every day's distance uniformly, including
      // step-level interval distances. Canyon's 25-34 -> 40-50 mi/wk
      // progression is the framework's own defining characteristic, not a
      // per-athlete dial -- scaling it would silently turn "7 x 1km at 95%
      // 5k" into some other, never-validated distance/pace combination.
      scales_distance_with_mileage: false,
      scales_duration_with_mileage: false,
      initial_mileage_min: CANYON_INITIAL_MILEAGE_MIN,
      initial_mileage_max: CANYON_INITIAL_MILEAGE_MAX,
      peak_mileage_min: CANYON_PEAK_MILEAGE_MIN,
      peak_mileage_max: CANYON_PEAK_MILEAGE_MAX,
      typical_goal_times: CANYON_TYPICAL_GOAL_TIMES,
      recommended_for: CANYON_RECOMMENDED_FOR,
      glossary_terms: CANYON_GLOSSARY_TERMS,
    })
    .select("id")
    .single();
  if (programError) throw new Error(`training_programs insert failed: ${programError.message}`);
  const programId = program.id as string;
  console.log(`Created program ${programId}`);

  // Base Phase: real, is_optional, deliberately empty -- see canyon-
  // program.ts's own header comment on why no content is authored here.
  const phaseInputs = [
    { phaseKey: "Base", name: "Base Phase", position: 1, durationWeeksMin: 2, durationWeeksMax: 6, isOptional: true, notes: "Optional lead-in for athletes with extra time before General begins. No content authored yet -- add real workouts here when ready." },
    { phaseKey: "General", name: null, position: 2, durationWeeksMin: 10, durationWeeksMax: 10, isOptional: false, notes: null },
    { phaseKey: "Supportive", name: null, position: 3, durationWeeksMin: 4, durationWeeksMax: 4, isOptional: false, notes: null },
    { phaseKey: "Specific", name: null, position: 4, durationWeeksMin: 4, durationWeeksMax: 4, isOptional: false, notes: null },
  ];

  const phaseIdByKey = new Map<string, string>();
  for (const phase of phaseInputs) {
    const { data, error } = await admin
      .from("program_phase_definitions")
      .insert({
        program_id: programId,
        phase_key: phase.phaseKey,
        name: phase.name,
        position: phase.position,
        duration_weeks_min: phase.durationWeeksMin,
        duration_weeks_max: phase.durationWeeksMax,
        is_optional: phase.isOptional,
        notes: phase.notes,
      })
      .select("id")
      .single();
    if (error) throw new Error(`program_phase_definitions insert failed (${phase.phaseKey}): ${error.message}`);
    phaseIdByKey.set(phase.phaseKey, data.id as string);
    console.log(`  Phase "${phase.phaseKey}" -> ${data.id}`);
  }

  const { data: variant, error: variantError } = await admin
    .from("program_duration_variants")
    .insert({ program_id: programId, name: "18-Week", is_default: true })
    .select("id")
    .single();
  if (variantError) throw new Error(`program_duration_variants insert failed: ${variantError.message}`);
  console.log(`Created variant "18-Week" -> ${variant.id}`);

  const variantPhaseOrder = ["Base", "General", "Supportive", "Specific"];
  const { error: variantPhasesError } = await admin.from("program_variant_phases").insert(
    variantPhaseOrder.map((key, index) => ({
      variant_id: variant.id,
      phase_definition_id: phaseIdByKey.get(key),
      position: index + 1,
    })),
  );
  if (variantPhasesError) throw new Error(`program_variant_phases insert failed: ${variantPhasesError.message}`);

  const general = await insertProgramDays(admin, programId, phaseIdByKey.get("General")!, "General", CANYON_GENERAL_DAYS);
  const supportive = await insertProgramDays(admin, programId, phaseIdByKey.get("Supportive")!, "Supportive", CANYON_SUPPORTIVE_DAYS);
  const specific = await insertProgramDays(admin, programId, phaseIdByKey.get("Specific")!, "Specific", CANYON_SPECIFIC_DAYS);

  console.log(
    `Inserted ${general.dayCount} General days (${general.stepCount} steps), ${supportive.dayCount} Supportive days (${supportive.stepCount} steps), ${specific.dayCount} Specific days (${specific.stepCount} steps).`,
  );

  for (const weekNote of CANYON_WEEK_NOTES) {
    const { error } = await admin.from("program_phase_weeks").insert({
      program_id: programId,
      phase_definition_id: phaseIdByKey.get(weekNote.phaseKey),
      week_number: weekNote.weekNumber,
      notes: weekNote.notes,
    });
    if (error) throw new Error(`program_phase_weeks insert failed (${weekNote.phaseKey} week ${weekNote.weekNumber}): ${error.message}`);
  }
  console.log(`Inserted ${CANYON_WEEK_NOTES.length} week-level notes.`);
  console.log(`Done. Review at /coaching/programs/${programId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
