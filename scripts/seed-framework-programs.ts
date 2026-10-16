#!/usr/bin/env -S npx tsx
// Loads the five verified marathon frameworks (Canyon/Mesa/Ridge/Peak/
// Summit) and, optionally, the three 5K Crash Course levels into the
// Program layer as coach-owned methodology content.
//
// All transcription rules live in src/lib/private-coaching/framework-seed.ts
// (pure, unit-tested -- see tests/lib/private-coaching/framework-seed.test.ts);
// this script only resolves the coach, calls the builder, and writes rows.
// Nothing here decides what a workout says.
//
// Writes via a service-role client rather than the Programs Server Actions
// for the same reason seed-canyon-program.ts does: a standalone script has
// no request-scoped session to call those with. It cannot import
// createServiceRoleClient from src/lib/db/service-role.ts either (that file
// starts with `import "server-only"`, which throws under plain Node/tsx),
// so it constructs the identical client inline.
//
// Idempotent by (coach_id, framework_key), which the schema enforces with a
// partial unique index: re-running without --replace reports what already
// exists and changes nothing.
//
// Usage:
//   npm run seed:framework-programs -- --coach-email=brody@example.com
//   npm run seed:framework-programs -- --coach-email=... --frameworks=peak,summit
//   npm run seed:framework-programs -- --coach-email=... --crash-course
//   npm run seed:framework-programs -- --coach-email=... --race-lead-in
//   npm run seed:framework-programs -- --coach-email=... --recovery-program
//   npm run seed:framework-programs -- --coach-email=... --frameworks=canyon --replace

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildRecoveryProgramSeed, recoveryWorksheetEntries } from "@/lib/private-coaching/post-race";
import { buildRaceLeadInSeed } from "@/lib/private-coaching/race-lead-in";
import {
  buildCrashCourseSeeds,
  buildFrameworkSeed,
  type FrameworkSeedPlan,
  type RawCrashCourse,
  type RawFramework,
} from "@/lib/private-coaching/framework-seed";
import { attachFrameworkStructure, type WorksheetEntry } from "@/lib/private-coaching/framework-structure";
import { MILE_METERS } from "@/lib/race-distances";
import { writeLabelingWorksheet } from "./labeling-worksheet";

const FRAMEWORK_KEYS = ["canyon", "mesa", "ridge", "peak", "summit"] as const;
const SEED_DIR = path.join(process.cwd(), "scripts/data/framework-seeds");
// Supabase rejects very large single inserts; the biggest framework
// (Summit) is 211 day rows, so day/volume writes are chunked.
const INSERT_CHUNK = 100;

type Admin = ReturnType<typeof createServiceRoleClient>;

function createServiceRoleClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function arg(name: string): string | null {
  const match = process.argv.find((a) => a.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : null;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function resolveCoachIdByEmail(admin: Admin, email: string): Promise<string> {
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

async function insertChunked(admin: Admin, table: string, rows: Record<string, unknown>[], label: string): Promise<void> {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const { error } = await admin.from(table).insert(rows.slice(i, i + INSERT_CHUNK));
    if (error) throw new Error(`${table} insert failed (${label}, rows ${i}-${i + INSERT_CHUNK}): ${error.message}`);
  }
}

/** Same chunking as insertChunked, but returns inserted ids in input order -- needed for program_days, whose ids program_day_steps below must reference. */
async function insertChunkedReturningIds(admin: Admin, table: string, rows: Record<string, unknown>[], label: string): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const { data, error } = await admin.from(table).insert(rows.slice(i, i + INSERT_CHUNK)).select("id");
    if (error) throw new Error(`${table} insert failed (${label}, rows ${i}-${i + INSERT_CHUNK}): ${error.message}`);
    ids.push(...data.map((r) => r.id as string));
  }
  return ids;
}

const miToM = (mi: number | null | undefined): number | null => (mi == null ? null : Math.round(mi * MILE_METERS));

