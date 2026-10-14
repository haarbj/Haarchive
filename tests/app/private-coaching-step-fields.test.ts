import { afterEach, describe, expect, it, vi } from "vitest";

import { createScriptedSupabaseClient, type ScriptStep } from "./supabase-test-utils";

// Regression coverage for D1/D2 (coaching-platform-audit/01 §5.1, §5.2):
// saveScheduledWorkout, saveTemplate, and saveProgramDay all rebuild a
// workout's steps via delete-then-reinsert, and all three previously
// omitted target_pace_percent_basis/min/max and/or repetitions_max/
// rest_max_s from the INSERT payload -- silently dropping a step's
// percent-of-pace target and its rep/rest range on every save, including
// a re-save of an already-published, program-assigned workout whose steps
// were originally written correctly by assign_program_generation. This is
// the single highest-leverage test named in coaching-platform-audit/07
// §2's "prescription round-trip" invariant: it would have caught D1/D2
// before they shipped, for the step insert specifically (not yet the full
// IntensityTarget contract the audit's target architecture specifies --
// that's a larger, separate change).
//
// Same scripted-mock shape as conversion-actions.test.ts / knowledge-
// check-actions.test.ts: createClient()/createServiceRoleClient() are
// next/headers-backed and need a mock to run under Vitest's node
// environment; getAppSession() and createNotification() are mocked
// directly (not driven through supabase auth) since saveScheduledWorkout
// calls them as plain functions, not through the supabase client.

