import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asAnon, asUser, closePool, withCommittedServiceRole } from "./db-client";
import { IDS } from "./fixtures";

// coach_extra_presets: a coach's own reusable extras library, same
// relationship shape as workout_templates -- coach-only, no athlete
// policy at all (athletes never browse presets, only see their effect
// once applied to a real workout's extras).
const presetA = { id: "00000000-0000-4000-8000-0000000000c1", coachId: IDS.coachA };

beforeAll(async () => {
  await withCommittedServiceRole((c) =>
    c.query(
      `insert into public.coach_extra_presets (id, coach_id, name, kind, overview, items)
       values ($1, $2, 'Standard Drill Circuit', 'Drills', 'Do each drill 50m', array['A skips x2','B skips'])`,
      [presetA.id, presetA.coachId],
    ),
  );
});

afterAll(async () => {
  await withCommittedServiceRole((c) => c.query("delete from public.coach_extra_presets where id = $1", [presetA.id]));
  await closePool();
});

describe("coach_extra_presets RLS", () => {
  it("Coach A (the owning coach) can read their own preset", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.coach_extra_presets where id = $1", [presetA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("Coach A can update their own preset", async () => {
    const result = await asUser(IDS.coachA, (c) =>
      c.query("update public.coach_extra_presets set name = 'Updated Circuit' where id = $1", [presetA.id]),
    );
    expect(result.rowCount).toBe(1);
    await withCommittedServiceRole((c) =>
      c.query("update public.coach_extra_presets set name = 'Standard Drill Circuit' where id = $1", [presetA.id]),
    );
  });

  it("Coach B cannot read Coach A's preset", async () => {
    const rows = await asUser(IDS.coachB, (c) =>
      c.query("select id from public.coach_extra_presets where id = $1", [presetA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("Coach B cannot update or delete Coach A's preset", async () => {
    const updateResult = await asUser(IDS.coachB, (c) =>
      c.query("update public.coach_extra_presets set name = 'Hijacked' where id = $1", [presetA.id]),
    );
    expect(updateResult.rowCount).toBe(0);

    const deleteResult = await asUser(IDS.coachB, (c) =>
      c.query("delete from public.coach_extra_presets where id = $1", [presetA.id]),
    );
    expect(deleteResult.rowCount).toBe(0);
  });

  it("Athlete A (Coach A's own athlete) cannot read the preset -- no athlete policy exists at all", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c.query("select id from public.coach_extra_presets where id = $1", [presetA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("Coach A cannot insert a preset claiming a different coach_id", async () => {
    await expect(
      asUser(IDS.coachA, (c) =>
        c.query(`insert into public.coach_extra_presets (coach_id, name, kind) values ($1, 'Forged', 'Drills')`, [IDS.coachB]),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("an unauthenticated (anon) request cannot read a preset", async () => {
    const rows = await asAnon((c) =>
      c.query("select id from public.coach_extra_presets where id = $1", [presetA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });
});
