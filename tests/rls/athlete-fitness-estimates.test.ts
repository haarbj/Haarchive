import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asUser, closePool, withCommittedServiceRole } from "./db-client";
import { IDS } from "./fixtures";

// athlete_fitness_estimates: full CRUD by the owning athlete, read-only for
// their coach (coaches_this_athlete()) -- the same shape race_results/
// injuries/athlete_profiles already have. One row per (athlete_id,
// reference_key) -- "your current 5K estimate," not a history list.
describe("athlete_fitness_estimates RLS", () => {
  afterAll(async () => {
    await withCommittedServiceRole((c) =>
      c.query("delete from public.athlete_fitness_estimates where athlete_id in ($1, $2)", [IDS.athleteA, IDS.athleteB]),
    );
    await closePool();
  });

  it("an athlete can insert and read their own estimate", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c
        .query(
          "insert into public.athlete_fitness_estimates (athlete_id, reference_key, estimated_time_s) values ($1, '5k', 1012) returning reference_key, estimated_time_s",
          [IDS.athleteA],
        )
        .then(() => c.query("select reference_key, estimated_time_s from public.athlete_fitness_estimates where athlete_id = $1", [IDS.athleteA]))
        .then((r) => r.rows),
    );
    expect(rows).toEqual([{ reference_key: "5k", estimated_time_s: 1012 }]);
  });

  it("an athlete can update their own estimate (one row per reference_key, not a growing history)", async () => {
    const rows = await withCommittedServiceRole(async (c) => {
      await c.query(
        "insert into public.athlete_fitness_estimates (athlete_id, reference_key, estimated_time_s) values ($1, 'marathon', 12420) on conflict (athlete_id, reference_key) do nothing",
        [IDS.athleteA],
      );
      return c.query("select estimated_time_s from public.athlete_fitness_estimates where athlete_id = $1 and reference_key = 'marathon'", [
        IDS.athleteA,
      ]);
    });
    expect(rows.rows[0].estimated_time_s).toBe(12420);

    const updated = await asUser(IDS.athleteA, (c) =>
      c
        .query("update public.athlete_fitness_estimates set estimated_time_s = 12000 where athlete_id = $1 and reference_key = 'marathon'", [
          IDS.athleteA,
        ])
        .then(() =>
          c.query("select estimated_time_s from public.athlete_fitness_estimates where athlete_id = $1 and reference_key = 'marathon'", [
            IDS.athleteA,
          ]),
        )
        .then((r) => r.rows),
    );
    expect(updated).toEqual([{ estimated_time_s: 12000 }]);
  });

  it("an athlete cannot insert an estimate for someone else", async () => {
    await expect(
      asUser(IDS.athleteA, (c) =>
        c.query("insert into public.athlete_fitness_estimates (athlete_id, reference_key, estimated_time_s) values ($1, '5k', 1000)", [
          IDS.athleteB,
        ]),
      ),
    ).rejects.toThrow();
  });

  it("Coach A (a real relationship with Athlete A) can read Athlete A's estimate but cannot write it", async () => {
    await withCommittedServiceRole((c) =>
      c.query(
        "insert into public.athlete_fitness_estimates (athlete_id, reference_key, estimated_time_s) values ($1, '5k', 1012) on conflict (athlete_id, reference_key) do nothing",
        [IDS.athleteA],
      ),
    );

    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select reference_key from public.athlete_fitness_estimates where athlete_id = $1", [IDS.athleteA]).then((r) => r.rows),
    );
    expect(rows.length).toBeGreaterThan(0);

    const updateResult = await asUser(IDS.coachA, (c) =>
      c.query("update public.athlete_fitness_estimates set estimated_time_s = 1 where athlete_id = $1 and reference_key = '5k'", [IDS.athleteA]),
    );
    expect(updateResult.rowCount).toBe(0);
  });

  it("Coach B (no relationship with Athlete A) cannot read Athlete A's estimate", async () => {
    const rows = await asUser(IDS.coachB, (c) =>
      c.query("select reference_key from public.athlete_fitness_estimates where athlete_id = $1", [IDS.athleteA]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("an athlete can delete their own estimate", async () => {
    await withCommittedServiceRole((c) =>
      c.query(
        "insert into public.athlete_fitness_estimates (athlete_id, reference_key, estimated_time_s) values ($1, '5k', 999) on conflict (athlete_id, reference_key) do update set estimated_time_s = 999",
        [IDS.athleteB],
      ),
    );
    const rows = await asUser(IDS.athleteB, (c) =>
      c
        .query("delete from public.athlete_fitness_estimates where athlete_id = $1 and reference_key = '5k'", [IDS.athleteB])
        .then(() => c.query("select 1 from public.athlete_fitness_estimates where athlete_id = $1 and reference_key = '5k'", [IDS.athleteB]))
        .then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });
});
