import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asUser, closePool, withCommittedServiceRole } from "./db-client";
import { IDS } from "./fixtures";

// training_groups / training_group_members (see
// 20261013010000_private_coaching_training_groups.sql). Coach-owned, full
// CRUD via training_groups_all_own -- the exact same shape as
// training_programs_all_own -- plus a member-only read policy so an
// athlete can see a group they actually belong to (unlike Programs, which
// are never athlete-visible at all). training_group_members additionally
// requires coaches_this_athlete(athlete_id) on the coach-owned policy, so a
// coach can only place their own real roster athletes into their own
// groups -- this file's "wrong athlete" case exercises exactly that.
const groupA = { id: "00000000-0000-4000-8000-0000000080a1", coachId: IDS.coachA };
const memberAA = { id: "00000000-0000-4000-8000-0000000081a1", groupId: groupA.id, athleteId: IDS.athleteA };

beforeAll(async () => {
  await withCommittedServiceRole(async (c) => {
    await c.query(`insert into public.training_groups (id, coach_id, name) values ($1, $2, 'Group A')`, [
      groupA.id,
      groupA.coachId,
    ]);
    await c.query(
      `insert into public.training_group_members (id, group_id, athlete_id) values ($1, $2, $3)`,
      [memberAA.id, memberAA.groupId, memberAA.athleteId],
    );
  });
});

afterAll(async () => {
  await withCommittedServiceRole((c) => c.query("delete from public.training_groups where id = $1", [groupA.id]));
  await closePool();
});

describe("training_groups RLS", () => {
  it("Coach A (the owning coach) can read their own group", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.training_groups where id = $1", [groupA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("Coach B cannot read, update, or delete Coach A's group", async () => {
    const rows = await asUser(IDS.coachB, (c) =>
      c.query("select id from public.training_groups where id = $1", [groupA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);

    const updateResult = await asUser(IDS.coachB, (c) =>
      c.query("update public.training_groups set name = 'Hijacked' where id = $1", [groupA.id]),
    );
    expect(updateResult.rowCount).toBe(0);

    const deleteResult = await asUser(IDS.coachB, (c) =>
      c.query("delete from public.training_groups where id = $1", [groupA.id]),
    );
    expect(deleteResult.rowCount).toBe(0);
  });

  it("Athlete A (a member of the group) can read it", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c.query("select id from public.training_groups where id = $1", [groupA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("Athlete B (not a member of the group) cannot read it, even though Athlete B is a real athlete of a real coach", async () => {
    const rows = await asUser(IDS.athleteB, (c) =>
      c.query("select id from public.training_groups where id = $1", [groupA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });
});

describe("training_group_members RLS", () => {
  it("Coach A can read their own group's membership row", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.training_group_members where id = $1", [memberAA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("Coach B cannot read or delete Coach A's group's membership row", async () => {
    const rows = await asUser(IDS.coachB, (c) =>
      c.query("select id from public.training_group_members where id = $1", [memberAA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);

    const deleteResult = await asUser(IDS.coachB, (c) =>
      c.query("delete from public.training_group_members where id = $1", [memberAA.id]),
    );
    expect(deleteResult.rowCount).toBe(0);
  });

  it("Athlete A (the member) can read their own membership row", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c.query("select id from public.training_group_members where id = $1", [memberAA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("Athlete B (not the member) cannot read Athlete A's membership row", async () => {
    const rows = await asUser(IDS.athleteB, (c) =>
      c.query("select id from public.training_group_members where id = $1", [memberAA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("Coach A cannot add Athlete B to their own group -- Athlete B is not Coach A's athlete", async () => {
    const insertResult = await asUser(IDS.coachA, (c) =>
      c.query("insert into public.training_group_members (group_id, athlete_id) values ($1, $2)", [
        groupA.id,
        IDS.athleteB,
      ]),
    ).catch((error: unknown) => error);
    // Blocked by the with-check clause (coaches_this_athlete(athlete_id)
    // fails for Athlete B under Coach A) -- Postgres raises a row-security
    // violation rather than silently inserting zero rows, since this is an
    // INSERT, not an UPDATE/DELETE against an existing row.
    expect(insertResult).toBeInstanceOf(Error);
    expect((insertResult as Error).message).toMatch(/row-level security|new row violates/i);
  });

  it("Coach A CAN add Athlete A (their real athlete) to a second group they own", async () => {
    // asUser always rolls back (see db-client.ts), so the insert and the
    // read-back confirming it landed both have to happen inside this one
    // call, on the same transaction -- a later asUser call would see
    // nothing (correctly rolled back), not a real failure.
    const secondGroupId = "00000000-0000-4000-8000-0000000080a2";
    const newMemberId = "00000000-0000-4000-8000-0000000081a2";
    const rows = await asUser(IDS.coachA, async (c) => {
      await c.query("insert into public.training_groups (id, coach_id, name) values ($1, $2, 'Group A2')", [
        secondGroupId,
        IDS.coachA,
      ]);
      await c.query("insert into public.training_group_members (id, group_id, athlete_id) values ($1, $2, $3)", [
        newMemberId,
        secondGroupId,
        IDS.athleteA,
      ]);
      return c
        .query("select id from public.training_group_members where id = $1", [newMemberId])
        .then((r) => r.rows);
    });
    expect(rows).toHaveLength(1);
  });
});
