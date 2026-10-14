import { afterAll, describe, expect, it } from "vitest";

import { asUser, closePool, withCommittedServiceRole } from "./db-client";
import { IDS } from "./fixtures";

// coach_estimate_reviews (Part F). Coach-only decision support: an athlete
// must not be able to read their coach's working notes, and must certainly
// not be able to write them. Also guards the boundary this table exists
// alongside -- the coach still cannot write athlete_fitness_estimates.

afterAll(async () => {
  await withCommittedServiceRole((c) =>
    c.query("delete from public.coach_estimate_reviews where athlete_id in ($1, $2)", [IDS.athleteA, IDS.athleteB]),
  );
  await closePool();
});

const insert = `insert into public.coach_estimate_reviews
  (coach_id, athlete_id, reference_key, previous_time_s, proposed_time_s, confirmed_time_s, verdict, reasoning, sessions_counted, work_completed)
  values ($1, $2, 'marathon', 11000, 11200, 11200, 'looks-optimistic', 'because', 4, true) returning id`;

describe("coach_estimate_reviews RLS", () => {
  it("lets a coach record a review for an athlete they coach", async () => {
    const rows = await asUser(IDS.coachA, (c) => c.query(insert, [IDS.coachA, IDS.athleteA]).then((r) => r.rows));
    expect(rows).toHaveLength(1);
  });

  it("stops a coach recording a review for an athlete they do not coach", async () => {
    await expect(asUser(IDS.coachA, (c) => c.query(insert, [IDS.coachA, IDS.athleteB]))).rejects.toThrow(
      /row-level security/i,
    );
  });

  it("stops a coach writing under another coach's id", async () => {
    await expect(asUser(IDS.coachA, (c) => c.query(insert, [IDS.coachB, IDS.athleteA]))).rejects.toThrow(
      /row-level security/i,
    );
  });

  it("hides one coach's reviews from another coach", async () => {
    await withCommittedServiceRole((c) =>
      c.query(
        `insert into public.coach_estimate_reviews (coach_id, athlete_id, reference_key, verdict) values ($1, $2, 'marathon', 'coach-a-only')`,
        [IDS.coachA, IDS.athleteA],
      ),
    );
    const seenByB = await asUser(IDS.coachB, (c) =>
      c.query("select id from public.coach_estimate_reviews where verdict = 'coach-a-only'").then((r) => r.rows),
    );
    expect(seenByB).toHaveLength(0);
  });

  it("shows the athlete nothing, including reviews about themselves", async () => {
    await withCommittedServiceRole((c) =>
      c.query(
        `insert into public.coach_estimate_reviews (coach_id, athlete_id, reference_key, verdict) values ($1, $2, 'marathon', 'athlete-must-not-see')`,
        [IDS.coachA, IDS.athleteA],
      ),
    );
    const seen = await asUser(IDS.athleteA, (c) => c.query("select id from public.coach_estimate_reviews").then((r) => r.rows));
    expect(seen).toHaveLength(0);
  });

  it("stops an athlete recording a review about themselves", async () => {
    await expect(asUser(IDS.athleteA, (c) => c.query(insert, [IDS.athleteA, IDS.athleteA]))).rejects.toThrow(
      /row-level security/i,
    );
  });

  it("still does not let the coach write the athlete's own fitness estimate", async () => {
    // The boundary this whole part is designed around: a review records the
    // coach's conclusion, it does not overwrite the athlete's estimate.
    await expect(
      asUser(IDS.coachA, (c) =>
        c.query(
          "insert into public.athlete_fitness_estimates (athlete_id, reference_key, estimated_time_s) values ($1, 'marathon', 11000)",
          [IDS.athleteA],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("rejects a non-positive confirmed time at the database level", async () => {
    await expect(
      asUser(IDS.coachA, (c) =>
        c.query(
          `insert into public.coach_estimate_reviews (coach_id, athlete_id, reference_key, verdict, confirmed_time_s) values ($1, $2, 'marathon', 'x', 0)`,
          [IDS.coachA, IDS.athleteA],
        ),
      ),
    ).rejects.toThrow(/check constraint/i);
  });
});
