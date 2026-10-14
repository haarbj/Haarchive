import { afterAll, describe, expect, it } from "vitest";

import { asUser, closePool, withCommittedServiceRole } from "./db-client";
import { IDS } from "./fixtures";

afterAll(closePool);

// One test per vulnerability found in the pre-apply security audit,
// named and grouped explicitly so a future reader can find "the test for
// finding N" without cross-referencing coach-isolation.test.ts/
// messaging.test.ts/etc. Several of these necessarily re-exercise the same
// underlying SQL as a test elsewhere in this suite -- that's intentional
// here, not duplication to prune: this file's job is to be readable
// end-to-end against the audit report on its own, not to be the only copy
// of each assertion.
describe("Regression suite -- pre-apply security audit findings", () => {
  it("1. BLOCKER: foreign athleteId supplied to scheduled_workouts insert is rejected", async () => {
    await expect(
      asUser(IDS.coachA, (c) =>
        c.query(
          `insert into public.scheduled_workouts (athlete_id, coach_id, scheduled_date, title)
           values ($1, $2, current_date, 'x')`,
          [IDS.athleteC, IDS.coachA],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("2. BLOCKER: recipient cannot modify message body", async () => {
    await expect(
      asUser(IDS.athleteA, (c) =>
        c.query("update public.coach_athlete_messages set body = 'hacked' where id = $1", [IDS.messageAA]),
      ),
    ).rejects.toThrow(/permission denied for table coach_athlete_messages/i);
  });

  it("3. BLOCKER: recipient cannot modify coach_athlete_id (cross-thread injection)", async () => {
    await expect(
      asUser(IDS.athleteA, (c) =>
        c.query("update public.coach_athlete_messages set coach_athlete_id = $2 where id = $1", [
          IDS.messageAA,
          IDS.coachAthleteRelBB,
        ]),
      ),
    ).rejects.toThrow(/permission denied for table coach_athlete_messages/i);
  });

  it("4. HIGH: messaging is denied once the relationship's status becomes 'ended'", async () => {
    await withCommittedServiceRole((c) =>
      c.query("update public.coach_athletes set status = 'ended' where id = $1", [IDS.coachAthleteRelAA]),
    );
    try {
      const rows = await asUser(IDS.coachA, (c) =>
        c.query("select id from public.coach_athlete_messages where coach_athlete_id = $1", [IDS.coachAthleteRelAA]).then((r) => r.rows),
      );
      expect(rows).toHaveLength(0);
    } finally {
      await withCommittedServiceRole((c) =>
        c.query("update public.coach_athletes set status = 'active', ended_at = null where id = $1", [
          IDS.coachAthleteRelAA,
        ]),
      );
    }
  });

  it("5. HIGH: a completion cannot reference another athlete's scheduled workout", async () => {
    await expect(
      asUser(IDS.athleteA, (c) =>
        c.query(
          `insert into public.completed_workouts (scheduled_workout_id, athlete_id, actual_distance_m)
           values ($1, $2, 500)`,
          [IDS.scheduledWorkoutB, IDS.athleteA],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("6. HIGH: a coach cannot modify their athlete's own completion (completed_workouts_update_coach removed)", async () => {
    const result = await asUser(IDS.coachA, (c) =>
      c.query("update public.completed_workouts set rpe = 1, pain_reported = false where id = $1", [
        IDS.completedWorkoutA,
      ]),
    );
    // Not a permission-denied error -- completed_workouts_select_coach
    // still grants read, so the row is visible and the UPDATE statement
    // itself is allowed to run; RLS's using-clause on UPDATE (which no
    // longer has a coach policy at all, only completed_workouts_all_own
    // for the athlete) simply matches zero rows for this caller.
    expect(result.rowCount).toBe(0);
  });

  it("7. HIGH: deleteWorkoutCompletion's underlying query returns zero rows for an unrelated workout (see service-role-boundary.test.ts for the full scenario)", async () => {
    const result = await asUser(IDS.athleteA, (c) =>
      c.query(
        "delete from public.completed_workouts where scheduled_workout_id = $1 and athlete_id = $2 returning id",
        [IDS.scheduledWorkoutB, IDS.athleteA],
      ),
    );
    expect(result.rowCount).toBe(0);
  });

  it("8. HIGH: saveScheduledWorkout's real authorization boundary (RLS) rejects a foreign athleteId regardless of the application-layer check", async () => {
    // saveScheduledWorkout's own added pre-check (a friendly "you don't
    // coach this athlete" error) is application code this harness
    // deliberately does not invoke directly -- see this file's own header
    // comment on why (production-credential risk). What's tested here is
    // the actual authoritative boundary the fix's comment says RLS now
    // is: even with no application-layer check at all, the database
    // itself refuses the write.
    await expect(
      asUser(IDS.coachA, (c) =>
        c.query(
          `insert into public.scheduled_workouts (athlete_id, coach_id, scheduled_date, title, published_at)
           values ($1, $2, current_date, 'Unauthorized', now())`,
          [IDS.athleteB, IDS.coachA],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });
});
