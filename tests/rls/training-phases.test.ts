import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asAnon, asUser, closePool, withCommittedServiceRole } from "./db-client";
import { IDS } from "./fixtures";

// training_phases: explicit, coach-defined training phases -- coach-owned
// CRUD (mirroring scheduled_workouts_all_coach's exact shape), athlete can
// read their own (mirroring training_week_plans_select_athlete), and
// phases for one athlete must never overlap -- enforced by a real
// Postgres EXCLUDE constraint, not just app-layer validation (see the
// migration).
const phaseA = {
  id: "00000000-0000-4000-8000-0000000095a1",
  athleteId: IDS.athleteA,
  coachId: IDS.coachA,
  startDate: "2026-08-24",
  endDate: "2026-09-20",
};

beforeAll(async () => {
  await withCommittedServiceRole((c) =>
    c.query(
      `insert into public.training_phases (id, athlete_id, coach_id, phase_type, name, start_date, end_date)
       values ($1, $2, $3, 'Base', 'Aerobic Development', $4, $5)`,
      [phaseA.id, phaseA.athleteId, phaseA.coachId, phaseA.startDate, phaseA.endDate],
    ),
  );
});

afterAll(async () => {
  await withCommittedServiceRole((c) => c.query("delete from public.training_phases where id = $1", [phaseA.id]));
  await closePool();
});

describe("training_phases RLS", () => {
  it("Coach A (the owning coach) can read their own phase", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.training_phases where id = $1", [phaseA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("Coach A can update their own phase", async () => {
    const result = await asUser(IDS.coachA, (c) =>
      c.query("update public.training_phases set name = 'Updated' where id = $1", [phaseA.id]),
    );
    expect(result.rowCount).toBe(1);
    await withCommittedServiceRole((c) =>
      c.query("update public.training_phases set name = 'Aerobic Development' where id = $1", [phaseA.id]),
    );
  });

  it("Athlete A can read their own phase", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c.query("select id from public.training_phases where id = $1", [phaseA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("Coach B cannot read Coach A's phase", async () => {
    const rows = await asUser(IDS.coachB, (c) =>
      c.query("select id from public.training_phases where id = $1", [phaseA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("Coach B cannot update or delete Coach A's phase", async () => {
    const updateResult = await asUser(IDS.coachB, (c) =>
      c.query("update public.training_phases set name = 'Hijacked' where id = $1", [phaseA.id]),
    );
    expect(updateResult.rowCount).toBe(0);

    const deleteResult = await asUser(IDS.coachB, (c) =>
      c.query("delete from public.training_phases where id = $1", [phaseA.id]),
    );
    expect(deleteResult.rowCount).toBe(0);
  });

  it("Athlete B cannot read Athlete A's phase", async () => {
    const rows = await asUser(IDS.athleteB, (c) =>
      c.query("select id from public.training_phases where id = $1", [phaseA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("Coach A cannot insert a phase claiming a different coach_id", async () => {
    await expect(
      asUser(IDS.coachA, (c) =>
        c.query(
          `insert into public.training_phases (athlete_id, coach_id, phase_type, start_date, end_date)
           values ($1, $2, 'Build', '2026-10-01', '2026-10-28')`,
          [IDS.athleteA, IDS.coachB],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("Coach A cannot insert a phase for an athlete they don't coach", async () => {
    await expect(
      asUser(IDS.coachA, (c) =>
        c.query(
          `insert into public.training_phases (athlete_id, coach_id, phase_type, start_date, end_date)
           values ($1, $2, 'Build', '2026-10-01', '2026-10-28')`,
          [IDS.athleteB, IDS.coachA],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("an unauthenticated (anon) request cannot read a phase", async () => {
    const rows = await asAnon((c) => c.query("select id from public.training_phases where id = $1", [phaseA.id]).then((r) => r.rows));
    expect(rows).toHaveLength(0);
  });

  it("rejects an overlapping phase for the same athlete via the exclusion constraint", async () => {
    // phaseA runs Aug 24 - Sep 20; this insert overlaps by one day (Sep 20).
    await expect(
      asUser(IDS.coachA, (c) =>
        c.query(
          `insert into public.training_phases (athlete_id, coach_id, phase_type, start_date, end_date)
           values ($1, $2, 'Build', '2026-09-20', '2026-10-18')`,
          [IDS.athleteA, IDS.coachA],
        ),
      ),
    ).rejects.toThrow(/exclu/i);
  });

  it("allows a non-overlapping, adjacent phase for the same athlete", async () => {
    const id = "00000000-0000-4000-8000-0000000095a2";
    const result = await asUser(IDS.coachA, (c) =>
      c.query(
        `insert into public.training_phases (id, athlete_id, coach_id, phase_type, start_date, end_date)
         values ($1, $2, $3, 'Build', '2026-09-21', '2026-10-18')`,
        [id, IDS.athleteA, IDS.coachA],
      ),
    );
    expect(result.rowCount).toBe(1);
    await withCommittedServiceRole((c) => c.query("delete from public.training_phases where id = $1", [id]));
  });

  it("allows overlapping date ranges across two different athletes", async () => {
    const id = "00000000-0000-4000-8000-0000000095b1";
    const result = await asUser(IDS.coachB, (c) =>
      c.query(
        `insert into public.training_phases (id, athlete_id, coach_id, phase_type, start_date, end_date)
         values ($1, $2, $3, 'Base', $4, $5)`,
        [id, IDS.athleteB, IDS.coachB, phaseA.startDate, phaseA.endDate],
      ),
    );
    expect(result.rowCount).toBe(1);
    await withCommittedServiceRole((c) => c.query("delete from public.training_phases where id = $1", [id]));
  });
});
