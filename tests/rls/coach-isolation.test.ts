import { afterAll, describe, expect, it } from "vitest";

import { asUser, closePool } from "./db-client";
import { IDS } from "./fixtures";

afterAll(closePool);

// Real Postgres, real RLS -- asUser() sets role=authenticated and
// request.jwt.claim.sub, exactly what PostgREST does per request; every
// query below is the actual SQL the app's own Supabase client would send.
describe("Coach A isolation (adversarial matrix items 1-10)", () => {
  it("1. Coach A can read Athlete A's data", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.profiles where id = $1", [IDS.athleteA]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("2. Coach A cannot read Athlete B's data", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.profiles where id = $1", [IDS.athleteB]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("3. Coach A cannot read Athlete C's data", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.profiles where id = $1", [IDS.athleteC]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("4. Coach A can create a scheduled workout for Athlete A", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c
        .query(
          `insert into public.scheduled_workouts (athlete_id, coach_id, scheduled_date, title)
           values ($1, $2, current_date, 'New Workout') returning id`,
          [IDS.athleteA, IDS.coachA],
        )
        .then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("5. Coach A cannot create a scheduled workout for Athlete B (BLOCKER 1 regression)", async () => {
    await expect(
      asUser(IDS.coachA, (c) =>
        c.query(
          `insert into public.scheduled_workouts (athlete_id, coach_id, scheduled_date, title)
           values ($1, $2, current_date, 'Hostile Workout')`,
          [IDS.athleteB, IDS.coachA],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("6. Coach A cannot create a scheduled workout for Athlete C (BLOCKER 1 regression)", async () => {
    await expect(
      asUser(IDS.coachA, (c) =>
        c.query(
          `insert into public.scheduled_workouts (athlete_id, coach_id, scheduled_date, title)
           values ($1, $2, current_date, 'Hostile Workout')`,
          [IDS.athleteC, IDS.coachA],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("7. Coach A cannot update Athlete B's scheduled workout", async () => {
    const result = await asUser(IDS.coachA, (c) =>
      c.query("update public.scheduled_workouts set title = 'Hijacked' where id = $1", [IDS.scheduledWorkoutB]),
    );
    expect(result.rowCount).toBe(0);
  });

  it("8. Coach A cannot delete Athlete B's scheduled workout", async () => {
    const result = await asUser(IDS.coachA, (c) =>
      c.query("delete from public.scheduled_workouts where id = $1", [IDS.scheduledWorkoutB]),
    );
    expect(result.rowCount).toBe(0);
  });

  it("9. Coach A cannot manipulate Athlete B's workout steps", async () => {
    // scheduled_workout_steps_all_coach's subquery requires w.coach_id =
    // auth.uid() -- Coach A isn't scheduledWorkoutB's coach, so the
    // with-check's exists() is false and the insert is rejected outright.
    await expect(
      asUser(IDS.coachA, (c) =>
        c.query(
          `insert into public.scheduled_workout_steps (scheduled_workout_id, step_order, step_type)
           values ($1, 99, 'main')`,
          [IDS.scheduledWorkoutB],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("10. Coach A cannot comment on Athlete B's workout", async () => {
    await expect(
      asUser(IDS.coachA, (c) =>
        c.query(
          `insert into public.workout_comments (scheduled_workout_id, author_id, body)
           values ($1, $2, 'Butting in')`,
          [IDS.scheduledWorkoutB, IDS.coachA],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });
});