async function seedPlan(admin: Admin, coachId: string, plan: FrameworkSeedPlan, replace: boolean): Promise<boolean> {
  const { program } = plan;

  const { data: existing, error: existingError } = await admin
    .from("training_programs")
    .select("id")
    .eq("coach_id", coachId)
    .eq("framework_key", program.frameworkKey)
    .maybeSingle();
  if (existingError) throw new Error(`lookup failed (${program.frameworkKey}): ${existingError.message}`);

  if (existing) {
    if (!replace) {
      console.log(`  ${program.name}: already seeded (${existing.id}) -- skipped. Pass --replace to rebuild it.`);
      return false;
    }
    // Cascades to every phase definition, variant, week and day below it.
    // Any athlete phase already generated from this program keeps its real
    // training data -- training_phases' provenance columns are ON DELETE
    // SET NULL -- but loses the link back to the program, so "Resync from
    // program" will no longer be offered for it.
    const { error: deleteError } = await admin.from("training_programs").delete().eq("id", existing.id);
    if (deleteError) throw new Error(`delete failed (${program.frameworkKey}): ${deleteError.message}`);
    console.log(`  ${program.name}: replaced existing ${existing.id}`);
  }

  const { data: inserted, error: programError } = await admin
    .from("training_programs")
    .insert({
      coach_id: coachId,
      name: program.name,
      description: program.description,
      framework_key: program.frameworkKey,
      event_distance: program.eventDistance,
      source_reference: program.sourceReference,
      // Deliberately false, for the same reason seed-canyon-program.ts
      // documents: resolveProgramGeneration's distance scaling multiplies
      // every authored distance uniformly, including interval distances,
      // which would silently turn "8 x 1 km at 95% 5k" into some other,
      // never-validated distance. These frameworks express volume through
      // their own peak-volume variants instead -- that IS the mechanism.
      scales_distance_with_mileage: false,
      scales_duration_with_mileage: false,
      initial_mileage_min: program.initialMileageMin,
      initial_mileage_max: program.initialMileageMax,
      peak_mileage_min: program.peakMileageMin,
      peak_mileage_max: program.peakMileageMax,
      typical_goal_times: program.typicalGoalTimes,
      recommended_for: program.recommendedFor,
      glossary_terms: program.glossaryTerms,
    })
    .select("id")
    .single();
  if (programError) throw new Error(`training_programs insert failed (${program.frameworkKey}): ${programError.message}`);
  const programId = inserted.id as string;

  const phaseIdByKey = new Map<string, string>();
  for (const phase of plan.phases) {
    const { data, error } = await admin
      .from("program_phase_definitions")
      .insert({
        program_id: programId,
        phase_key: phase.phaseKey,
        name: null,
        position: phase.position,
        duration_weeks_min: phase.durationWeeksMin,
        duration_weeks_max: phase.durationWeeksMax,
        is_optional: false,
        notes: phase.notes,
      })
      .select("id")
      .single();
    if (error) throw new Error(`program_phase_definitions insert failed (${phase.phaseKey}): ${error.message}`);
    phaseIdByKey.set(phase.phaseKey, data.id as string);
  }

  const { data: durationVariant, error: durationVariantError } = await admin
    .from("program_duration_variants")
    .insert({ program_id: programId, name: plan.durationVariantName, is_default: true })
    .select("id")
    .single();
  if (durationVariantError) {
    throw new Error(`program_duration_variants insert failed (${program.frameworkKey}): ${durationVariantError.message}`);
  }

  const { error: variantPhasesError } = await admin.from("program_variant_phases").insert(
    plan.phases.map((phase) => ({
      variant_id: durationVariant.id,
      phase_definition_id: phaseIdByKey.get(phase.phaseKey),
      position: phase.position,
    })),
  );
  if (variantPhasesError) throw new Error(`program_variant_phases insert failed: ${variantPhasesError.message}`);

  const volumeVariantIdByKey = new Map<string, string>();
  for (const variant of plan.volumeVariants) {
    const { data, error } = await admin
      .from("program_volume_variants")
      .insert({
        program_id: programId,
        variant_key: variant.variantKey,
        name: variant.name,
        position: variant.position,
        peak_mileage: variant.peakMileage,
        initial_mileage: variant.initialMileage,
        is_default: variant.isDefault,
      })
      .select("id")
      .single();
    if (error) throw new Error(`program_volume_variants insert failed (${variant.variantKey}): ${error.message}`);
    volumeVariantIdByKey.set(variant.variantKey, data.id as string);
  }

  await insertChunked(
    admin,
    "program_phase_weeks",
    plan.phaseWeeks.map((week) => ({
      program_id: programId,
      phase_definition_id: phaseIdByKey.get(week.phaseKey),
      week_number: week.weekNumber,
      // Deliberately no label: these sources don't name their weeks, and
      // inventing "Down Week"/"Peak Week" would be this script asserting
      // something the framework didn't.
      label: null,
      notes: week.notes,
      revise_fitness_estimate: week.reviseFitnessEstimate,
      convert_fitness_estimate_to_mp: week.convertFitnessEstimateToMp,
    })),
    program.frameworkKey,
  );

  await insertChunked(
    admin,
    "program_phase_week_volumes",
    plan.phaseWeekVolumes.map((volume) => ({
      volume_variant_id: volumeVariantIdByKey.get(volume.variantKey),
      phase_definition_id: phaseIdByKey.get(volume.phaseKey),
      week_number: volume.weekNumber,
      goal_mileage_label: volume.goalMileageLabel,
      goal_mileage_min: volume.goalMileageMin,
      goal_mileage_max: volume.goalMileageMax,
    })),
    program.frameworkKey,
  );

  const dayIds = await insertChunkedReturningIds(
    admin,
    "program_days",
    plan.days.map((day) => ({
      program_id: programId,
      phase_definition_id: phaseIdByKey.get(day.phaseKey),
      week_number: day.weekNumber,
      day_of_week: day.dayOfWeek,
      session_slot: day.sessionSlot,
      // The authored prescription, verbatim and unparsed -- see
      // framework-seed.ts's header on why this is not split into steps.
      notes: day.notes,
      is_optional: day.isOptional,
      alternative_text: day.alternativeText,
      difficulty_label: day.difficultyLabel,
      planned_rpe: day.plannedRpe,
      planned_rpe_max: day.plannedRpeMax,
      is_event_day: day.isEventDay,
      // Populated only by the separate interpretation layer
      // (framework-structure.ts) attached onto `day` before this function
      // sees it -- absent entirely for a plan this script hasn't merged
      // structure onto. See framework-seed.ts's header.
      planned_distance_m: miToM(day.distanceMiMin),
      planned_distance_max_m: miToM(day.distanceMiMax),
    })),
    program.frameworkKey,
  );

  const stepRows: Record<string, unknown>[] = [];
  plan.days.forEach((day, i) => {
    for (const step of day.steps ?? []) {
      stepRows.push({
        program_day_id: dayIds[i],
        step_order: step.stepOrder,
        step_type: step.stepType,
        duration_s: step.durationS,
        duration_max_s: step.durationMaxS,
        distance_m: step.distanceM,
        distance_max_m: step.distanceMaxM,
        target_type: step.targetPacePercentBasis != null ? "pace" : "open",
        target_pace_percent_basis: step.targetPacePercentBasis,
        target_pace_percent_min: step.targetPacePercentMin,
        target_pace_percent_max: step.targetPacePercentMax,
        repetitions: step.repetitions,
        repetitions_max: step.repetitionsMax,
        rest_s: step.restS,
        rest_max_s: step.restMaxS,
        instructions: step.instructions,
      });
    }
  });
  if (stepRows.length) await insertChunked(admin, "program_day_steps", stepRows, program.frameworkKey);

  const doubles = plan.days.filter((d) => d.sessionSlot != null).length;
  const withDistance = plan.days.filter((d) => d.distanceMiMin != null).length;
  console.log(
    `  ${program.name}: ${programId}\n` +
      `      phases=${plan.phases.map((p) => `${p.phaseKey}(${p.durationWeeksMin}w)`).join(" ")}\n` +
      `      volume variants=${plan.volumeVariants.map((v) => v.variantKey).join(", ")}\n` +
      `      sessions=${plan.days.length} (${doubles} in an AM/PM slot), optional=${plan.days.filter((d) => d.isOptional).length}, ` +
      `alternatives=${plan.days.filter((d) => d.alternativeText).length}\n` +
      `      week goal-mileage rows=${plan.phaseWeekVolumes.length}, phase weeks=${plan.phaseWeeks.length}\n` +
      `      structured distance=${withDistance}/${plan.days.length}, structured steps=${stepRows.length} rows`,
  );
  return true;
}

