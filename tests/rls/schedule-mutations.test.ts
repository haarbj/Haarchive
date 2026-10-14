import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asUser, closePool, withCommittedServiceRole } from "./db-client";
import { IDS } from "./fixtures";

// The calendar rebuild's two new mutation paths (rescheduleWorkout's
// UPDATE ... SET scheduled_date, duplicateScheduledWorkout's fresh-row
// INSERT) ride the existing scheduled_workouts_all_coach policy
// unchanged -- no new policy was added for them. Per explicit request,
// this isn't assumed sufficient just because coach-isolation.test.ts
// already covers a `title` UPDATE and a plain DELETE on this table; RLS
// doesn't care which column changes, but these are still new mutation
// shapes worth their own direct matrix. Uses dedicated rows (not the
// shared scheduledWorkoutA/B fixtures) so this file never mutates state
// other test files depend on.
const rescheduleTargetA = { id: "00000000-0000-4000-8000-0000000090a1", athleteId: IDS.athleteA, coachId: IDS.coachA };
const rescheduleTargetB = { id: "00000000-0000-4000-8000-0000000090b1", athleteId: IDS.athleteB, coachId: IDS.coachB };
const insertedIds: string[] = [];

beforeAll(async () => {
  await withCommittedServiceRole(async (c) => {
    await c.query(
      `insert into public.scheduled_workouts (id, athlete_id, coach_id, scheduled_date, title, published_at)
       values ($1, $2, $3, current_date, 'Reschedule Target A', now())`,
      [rescheduleTargetA.id, rescheduleTargetA.athleteId, rescheduleTargetA.coachId],
    );
    await c.query(
      `insert into public.scheduled_workouts (id, athlete_id, coach_id, scheduled_date, title, published_at)
       values ($1, $2, $3, current_date, 'Reschedule Target B', now())`,
      [rescheduleTargetB.id, rescheduleTargetB.athleteId, rescheduleTargetB.coachId],
    );
  });
});

afterAll(async () => {
  await withCommittedServiceRole((c) =>
    c.query("delete from public.scheduled_workouts where id = any($1)", [[rescheduleTargetA.id, rescheduleTargetB.id, ...insertedIds]]),
  );
  await closePool();
});

describe("scheduled_workouts reschedule (UPDATE ... SET scheduled_date)", () => {
  it("Coach A can reschedule Athlete A's workout (real relationship)", async () => {
    const result = await asUser(IDS.coachA, (c) =>
      c.query("update public.scheduled_workouts set scheduled_date = current_date + 1 where id = $1", [rescheduleTargetA.id]),
    );
    expect(result.rowCount).toBe(1);
  });

  it("Coach A cannot reschedule Athlete B's workout (not their athlete)", async () => {
    const result = await asUser(IDS.coachA, (c) =>
      c.query("update public.scheduled_workouts set scheduled_date = current_date + 1 where id = $1", [rescheduleTargetB.id]),
    );
    expect(result.rowCount).toBe(0);
  });

  it("Coach B cannot reschedule Athlete A's workout (not their athlete)", async () => {
    const result = await asUser(IDS.coachB, (c) =>
      c.query("update public.scheduled_workouts set scheduled_date = current_date + 1 where id = $1", [rescheduleTargetA.id]),
    );
    expect(result.rowCount).toBe(0);
  });

  it("Athlete A cannot reschedule their own workout -- no athlete write policy on scheduled_workouts at all", async () => {
    const result = await asUser(IDS.athleteA, (c) =>
      c.query("update public.scheduled_workouts set scheduled_date = current_date + 1 where id = $1", [rescheduleTargetA.id]),
    );
    expect(result.rowCount).toBe(0);
  });
});

describe("scheduled_workouts duplicate (fresh-row INSERT)", () => {
  it("Coach A can insert a new workout for their own athlete (Athlete A)", async () => {
    const result = await asUser(IDS.coachA, (c) =>
      c.query(
        `insert into public.scheduled_workouts (athlete_id, coach_id, scheduled_date, title, published_at)
         values ($1, $2, current_date, 'Duplicated Workout', null) returning id`,
        [IDS.athleteA, IDS.coachA],
      ),
    );
    expect(result.rowCount).toBe(1);
    insertedIds.push(result.rows[0].id);
  });

  it("Coach A cannot insert a workout claiming Athlete B (not their athlete)", async () => {
    await expect(
      asUser(IDS.coachA, (c) =>
        c.query(
          `insert into public.scheduled_workouts (athlete_id, coach_id, scheduled_date, title, published_at)
           values ($1, $2, current_date, 'Forged Duplicate', null)`,
          [IDS.athleteB, IDS.coachA],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("Coach B cannot insert a workout claiming Athlete A (not their athlete)", async () => {
    await expect(
      asUser(IDS.coachB, (c) =>
        c.query(
          `insert into public.scheduled_workouts (athlete_id, coach_id, scheduled_date, title, published_at)
           values ($1, $2, current_date, 'Forged Duplicate', null)`,
          [IDS.athleteA, IDS.coachB],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("Athlete A cannot insert a scheduled_workouts row at all", async () => {
    await expect(
      asUser(IDS.athleteA, (c) =>
        c.query(
          `insert into public.scheduled_workouts (athlete_id, coach_id, scheduled_date, title, published_at)
           values ($1, $2, current_date, 'Athlete Self-Insert', null)`,
          [IDS.athleteA, IDS.coachA],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });
});
