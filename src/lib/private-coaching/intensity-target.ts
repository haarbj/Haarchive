import type { PaceReferenceKey } from "./pace-reference";
import type { StepInput, WorkoutTargetType } from "./steps";

// The canonical prescription contract specified in
// coaching-platform-audit/05-target-architecture.md §1.1: one discriminated
// union representing every way this product can express a workout's
// volume or intensity, instead of the six independently-duplicated field
// groups the audit found spread across the step tables and their writers.
// This is the first concrete piece of that contract -- covering step-level
// prescriptions (scheduled_workout_steps / workout_template_steps /
// program_day_steps' target_* columns), which is where the audit's D1/D2
// data-loss defects actually lived (this session fixed five independent
// instances of the same "a writer forgot one field" bug across five
// functions before building this). Day-level prescriptions
// (scheduled_workouts/workout_templates/program_days' planned_*/pace_*
// columns) and the read-side (rendering an IntensityTarget[] back into a
// display string) are the natural next increments -- not attempted here,
// so as not to blur this change's own blast radius.
//
// The fix is deliberately NOT a new storage format (per §1.1's own
// instruction: "typed JSON" is a premature solution). The DB stays exactly
// the relational shape it already is; what's new is that exactly one
// function serializes an IntensityTarget[] into that shape and exactly one
// function deserializes it back, so every writer/reader goes through the
// same code instead of hand-rolling the same six-way mode switch again.
export type IntensityTarget =
  | { mode: "distance"; minM: number; maxM: number | null }
  | { mode: "duration"; minS: number; maxS: number | null }
  | { mode: "volumePercent"; percent: number }
  | { mode: "pace"; minSPerMi: number; maxSPerMi: number | null; unit: string | null }
  | { mode: "paceReference"; reference: PaceReferenceKey }
  | { mode: "pacePercent"; basis: PaceReferenceKey; minPercent: number; maxPercent: number | null }
  | { mode: "heartRate"; minBpm: number; maxBpm: number | null }
  | { mode: "rpe"; min: number; max: number | null }
  | { mode: "open" };

// The subset of StepInput's fields an IntensityTarget[] actually carries --
// everything about a step EXCEPT stepType, repetitions/repetitionsMax,
// restS/restMaxS, and instructions, which are structural/scheduling
// concerns the contract doesn't own (see §1.1's own step-tree note: those
// belong to the step's position in the tree, not to what it prescribes).
export type StepPrescriptionFields = Pick<
  StepInput,
  | "distanceM"
  | "distanceMaxM"
  | "durationS"
  | "durationMaxS"
  | "targetType"
  | "targetMin"
  | "targetMax"
  | "targetUnit"
  | "targetPaceReference"
  | "targetPacePercentBasis"
  | "targetPacePercentMin"
  | "targetPacePercentMax"
>;

// A step's real prescription is up to two simultaneous signals -- how much
// (distance/duration, or neither if the step is described purely by its
// target) and how hard (pace/paceReference/pacePercent/heartRate/rpe, or
// none for an open step) -- never both a fixed pace AND a pace reference
// AND a pace percent at once (the DB's own three-way exclusivity
// constraints, scheduled_workout_steps_pace_percent_exclusive et al.,
// already enforce this; this function reads whichever ONE of those three
// is actually set, in the same priority order the mutual-exclusivity rule
// implies: percent wins over reference wins over a literal pace, matching
// every hand-written version of this check this session found and fixed).
// volumePercent never appears here -- it's a day-level-only mode (see the
// module comment).
export function stepInputToIntensityTargets(step: StepPrescriptionFields): IntensityTarget[] {
  const targets: IntensityTarget[] = [];

  if (step.distanceM != null) {
    targets.push({ mode: "distance", minM: step.distanceM, maxM: step.distanceMaxM });
  } else if (step.durationS != null) {
    targets.push({ mode: "duration", minS: step.durationS, maxS: step.durationMaxS });
  }

  if (step.targetPacePercentBasis != null && step.targetPacePercentMin != null) {
    targets.push({
      mode: "pacePercent",
      basis: step.targetPacePercentBasis,
      minPercent: step.targetPacePercentMin,
      maxPercent: step.targetPacePercentMax ?? null,
    });
  } else if (step.targetPaceReference != null) {
    targets.push({ mode: "paceReference", reference: step.targetPaceReference });
  } else if (step.targetType === "pace" && step.targetMin != null) {
    targets.push({ mode: "pace", minSPerMi: step.targetMin, maxSPerMi: step.targetMax, unit: step.targetUnit });
  } else if (step.targetType === "heart_rate" && step.targetMin != null) {
    targets.push({ mode: "heartRate", minBpm: step.targetMin, maxBpm: step.targetMax });
  } else if (step.targetType === "rpe" && step.targetMin != null) {
    targets.push({ mode: "rpe", min: step.targetMin, max: step.targetMax });
  }

  if (targets.length === 0) targets.push({ mode: "open" });
  return targets;
}