async function main() {
  const coachEmail = arg("coach-email");
  if (!coachEmail) {
    console.error("Usage: npm run seed:framework-programs -- --coach-email=you@example.com [--frameworks=canyon,peak] [--crash-course] [--replace]");
    process.exit(1);
  }

  const requested = arg("frameworks");
  const frameworks = requested ? requested.split(",").map((f) => f.trim().toLowerCase()).filter(Boolean) : [...FRAMEWORK_KEYS];
  const unknown = frameworks.filter((f) => !(FRAMEWORK_KEYS as readonly string[]).includes(f));
  if (unknown.length) throw new Error(`Unknown framework(s): ${unknown.join(", ")}. Known: ${FRAMEWORK_KEYS.join(", ")}`);

  const replace = flag("replace");
  const admin = createServiceRoleClient();
  const coachId = await resolveCoachIdByEmail(admin, coachEmail);
  console.log(`Coach ${coachEmail} -> ${coachId}`);

  // Every plan is built (and therefore fully validated) before anything is
  // written, so a bad seed file fails before it can leave a half-loaded
  // framework behind.
  //
  // Each framework's structured distance/steps (attachFrameworkStructure)
  // are merged on immediately after buildFrameworkSeed, by the same array
  // index both walk -- see framework-structure.ts's own header on why
  // that merge, not buildFrameworkSeed itself, owns this interpretation.
  const worksheetEntries: WorksheetEntry[] = [];
  const plans: FrameworkSeedPlan[] = frameworks.map((key) => {
    const raw = JSON.parse(readFileSync(path.join(SEED_DIR, `${key}.json`), "utf8")) as RawFramework;
    const { plan, worksheet } = attachFrameworkStructure(buildFrameworkSeed(raw), raw);
    worksheetEntries.push(...worksheet);
    return plan;
  });
  if (flag("crash-course")) {
    plans.push(
      ...buildCrashCourseSeeds(JSON.parse(readFileSync(path.join(SEED_DIR, "crash-course.json"), "utf8")) as RawCrashCourse),
    );
  }
  // The two-week race lead-in (Part A item 2). Seeded as an ordinary
  // editable Program so the coach can change the standard once instead of
  // re-editing fourteen days per athlete; its default content lives in
  // src/lib/private-coaching/race-lead-in.ts. Out of scope for structured
  // distance/steps -- see the task that added that layer.
  if (flag("race-lead-in")) plans.push(buildRaceLeadInSeed());
  // The post-marathon recovery program (Part H item 19), seeded the same
  // way and for the same reason: the coach edits one template rather than
  // six weeks of days per athlete. Its own distance fields are already
  // hand-filled by post-race.ts (never a parser -- see that file's header).
  if (flag("recovery-program")) {
    plans.push(buildRecoveryProgramSeed());
    worksheetEntries.push(...recoveryWorksheetEntries());
  }
  console.log(`Validated ${plans.length} program(s) from ${SEED_DIR}`);

  let seeded = 0;
  for (const plan of plans) {
    if (await seedPlan(admin, coachId, plan, replace)) seeded += 1;
  }

  if (worksheetEntries.length) {
    const outPath = writeLabelingWorksheet(worksheetEntries);
    console.log(`\n${worksheetEntries.length} day(s) need Brody's own hand labeling -- written to ${outPath}`);
  }

  console.log(`\nDone. ${seeded} of ${plans.length} program(s) written. Review at /coaching/programs`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
