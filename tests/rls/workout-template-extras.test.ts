import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asAnon, asUser, closePool, withCommittedServiceRole } from "./db-client";
import { IDS } from "./fixtures";

// workout_template_extras (20260826140000): a template's own fixed
// extras, same coach-only relationship shape as workout_template_steps --
// scoped via a join to the parent workout_templates row's coach_id, not a
// direct column, since a template has no athlete_id at all. No athlete
// policy exists at all (same as coach_extra_presets) -- a template is
// never athlete-visible until its contents are copied into a real
// scheduled_workout.
const extraA = { id: "00000000-0000-4000-8000-0000000090a1", templateId: IDS.templateA };

beforeAll(async () => {
  await withCommittedServiceRole((c) =>
    c.query(
      `insert into public.workout_template_extras (id, template_id, extra_order, kind, overview, items)
       values ($1, $2, 0, 'Drills', 'Do each drill 50m', array['A skips x2','B skips'])`,
      [extraA.id, extraA.templateId],
    ),
  );
});

afterAll(async () => {
  await withCommittedServiceRole((c) => c.query("delete from public.workout_template_extras where id = $1", [extraA.id]));
  await closePool();
});

describe("workout_template_extras RLS", () => {
  it("Coach A (the owning coach, via templateA) can read their own template's extra", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.workout_template_extras where id = $1", [extraA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("Coach A can update their own template's extra", async () => {
    const result = await asUser(IDS.coachA, (c) =>
      c.query("update public.workout_template_extras set overview = 'Updated' where id = $1", [extraA.id]),
    );
    expect(result.rowCount).toBe(1);
    await withCommittedServiceRole((c) =>
      c.query("update public.workout_template_extras set overview = 'Do each drill 50m' where id = $1", [extraA.id]),
    );
  });

  it("Coach B cannot read Coach A's template extra", async () => {
    const rows = await asUser(IDS.coachB, (c) =>
      c.query("select id from public.workout_template_extras where id = $1", [extraA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("Coach B cannot update or delete Coach A's template extra", async () => {
    const updateResult = await asUser(IDS.coachB, (c) =>
      c.query("update public.workout_template_extras set overview = 'Hijacked' where id = $1", [extraA.id]),
    );
    expect(updateResult.rowCount).toBe(0);

    const deleteResult = await asUser(IDS.coachB, (c) =>
      c.query("delete from public.workout_template_extras where id = $1", [extraA.id]),
    );
    expect(deleteResult.rowCount).toBe(0);
  });

  it("Athlete A cannot read the template extra -- no athlete policy exists at all", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c.query("select id from public.workout_template_extras where id = $1", [extraA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("Coach B cannot insert an extra pointing at Coach A's template", async () => {
    await expect(
      asUser(IDS.coachB, (c) =>
        c.query(
          `insert into public.workout_template_extras (template_id, extra_order, kind) values ($1, 1, 'Forged')`,
          [IDS.templateA],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("an unauthenticated (anon) request cannot read a template extra", async () => {
    const rows = await asAnon((c) =>
      c.query("select id from public.workout_template_extras where id = $1", [extraA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });
});
