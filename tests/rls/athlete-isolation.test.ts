import { afterAll, describe, expect, it } from "vitest";

import { asUser, closePool, withCommittedServiceRole } from "./db-client";
import { IDS } from "./fixtures";

afterAll(closePool);

describe("Athlete isolation (adversarial matrix items 11-17)", () => {
  it("11. Athlete A can read their own published workout", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c.query("select id from public.scheduled_workouts where id = $1", [IDS.scheduledWorkoutA]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("12. Athlete A cannot read Athlete B's workout", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c.query("select id from public.scheduled_workouts where id = $1", [IDS.scheduledWorkoutB]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("13. Athlete A cannot read Coach A's templates", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c.query("select id from public.workout_templates where id = $1", [IDS.templateA]).then((r) => r.rows),
    );
    // No athlete-facing policy exists on workout_templates at all.
    expect(rows).toHaveLength(0);
  });

  it("14. Athlete A cannot modify Coach A's templates", async () => {
    const result = await asUser(IDS.athleteA, (c) =>
      c.query("update public.workout_templates set name = 'Hijacked' where id = $1", [IDS.templateA]),
    );
    expect(result.rowCount).toBe(0);
  });

  it("15. Athlete A cannot modify Athlete B's completion", async () => {
    const result = await asUser(IDS.athleteA, (c) =>
      c.query("update public.completed_workouts set rpe = 1 where id = $1", [IDS.completedWorkoutB]),
    );
    expect(result.rowCount).toBe(0);
  });

  it("16. Athlete A cannot create a completion pointing at Athlete B's workout (HIGH-5 regression)", async () => {
    // completed_workouts_all_own's with-check now additionally requires
    // scheduled_workout_id to belong to auth.uid() -- pre-fix, this
    // insert (athlete_id = self, but scheduled_workout_id = someone
    // else's workout) would have succeeded and squatted the unique slot.
    await expect(
      asUser(IDS.athleteA, (c) =>
        c.query(
          `insert into public.completed_workouts (scheduled_workout_id, athlete_id, actual_distance_m)
           values ($1, $2, 1000)`,
          [IDS.scheduledWorkoutB, IDS.athleteA],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("18. Athlete A CAN read Coach A's profile (is_coached_by -- the reverse of profiles_select_private_coach; caught live on staging, not by this suite's original matrix, since it only ever tested isolation, never this positive grant)", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c.query("select id from public.profiles where id = $1", [IDS.coachA]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("19. Athlete A cannot read Coach B's profile (is_coached_by must not over-grant beyond the athlete's own active coach)", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c.query("select id from public.profiles where id = $1", [IDS.coachB]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("20. Athlete A can read Coach A's bio/philosophy columns specifically -- confirms there's no column-level restriction on profiles the way coach_athlete_messages has on body/coach_athlete_id, since is_coached_by grants the whole row via RLS, not per-column", async () => {
    await withCommittedServiceRole((c) =>
      c.query("update public.profiles set coach_bio = 'Test bio', coach_philosophy = 'Test philosophy' where id = $1", [
        IDS.coachA,
      ]),
    );
    try {
      const rows = await asUser(IDS.athleteA, (c) =>
        c
          .query("select coach_bio, coach_philosophy from public.profiles where id = $1", [IDS.coachA])
          .then((r) => r.rows),
      );
      expect(rows).toEqual([{ coach_bio: "Test bio", coach_philosophy: "Test philosophy" }]);
    } finally {
      await withCommittedServiceRole((c) =>
        c.query("update public.profiles set coach_bio = null, coach_philosophy = null where id = $1", [IDS.coachA]),
      );
    }
  });

  it("17. Athlete A cannot manipulate Athlete B's messages", async () => {
    const readAttempt = await asUser(IDS.athleteA, (c) =>
      c.query("select id from public.coach_athlete_messages where id = $1", [IDS.messageBB]).then((r) => r.rows),
    );
    expect(readAttempt).toHaveLength(0);

    const updateAttempt = await asUser(IDS.athleteA, (c) =>
      c.query("update public.coach_athlete_messages set read_at = now() where id = $1", [IDS.messageBB]),
    );
    expect(updateAttempt.rowCount).toBe(0);

    const deleteAttempt = await asUser(IDS.athleteA, (c) =>
      c.query("delete from public.coach_athlete_messages where id = $1", [IDS.messageBB]),
    );
    expect(deleteAttempt.rowCount).toBe(0);
  });
});
