import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asAnon, asUser, closePool, withCommittedServiceRole } from "./db-client";
import { IDS } from "./fixtures";

// strava_pending_matches (20260826050000) is the athlete's Strava-review
// consent gate: a coach must never be able to read a row here (that's the
// entire point -- nothing is visible to a coach until the athlete approves
// it into completed_workouts, see completion-actions.ts's
// approveStravaMatch), so unlike completed_workouts_select_coach, there is
// deliberately no coach-facing SELECT policy at all to test the boundary
// of -- only that it's fully absent.
const pendingA = { id: "00000000-0000-4000-8000-0000000080a1", scheduledWorkoutId: IDS.scheduledWorkoutA, athleteId: IDS.athleteA };
const pendingB = { id: "00000000-0000-4000-8000-0000000080b1", scheduledWorkoutId: IDS.scheduledWorkoutB, athleteId: IDS.athleteB };

beforeAll(async () => {
  await withCommittedServiceRole(async (c) => {
    await c.query(
      `insert into public.strava_pending_matches (id, scheduled_workout_id, athlete_id, strava_activity_id, activity_name, activity_distance_m, activity_duration_s)
       values ($1, $2, $3, 111, 'Morning Run', 8000, 2400)`,
      [pendingA.id, pendingA.scheduledWorkoutId, pendingA.athleteId],
    );
    await c.query(
      `insert into public.strava_pending_matches (id, scheduled_workout_id, athlete_id, strava_activity_id, activity_name, activity_distance_m, activity_duration_s)
       values ($1, $2, $3, 222, 'Morning Run', 8000, 2400)`,
      [pendingB.id, pendingB.scheduledWorkoutId, pendingB.athleteId],
    );
  });
});

afterAll(async () => {
  await withCommittedServiceRole((c) =>
    c.query("delete from public.strava_pending_matches where id = any($1)", [[pendingA.id, pendingB.id]]),
  );
  await closePool();
});

describe("strava_pending_matches RLS", () => {
  it("Athlete A can read their own pending Strava match", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c.query("select id from public.strava_pending_matches where id = $1", [pendingA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("Coach A cannot read Athlete A's pending Strava match -- the actual consent gate, not just isolation", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.strava_pending_matches where id = $1", [pendingA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("Athlete B cannot read Athlete A's pending Strava match", async () => {
    const rows = await asUser(IDS.athleteB, (c) =>
      c.query("select id from public.strava_pending_matches where id = $1", [pendingA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("an unauthenticated (anon) request cannot read a pending match", async () => {
    const rows = await asAnon((c) =>
      c.query("select id from public.strava_pending_matches where id = $1", [pendingA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("Athlete A can dismiss (delete) their own pending match", async () => {
    const dismissId = "00000000-0000-4000-8000-0000000080a2";
    await withCommittedServiceRole((c) =>
      c.query(
        `insert into public.strava_pending_matches (id, scheduled_workout_id, athlete_id, strava_activity_id)
         values ($1, $2, $3, 333)`,
        [dismissId, IDS.scheduledWorkoutADraft, IDS.athleteA],
      ),
    );
    const result = await asUser(IDS.athleteA, (c) =>
      c.query("delete from public.strava_pending_matches where id = $1", [dismissId]),
    );
    expect(result.rowCount).toBe(1);
  });

  it("Athlete A cannot create a pending match pointing at Athlete B's scheduled workout", async () => {
    await expect(
      asUser(IDS.athleteA, (c) =>
        c.query(
          `insert into public.strava_pending_matches (scheduled_workout_id, athlete_id, strava_activity_id)
           values ($1, $2, 444)`,
          [IDS.scheduledWorkoutB, IDS.athleteA],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("Athlete B cannot delete Athlete A's pending match", async () => {
    const result = await asUser(IDS.athleteB, (c) =>
      c.query("delete from public.strava_pending_matches where id = $1", [pendingA.id]),
    );
    expect(result.rowCount).toBe(0);
  });
});