vi.mock("@/lib/db/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db/service-role", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAppSession: vi.fn() }));
vi.mock("@/lib/notifications/create-notification", () => ({ createNotification: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createClient } from "@/lib/db/server";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { getAppSession } from "@/lib/auth/session";
import {
  saveScheduledWorkout,
  duplicateScheduledWorkout,
  type ScheduledWorkoutInput,
} from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/actions";
import { saveTemplate, type TemplateInput } from "@/app/(app)/(protected)/coaching/templates/actions";
import type { StepInput } from "@/lib/private-coaching/steps";

afterEach(() => {
  vi.clearAllMocks();
});

// A step that exercises every field D1/D2 found dropped: a percent-of-
// pace target (90-92% of 5K pace) and a rep/rest range (6-7 reps, 60-75s
// rest) together, the exact shape a real Canyon-style interval session
// uses -- see docs/coaching-platform-audit/01 §5.1's own citation.
const INTERVAL_STEP: StepInput = {
  stepType: "interval",
  durationS: null,
  durationMaxS: null,
  distanceM: 804.67,
  distanceMaxM: null,
  targetType: "pace",
  targetMin: null,
  targetMax: null,
  targetUnit: null,
  targetPaceReference: null,
  targetPacePercentBasis: "5k",
  targetPacePercentMin: 90,
  targetPacePercentMax: 92,
  repetitions: 6,
  repetitionsMax: 7,
  restS: 60,
  restMaxS: 75,
  instructions: null,
};

const BASE_WORKOUT_INPUT: ScheduledWorkoutInput = {
  athleteId: "athlete-1",
  templateId: null,
  scheduledDate: "2026-10-06",
  workoutType: null,
  dayLabel: "Intervals",
  sessionSlot: null,
  extras: [],
  notesFromCoach: null,
  plannedDistanceM: null,
  plannedDistanceMaxM: null,
  plannedDurationS: null,
  plannedDurationMaxS: null,
  plannedPaceSPerMi: null,
  plannedPaceMaxSPerMi: null,
  plannedPaceReference: null,
  plannedPacePercentBasis: null,
  plannedPacePercentMin: null,
  plannedPacePercentMax: null,
  plannedVolumePercent: null,
  plannedHrBpm: null,
  plannedHrMaxBpm: null,
  plannedRpe: null,
  plannedRpeMax: null,
  steps: [INTERVAL_STEP],
  publish: true,
};

describe("saveScheduledWorkout -- step round-trip (D1/D2)", () => {
  it("writes target_pace_percent_basis/min/max and repetitions_max/rest_max_s on a new workout's steps", async () => {
    vi.mocked(getAppSession).mockResolvedValue({
      userId: "coach-1",
      isPrivateCoach: true,
    } as never);

    const script: ScriptStep[] = [
      { table: "coach_athletes", result: { data: { id: "rel-1" }, error: null } },
      { table: "athlete_metrics", result: { data: [], error: null } },
      { table: "scheduled_workouts", result: { data: { id: "workout-1" }, error: null } },
      { table: "scheduled_workout_steps", result: { data: null, error: null } },
    ];
    const { client, callLog } = createScriptedSupabaseClient(script, "coach-1");
    vi.mocked(createClient).mockResolvedValue(client as never);

    const { client: serviceClient } = createScriptedSupabaseClient(
      [{ table: "audit_log", result: { data: null, error: null } }],
      "coach-1",
    );
    vi.mocked(createServiceRoleClient).mockReturnValue(serviceClient as never);

    const result = await saveScheduledWorkout(BASE_WORKOUT_INPUT);

    expect(result.error).toBeUndefined();
    const stepsInsert = callLog.find((c) => c.table === "scheduled_workout_steps")?.calls.find((c) => c.method === "insert");
    expect(stepsInsert).toBeDefined();
    const insertedRows = stepsInsert!.args[0] as Record<string, unknown>[];
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({
      target_pace_percent_basis: "5k",
      target_pace_percent_min: 90,
      target_pace_percent_max: 92,
      repetitions: 6,
      repetitions_max: 7,
      rest_s: 60,
      rest_max_s: 75,
    });
  });

  it("writes the day-level pace_percent_basis/min/max target on a new workout", async () => {
    // The day-level counterpart of the step-level test above -- previously
    // absent from ScheduledWorkoutInput entirely, not just dropped on
    // save (coaching-platform-audit/01 §5.1's "still open" gap, now
    // closed). Also asserts the defense-in-depth exclusivity backstop: a
    // fixed pace passed alongside a percent basis is nulled out in the
    // actual insert, matching scheduled_workouts_pace_percent_exclusive.
    vi.mocked(getAppSession).mockResolvedValue({
      userId: "coach-1",
      isPrivateCoach: true,
    } as never);

    const script: ScriptStep[] = [
      { table: "coach_athletes", result: { data: { id: "rel-1" }, error: null } },
      { table: "athlete_metrics", result: { data: [], error: null } },
      { table: "scheduled_workouts", result: { data: { id: "workout-1" }, error: null } },
      { table: "scheduled_workout_steps", result: { data: null, error: null } },
    ];
    const { client, callLog } = createScriptedSupabaseClient(script, "coach-1");
    vi.mocked(createClient).mockResolvedValue(client as never);

    const { client: serviceClient } = createScriptedSupabaseClient(
      [{ table: "audit_log", result: { data: null, error: null } }],
      "coach-1",
    );
    vi.mocked(createServiceRoleClient).mockReturnValue(serviceClient as never);

    const result = await saveScheduledWorkout({
      ...BASE_WORKOUT_INPUT,
      steps: [],
      plannedPacePercentBasis: "5k",
      plannedPacePercentMin: 90,
      plannedPacePercentMax: 92,
      // Deliberately also set, to prove the exclusivity backstop wins --
      // a real caller's UI prevents this combination, but the server
      // action must not trust that.
      plannedPaceSPerMi: 420,
      plannedPaceMaxSPerMi: 440,
    });

    expect(result.error).toBeUndefined();
    const workoutInsert = callLog.find((c) => c.table === "scheduled_workouts")?.calls.find((c) => c.method === "insert");
    expect(workoutInsert!.args[0]).toMatchObject({
      pace_percent_basis: "5k",
      pace_percent_min: 90,
      pace_percent_max: 92,
      planned_pace_s_per_mi: null,
      planned_pace_max_s_per_mi: null,
      pace_reference: null,
    });
  });

  it("preserves an existing workout's percent-of-pace and rep/rest-range step fields across a re-save", async () => {
    // The exact scenario D1's live evidence describes: a coach opens an
    // already-published, program-assigned workout (steps correctly
    // written once by assign_program_generation) and saves it again --
    // the delete-then-reinsert must not drop what was already there.
    vi.mocked(getAppSession).mockResolvedValue({
      userId: "coach-1",
      isPrivateCoach: true,
    } as never);

    const script: ScriptStep[] = [
      { table: "coach_athletes", result: { data: { id: "rel-1" }, error: null } },
      { table: "athlete_metrics", result: { data: [], error: null } },
      { table: "scheduled_workouts", result: { data: { published_at: null }, error: null } }, // wasPublished read
      { table: "scheduled_workouts", result: { data: null, error: null } },
      { table: "scheduled_workout_steps", result: { data: null, error: null } }, // delete
      { table: "scheduled_workout_extras", result: { data: null, error: null } }, // delete
      { table: "scheduled_workout_steps", result: { data: null, error: null } }, // reinsert
    ];
    const { client, callLog } = createScriptedSupabaseClient(script, "coach-1");
    vi.mocked(createClient).mockResolvedValue(client as never);

    const { client: serviceClient } = createScriptedSupabaseClient(
      [{ table: "audit_log", result: { data: null, error: null } }],
      "coach-1",
    );
    vi.mocked(createServiceRoleClient).mockReturnValue(serviceClient as never);

    const result = await saveScheduledWorkout({ ...BASE_WORKOUT_INPUT, id: "workout-1" });

    expect(result.error).toBeUndefined();
    const stepInserts = callLog.filter((c) => c.table === "scheduled_workout_steps");
    const reinsert = stepInserts[stepInserts.length - 1].calls.find((c) => c.method === "insert");
    const insertedRows = reinsert!.args[0] as Record<string, unknown>[];
    expect(insertedRows[0]).toMatchObject({
      target_pace_percent_basis: "5k",
      target_pace_percent_min: 90,
      target_pace_percent_max: 92,
      repetitions_max: 7,
      rest_max_s: 75,
    });
  });
});

describe("duplicateScheduledWorkout -- carries pace-percent and rep/rest-range fields forward", () => {
  it("copies day-level pace_percent_basis/min/max and step-level target_pace_percent_*/repetitions_max/rest_max_s to the new row", async () => {
    // A second, independently-found instance of the same D1/D2 defect
    // class, in a sibling function that wasn't touched by the fix above:
    // duplicateScheduledWorkout's own select()/insert() pairs (both
    // day-level and step-level) previously omitted these columns just
    // like saveScheduledWorkout's did, so duplicating a percent-of-pace
    // workout would silently produce a copy that lost its target.
    vi.mocked(getAppSession).mockResolvedValue({
      userId: "coach-1",
      isPrivateCoach: true,
    } as never);

    const sourceWorkoutRow = {
      title: null,
      workout_type: null,
      day_label: "Intervals",
      session_slot: null,
      notes_from_coach: null,
      planned_distance_m: null,
      planned_distance_max_m: null,
      planned_duration_s: null,
      planned_duration_max_s: null,
      planned_pace_s_per_mi: null,
      planned_pace_max_s_per_mi: null,
      pace_reference: null,
      pace_percent_basis: "5k",
      pace_percent_min: 90,
      pace_percent_max: 92,
      planned_volume_percent: null,
      planned_hr_bpm: null,
      planned_hr_max_bpm: null,
      planned_rpe: null,
      planned_rpe_max: null,
      scheduled_date: "2026-10-06",
    };
    const sourceStepRow = {
      step_type: "interval",
      duration_s: null,
      duration_max_s: null,
      distance_m: 804.67,
      distance_max_m: null,
      target_type: "pace",
      target_min: null,
      target_max: null,
      target_unit: null,
      target_pace_reference: null,
      target_pace_percent_basis: "5k",
      target_pace_percent_min: 90,
      target_pace_percent_max: 92,
      repetitions: 6,
      repetitions_max: 7,
      rest_s: 60,
      rest_max_s: 75,
      instructions: null,
    };

    const script: ScriptStep[] = [
      { table: "scheduled_workouts", result: { data: sourceWorkoutRow, error: null } }, // source fetch
      { table: "scheduled_workout_steps", result: { data: [sourceStepRow], error: null } }, // source steps
      { table: "scheduled_workout_extras", result: { data: [], error: null } }, // source extras
      { table: "scheduled_workouts", result: { data: { id: "workout-2" }, error: null } }, // new row insert
      { table: "scheduled_workout_steps", result: { data: null, error: null } }, // new steps insert
    ];
    const { client, callLog } = createScriptedSupabaseClient(script, "coach-1");
    vi.mocked(createClient).mockResolvedValue(client as never);

    const { client: serviceClient } = createScriptedSupabaseClient(
      [{ table: "audit_log", result: { data: null, error: null } }],
      "coach-1",
    );
    vi.mocked(createServiceRoleClient).mockReturnValue(serviceClient as never);

    const result = await duplicateScheduledWorkout("workout-1", "athlete-1");

    expect(result.error).toBeUndefined();
    const workoutInserts = callLog.filter((c) => c.table === "scheduled_workouts").map((c) => c.calls.find((call) => call.method === "insert")).filter(Boolean);
    expect(workoutInserts[0]!.args[0]).toMatchObject({
      pace_percent_basis: "5k",
      pace_percent_min: 90,
      pace_percent_max: 92,
    });
    const stepsInsert = callLog.filter((c) => c.table === "scheduled_workout_steps")[1].calls.find((c) => c.method === "insert");
    const insertedRows = stepsInsert!.args[0] as Record<string, unknown>[];
    expect(insertedRows[0]).toMatchObject({
      target_pace_percent_basis: "5k",
      target_pace_percent_min: 90,
      target_pace_percent_max: 92,
      repetitions_max: 7,
      rest_max_s: 75,
    });
  });
});

describe("saveTemplate -- step round-trip (D2)", () => {
  it("writes repetitions_max/rest_max_s on a new template's steps", async () => {
    vi.mocked(getAppSession).mockResolvedValue({
      userId: "coach-1",
      isPrivateCoach: true,
    } as never);

    const script: ScriptStep[] = [
      { table: "workout_templates", result: { data: { id: "template-1" }, error: null } },
      { table: "workout_template_steps", result: { data: null, error: null } },
    ];
    const { client, callLog } = createScriptedSupabaseClient(script, "coach-1");
    vi.mocked(createClient).mockResolvedValue(client as never);

    const input: TemplateInput = {
      name: "6x800m intervals",
      workoutType: null,
      description: null,
      dayLabel: null,
      sessionSlot: null,
      extras: [],
      plannedDistanceM: null,
      plannedDistanceMaxM: null,
      plannedDurationS: null,
      plannedDurationMaxS: null,
      plannedPaceSPerMi: null,
      plannedPaceMaxSPerMi: null,
      plannedPaceReference: null,
      plannedVolumePercent: null,
      plannedHrBpm: null,
      plannedHrMaxBpm: null,
      plannedRpe: null,
      plannedRpeMax: null,
      steps: [INTERVAL_STEP],
    };

    const result = await saveTemplate(input);

    expect(result.error).toBeUndefined();
    const stepsInsert = callLog.find((c) => c.table === "workout_template_steps")?.calls.find((c) => c.method === "insert");
    const insertedRows = stepsInsert!.args[0] as Record<string, unknown>[];
    expect(insertedRows[0]).toMatchObject({
      repetitions: 6,
      repetitions_max: 7,
      rest_s: 60,
      rest_max_s: 75,
    });
  });
});
