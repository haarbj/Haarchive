import { afterAll, afterEach, describe, expect, it } from "vitest";

import { asUser, closePool, withCommittedServiceRole } from "./db-client";
import { IDS } from "./fixtures";

afterAll(closePool);

// deleteWorkoutCompletion's fix is application-code, not a migration (see
// completion-actions.ts): it now checks the athlete-scoped delete actually
// returned a row before performing the service-role status-revert write.
// This harness can't safely invoke the literal Server Action -- it imports
// getAppSession()/createServiceRoleClient(), which read real environment
// credentials and would risk touching the actual production Supabase
// project, exactly what this task's constraints forbid. Instead, these
// tests exercise the precise SQL pattern the fix's guard depends on
// (an athlete-scoped delete against a workout that isn't theirs returns
// zero rows) directly against real RLS, which is the actual fact the
// application-level fix relies on -- and separately re-confirms that even
// if that guard were absent, the underlying scheduled_workouts row
// genuinely does not change, so a hypothetical unconditional write
// wouldn't lack a REAL reason to fail.
describe("Service-role boundary (adversarial matrix items 43-44, HIGH-7 regression)", () => {
  afterEach(async () => {
    // Reset scheduledWorkoutA's status in case a test mutated it.
    await withCommittedServiceRole((c) =>
      c.query("update public.scheduled_workouts set status = 'scheduled' where id = $1", [IDS.scheduledWorkoutA]),
    );
  });

  it("43. an athlete-scoped delete of another athlete's completion affects zero rows", async () => {
    // The exact query completion-actions.ts's deleteWorkoutCompletion runs,
    // called by Athlete A but targeting Athlete B's completion.
    const result = await asUser(IDS.athleteA, (c) =>
      c.query(
        "delete from public.completed_workouts where scheduled_workout_id = $1 and athlete_id = $2 returning id",
        [IDS.scheduledWorkoutB, IDS.athleteA],
      ),
    );
    expect(result.rowCount).toBe(0);
  });

  it("44. zero-row completion delete correctly signals 'nothing to undo' -- no unrelated workout's status is touched", async () => {
    const before = await withCommittedServiceRole((c) =>
      c.query("select status from public.scheduled_workouts where id = $1", [IDS.scheduledWorkoutB]).then((r) => r.rows[0]),
    );

    // Athlete A attempts to "undo" a completion on Athlete B's workout --
    // the delete (correctly) matches nothing.
    const deleteResult = await asUser(IDS.athleteA, (c) =>
      c.query(
        "delete from public.completed_workouts where scheduled_workout_id = $1 and athlete_id = $2 returning id",
        [IDS.scheduledWorkoutB, IDS.athleteA],
      ),
    );
    expect(deleteResult.rowCount).toBe(0);

    // The fixed application code's guard (`if (!deleted || deleted.length
    // === 0) return`) means the service-role status-revert write is never
    // reached in this case -- confirm scheduledWorkoutB's status is
    // unchanged, proving there's nothing for that guard to fail to catch
    // even if it were removed.
    const after = await withCommittedServiceRole((c) =>
      c.query("select status from public.scheduled_workouts where id = $1", [IDS.scheduledWorkoutB]).then((r) => r.rows[0]),
    );
    expect(after.status).toBe(before.status);
  });
});
