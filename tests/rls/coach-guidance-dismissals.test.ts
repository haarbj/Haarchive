import { afterAll, describe, expect, it } from "vitest";

import { asUser, closePool, withCommittedServiceRole } from "./db-client";
import { IDS } from "./fixtures";

// coach_guidance_dismissals (Part B): a coach's own "I am not acting on
// that" answers to the advisory plan-health findings. Coach-only by
// design -- Part B is invisible to athletes, so an athlete must not be
// able to read or write any of it.

afterAll(async () => {
  await withCommittedServiceRole((c) =>
    c.query("delete from public.coach_guidance_dismissals where athlete_id in ($1, $2)", [IDS.athleteA, IDS.athleteB]),
  );
  await closePool();
});

describe("coach_guidance_dismissals RLS", () => {
  it("lets a coach dismiss a finding for an athlete they actually coach", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c
        .query(
          "insert into public.coach_guidance_dismissals (coach_id, athlete_id, finding_key) values ($1, $2, 'mp-rehearsal-missing') returning id",
          [IDS.coachA, IDS.athleteA],
        )
        .then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("stops a coach dismissing for an athlete they do not coach", async () => {
    await expect(
      asUser(IDS.coachA, (c) =>
        c.query("insert into public.coach_guidance_dismissals (coach_id, athlete_id, finding_key) values ($1, $2, 'x')", [
          IDS.coachA,
          IDS.athleteB,
        ]),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("stops a coach writing a dismissal under another coach's id", async () => {
    await expect(
      asUser(IDS.coachA, (c) =>
        c.query("insert into public.coach_guidance_dismissals (coach_id, athlete_id, finding_key) values ($1, $2, 'x')", [
          IDS.coachB,
          IDS.athleteA,
        ]),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("hides one coach's dismissals from another coach", async () => {
    await withCommittedServiceRole((c) =>
      c.query(
        "insert into public.coach_guidance_dismissals (coach_id, athlete_id, finding_key) values ($1, $2, 'visible-to-a-only') on conflict do nothing",
        [IDS.coachA, IDS.athleteA],
      ),
    );
    const seenByB = await asUser(IDS.coachB, (c) =>
      c.query("select id from public.coach_guidance_dismissals where finding_key = 'visible-to-a-only'").then((r) => r.rows),
    );
    expect(seenByB).toHaveLength(0);

    const seenByA = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.coach_guidance_dismissals where finding_key = 'visible-to-a-only'").then((r) => r.rows),
    );
    expect(seenByA).toHaveLength(1);
  });

  it("shows an athlete nothing at all, including their own coach's dismissals", async () => {
    await withCommittedServiceRole((c) =>
      c.query(
        "insert into public.coach_guidance_dismissals (coach_id, athlete_id, finding_key) values ($1, $2, 'athlete-must-not-see') on conflict do nothing",
        [IDS.coachA, IDS.athleteA],
      ),
    );
    const seen = await asUser(IDS.athleteA, (c) =>
      c.query("select id from public.coach_guidance_dismissals").then((r) => r.rows),
    );
    expect(seen).toHaveLength(0);
  });

  it("keeps re-dismissing the same finding a single row", async () => {
    await withCommittedServiceRole((c) =>
      c.query("delete from public.coach_guidance_dismissals where finding_key = 'idempotent'"),
    );
    const count = await asUser(IDS.coachA, async (c) => {
      for (let i = 0; i < 3; i += 1) {
        await c.query(
          `insert into public.coach_guidance_dismissals (coach_id, athlete_id, finding_key) values ($1, $2, 'idempotent')
           on conflict (coach_id, athlete_id, finding_key) do nothing`,
          [IDS.coachA, IDS.athleteA],
        );
      }
      return c
        .query("select count(*)::int as n from public.coach_guidance_dismissals where finding_key = 'idempotent'")
        .then((r) => r.rows[0].n);
    });
    expect(count).toBe(1);
  });
});