// The exact inverse: every StepPrescriptionFields column always appears in
// the return value (explicit null, never omitted), which is the whole
// point -- a caller that spreads this into an insert/update payload cannot
// reproduce D1/D2's "forgot to list a field" bug, because there is no
// field left to forget. targetType always resolves to a real enum value
// (never left as whatever a stale object happened to have), matching
// scheduled_workout_steps_pace_percent_type_valid's own requirement that a
// percent-basis row have target_type = 'pace'.
export function intensityTargetsToStepFields(targets: IntensityTarget[]): StepPrescriptionFields {
  const fields: StepPrescriptionFields = {
    distanceM: null,
    distanceMaxM: null,
    durationS: null,
    durationMaxS: null,
    targetType: "open",
    targetMin: null,
    targetMax: null,
    targetUnit: null,
    targetPaceReference: null,
    targetPacePercentBasis: null,
    targetPacePercentMin: null,
    targetPacePercentMax: null,
  };

  for (const target of targets) {
    switch (target.mode) {
      case "distance":
        fields.distanceM = target.minM;
        fields.distanceMaxM = target.maxM;
        break;
      case "duration":
        fields.durationS = target.minS;
        fields.durationMaxS = target.maxS;
        break;
      case "pace":
        fields.targetType = "pace";
        fields.targetMin = target.minSPerMi;
        fields.targetMax = target.maxSPerMi;
        fields.targetUnit = target.unit;
        break;
      case "paceReference":
        fields.targetType = "pace";
        fields.targetPaceReference = target.reference;
        break;
      case "pacePercent":
        fields.targetType = "pace";
        fields.targetPacePercentBasis = target.basis;
        fields.targetPacePercentMin = target.minPercent;
        fields.targetPacePercentMax = target.maxPercent;
        break;
      case "heartRate":
        fields.targetType = "heart_rate";
        fields.targetMin = target.minBpm;
        fields.targetMax = target.maxBpm;
        break;
      case "rpe":
        fields.targetType = "rpe";
        fields.targetMin = target.min;
        fields.targetMax = target.max;
        break;
      case "volumePercent":
        // Day-level-only mode (see module comment) -- a step-level caller
        // passing this is a programming error, not a value to silently
        // drop; surfaced as a thrown error rather than swallowed, since
        // swallowing it would be exactly the kind of silent data loss
        // this contract exists to make impossible.
        throw new Error("volumePercent is a day-level IntensityTarget mode; it has no step-level column to serialize into.");
      case "open":
        break;
      default: {
        const exhaustive: never = target;
        throw new Error(`Unhandled IntensityTarget mode: ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  return fields;
}

// The snake_case DB row shape for scheduled_workout_steps/program_day_steps
// (the two step tables that carry the full percent-of-pace trio -- see
// StepRowFieldsForTemplate below for workout_template_steps' narrower
// shape, which has no target_pace_percent_* columns at all). Explicit
// return type below, not inferred, so that omitting a key here is a
// compile error rather than a field this insert silently never sends --
// the same "structurally cannot forget a column" guarantee
// intensityTargetsToStepFields already gives the camelCase shape, carried
// through the mechanical rename a `.from(...).insert()` call actually needs.
export type StepPrescriptionRow = {
  duration_s: number | null;
  duration_max_s: number | null;
  distance_m: number | null;
  distance_max_m: number | null;
  target_type: WorkoutTargetType;
  target_min: number | null;
  target_max: number | null;
  target_unit: string | null;
  target_pace_reference: PaceReferenceKey | null;
  target_pace_percent_basis: PaceReferenceKey | null;
  target_pace_percent_min: number | null;
  target_pace_percent_max: number | null;
};

export function intensityTargetsToStepRow(targets: IntensityTarget[]): StepPrescriptionRow {
  const f = intensityTargetsToStepFields(targets);
  return {
    duration_s: f.durationS,
    duration_max_s: f.durationMaxS,
    distance_m: f.distanceM,
    distance_max_m: f.distanceMaxM,
    target_type: f.targetType,
    target_min: f.targetMin,
    target_max: f.targetMax,
    target_unit: f.targetUnit,
    target_pace_reference: f.targetPaceReference,
    target_pace_percent_basis: f.targetPacePercentBasis ?? null,
    target_pace_percent_min: f.targetPacePercentMin ?? null,
    target_pace_percent_max: f.targetPacePercentMax ?? null,
  };
}

// workout_template_steps' narrower row shape -- no target_pace_percent_*
// columns exist on that table at all (see the module comment; no current
// UI path ever produces a pacePercent target for a template step either,
// since TemplateForm's StepsEditor doesn't pass allowPacePercent). Spreading
// StepPrescriptionRow directly into a workout_template_steps insert would
// send three columns that table doesn't have and fail outright -- this is
// the explicit, compile-checked narrowing instead, so a future template-
// step writer can't reach for the wrong one of the two by accident.
export type TemplateStepPrescriptionRow = Omit<
  StepPrescriptionRow,
  "target_pace_percent_basis" | "target_pace_percent_min" | "target_pace_percent_max"
>;

export function intensityTargetsToTemplateStepRow(targets: IntensityTarget[]): TemplateStepPrescriptionRow {
  const row = intensityTargetsToStepRow(targets);
  return {
    duration_s: row.duration_s,
    duration_max_s: row.duration_max_s,
    distance_m: row.distance_m,
    distance_max_m: row.distance_max_m,
    target_type: row.target_type,
    target_min: row.target_min,
    target_max: row.target_max,
    target_unit: row.target_unit,
    target_pace_reference: row.target_pace_reference,
  };
}

export type { WorkoutTargetType };
