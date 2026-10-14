import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asAnon, asUser, closePool, withCommittedServiceRole } from "./db-client";
import { IDS } from "./fixtures";

// training_week_plans (20260826080000): a week's coach-set title/target-
// volume range. Mirrors scheduled_workouts_all_coach's exact shape (coach
// owns via coaches_this_athlete, athlete gets a plain SELECT) -- this file
// exercises that same relationship matrix directly against the new table,
// not assumed correct just because it copies an already-tested policy
// shape.
const planA = { id: "00000000-0000-4000-8000-00000000a0a1", athleteId: IDS.athleteA, coachId: IDS.coachA, weekStart: "2026-08-24" };

beforeAll(async () => {
  await withCommittedServiceRole((c) =>
    c.query(
      `insert into public.training_week_plans (id, athlete_id, coach_id, week_start, label, target_volume_min, target_volume_max, target_volume_unit)
       values ($1, $2, $3, $4, 'Intro to Threshold', 45, 50, 'miles')`,
      [planA.id, planA.athleteId, planA.coachId, planA.weekStart],
    ),
  );
});

afterAll(async () => {
  await withCommittedServiceRole((c) => c.query("delete from public.training_week_plans where athlete_id = $1", [IDS.athleteA]));
  await closePool();
});

describe("training_week_plans RLS", () => {
  it("Coach A can read their own athlete's week plan", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.training_week_plans where id = $1", [planA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("Athlete A can read their own week plan", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c.query("select label from public.training_week_plans where id = $1", [planA.id]).then((r) => r.rows),
    );
    expect(rows).toEqual([{ label: "Intro to Threshold" }]);
  });

  it("Coach A can update their own athlete's week plan", async () => {
    const result = await asUser(IDS.coachA, (c) =>
      c.query("update public.training_week_plans set label = 'Updated' where id = $1", [planA.id]),
    );
    expect(result.rowCount).toBe(1);
    await withCommittedServiceRole((c) => c.query("update public.training_week_plans set label = 'Intro to Threshold' where id = $1", [planA.id]));
  });

  it("Coach B cannot read Athlete A's week plan (not their athlete)", async () => {
    const rows = await asUser(IDS.coachB, (c) =>
      c.query("select id from public.training_week_plans where id = $1", [planA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("Coach B cannot update Athlete A's week plan", async () => {
    const result = await asUser(IDS.coachB, (c) =>
      c.query("update public.training_week_plans set label = 'Hijacked' where id = $1", [planA.id]),
    );
    expect(result.rowCount).toBe(0);
  });

  it("Athlete B cannot read Athlete A's week plan", async () => {
    const rows = await asUser(IDS.athleteB, (c) =>
      c.query("select id from public.training_week_plans where id = $1", [planA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("Athlete A cannot write their own week plan -- SELECT only, no athlete write policy", async () => {
    const result = await asUser(IDS.athleteA, (c) =>
      c.query("update public.training_week_plans set label = 'Self-Edit' where id = $1", [planA.id]),
    );
    expect(result.rowCount).toBe(0);
  });

  it("Coach A cannot insert a week plan claiming Athlete B (not their athlete)", async () => {
    await expect(
      asUser(IDS.coachA, (c) =>
        c.query(
          `insert into public.training_week_plans (athlete_id, coach_id, week_start, label)
           values ($1, $2, '2026-08-31', 'Forged Plan')`,
          [IDS.athleteB, IDS.coachA],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("an unauthenticated (anon) request cannot read a week plan", async () => {
    const rows = await asAnon((c) =>
      c.query("select id from public.training_week_plans where id = $1", [planA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });
});
