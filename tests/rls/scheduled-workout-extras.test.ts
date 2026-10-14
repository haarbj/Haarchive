import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asAnon, asUser, closePool, withCommittedServiceRole } from "./db-client";
import { IDS } from "./fixtures";

// scheduled_workout_extras (20260826090000) mirrors scheduled_workout_steps'
// exact RLS shape (ownership via the parent scheduled_workouts row) --
// exercised directly here rather than assumed correct just because it
// copies an already-tested policy shape.
const extraOnA = { id: "00000000-0000-4000-8000-0000000000b1", workoutId: IDS.scheduledWorkoutA };
const extraOnDraftA = { id: "00000000-0000-4000-8000-0000000000b2", workoutId: IDS.scheduledWorkoutADraft };

beforeAll(async () => {
  await withCommittedServiceRole(async (c) => {
    await c.query(
      `insert into public.scheduled_workout_extras (id, scheduled_workout_id, extra_order, kind, overview, count, distance_m, items)
       values ($1, $2, 0, 'Drills', 'Do each drill 50m', 2, 50, array['A skips x2','B skips'])`,
      [extraOnA.id, extraOnA.workoutId],
    );
    await c.query(
      `insert into public.scheduled_workout_extras (id, scheduled_workout_id, extra_order, kind)
       values ($1, $2, 0, 'Strides')`,
      [extraOnDraftA.id, extraOnDraftA.workoutId],
    );
  });
});

afterAll(async () => {
  await withCommittedServiceRole((c) =>
    c.query("delete from public.scheduled_workout_extras where id = any($1)", [[extraOnA.id, extraOnDraftA.id]]),
  );
  await closePool();
});

describe("scheduled_workout_extras RLS", () => {
  it("Coach A (the authoring coach) can read an extra on their own athlete's workout", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.scheduled_workout_extras where id = $1", [extraOnA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("Athlete A can read an extra on their own PUBLISHED workout", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c.query("select id from public.scheduled_workout_extras where id = $1", [extraOnA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("Athlete A cannot read an extra on a DRAFT (unpublished) workout, even their own", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c.query("select id from public.scheduled_workout_extras where id = $1", [extraOnDraftA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("Coach A can still read an extra on their own draft workout", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.scheduled_workout_extras where id = $1", [extraOnDraftA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("Coach A can update an extra on their own athlete's workout", async () => {
    const result = await asUser(IDS.coachA, (c) =>
      c.query("update public.scheduled_workout_extras set overview = 'Updated' where id = $1", [extraOnA.id]),
    );
    expect(result.rowCount).toBe(1);
    await withCommittedServiceRole((c) =>
      c.query("update public.scheduled_workout_extras set overview = 'Do each drill 50m' where id = $1", [extraOnA.id]),
    );
  });

  it("Coach B cannot read or update Athlete A's workout extra", async () => {
    const rows = await asUser(IDS.coachB, (c) =>
      c.query("select id from public.scheduled_workout_extras where id = $1", [extraOnA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);

    const result = await asUser(IDS.coachB, (c) =>
      c.query("update public.scheduled_workout_extras set overview = 'Hijacked' where id = $1", [extraOnA.id]),
    );
    expect(result.rowCount).toBe(0);
  });

  it("Athlete B cannot read Athlete A's workout extra", async () => {
    const rows = await asUser(IDS.athleteB, (c) =>
      c.query("select id from public.scheduled_workout_extras where id = $1", [extraOnA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("an unauthenticated (anon) request cannot read a workout extra", async () => {
    const rows = await asAnon((c) =>
      c.query("select id from public.scheduled_workout_extras where id = $1", [extraOnA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });
});
