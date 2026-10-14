import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asUser, closePool, withCommittedServiceRole } from "./db-client";
import { IDS } from "./fixtures";

const revocationTestImageId = "00000000-0000-4000-8000-0000000070c1";

// This file ends the Coach A <-> Athlete A relationship for its own
// duration and restores it afterward -- self-contained regardless of
// which order Vitest runs RLS test files in (fileParallelism is off, but
// file order isn't otherwise guaranteed).
//
// Also inserts real rows into every existing table Coach A gains read
// access to (athlete_profiles/goals/race_results/injuries/
// weekly_checkins/athlete_metrics) -- without a real row, "0 rows
// returned" would be true whether access is correctly denied OR there was
// simply nothing to see, which wouldn't actually prove anything.
beforeAll(async () => {
  await withCommittedServiceRole(async (c) => {
    await c.query("insert into public.athlete_profiles (user_id, current_weekly_mileage) values ($1, 30)", [
      IDS.athleteA,
    ]);
    await c.query(
      "insert into public.goals (user_id, race_name, distance_m) values ($1, 'Test 5k', 5000)",
      [IDS.athleteA],
    );
    await c.query(
      `insert into public.race_results (user_id, race_name, race_date, distance_m, finish_time_s, course_type)
       values ($1, 'Test Race', current_date, 5000, 1200, 'road')`,
      [IDS.athleteA],
    );
    await c.query(
      `insert into public.injuries (user_id, injury_type, body_part, start_date, severity)
       values ($1, 'Strain', 'Calf', current_date, 'mild')`,
      [IDS.athleteA],
    );
    await c.query(
      `insert into public.weekly_checkins (user_id, week_start, fatigue, soreness, sleep_quality, stress)
       values ($1, date_trunc('week', current_date), 2, 2, 4, 2)`,
      [IDS.athleteA],
    );
    await c.query(
      "insert into public.athlete_metrics (athlete_id, key, value, unit) values ($1, 'threshold_pace', 375, 'sec_per_mile')",
      [IDS.athleteA],
    );
    await c.query("insert into storage.objects (id, bucket_id, name) values ($1, 'message-images', $2)", [
      revocationTestImageId,
      `${IDS.coachAthleteRelAA}/photo.jpg`,
    ]);
  });

  // Confirm access exists BEFORE revocation, so the "after" assertions
  // below are proving something actually changed, not just describing an
  // already-empty state.
  const before = await asUser(IDS.coachA, (c) =>
    c.query("select id from public.scheduled_workouts where athlete_id = $1", [IDS.athleteA]).then((r) => r.rows),
  );
  if (before.length === 0) throw new Error("Fixture setup invariant broken -- Coach A had no pre-revocation access to assert against.");

  await withCommittedServiceRole((c) =>
    c.query("update public.coach_athletes set status = 'ended', ended_at = now() where id = $1", [
      IDS.coachAthleteRelAA,
    ]),
  );
});

afterAll(async () => {
  await withCommittedServiceRole(async (c) => {
    await c.query("update public.coach_athletes set status = 'active', ended_at = null where id = $1", [
      IDS.coachAthleteRelAA,
    ]);
    await c.query("delete from public.athlete_metrics where athlete_id = $1", [IDS.athleteA]);
    await c.query("delete from public.weekly_checkins where user_id = $1", [IDS.athleteA]);
    await c.query("delete from public.injuries where user_id = $1", [IDS.athleteA]);
    await c.query("delete from public.race_results where user_id = $1", [IDS.athleteA]);
    await c.query("delete from public.goals where user_id = $1", [IDS.athleteA]);
    await c.query("delete from public.athlete_profiles where user_id = $1", [IDS.athleteA]);
    await c.query("delete from storage.objects where id = $1", [revocationTestImageId]);
  });
  await closePool();
});

describe("Relationship revocation (adversarial matrix items 27-36)", () => {
  it("27. athlete profile access is lost", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select user_id from public.athlete_profiles where user_id = $1", [IDS.athleteA]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("28. goals access is lost", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.goals where user_id = $1", [IDS.athleteA]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("29. race-result access is lost", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.race_results where user_id = $1", [IDS.athleteA]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("30. injury access is lost", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.injuries where user_id = $1", [IDS.athleteA]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("31. weekly-checkin access is lost", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.weekly_checkins where user_id = $1", [IDS.athleteA]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("32. athlete-metrics access is lost", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.athlete_metrics where athlete_id = $1", [IDS.athleteA]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("33. completed-workout access is lost", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.completed_workouts where athlete_id = $1", [IDS.athleteA]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("34. scheduled-workout write access is lost", async () => {
    const result = await asUser(IDS.coachA, (c) =>
      c.query("update public.scheduled_workouts set title = 'Post-revocation edit' where id = $1", [
        IDS.scheduledWorkoutA,
      ]),
    );
    expect(result.rowCount).toBe(0);
  });

  it("35. messaging access is lost (HIGH-4 regression -- status = 'active' enforcement)", async () => {
    const readRows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.coach_athlete_messages where coach_athlete_id = $1", [IDS.coachAthleteRelAA]).then((r) => r.rows),
    );
    expect(readRows).toHaveLength(0);

    await expect(
      asUser(IDS.coachA, (c) =>
        c.query(
          `insert into public.coach_athlete_messages (coach_athlete_id, sender_id, body)
           values ($1, $2, 'Are you still there?')`,
          [IDS.coachAthleteRelAA, IDS.coachA],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("36. workout-comment access is lost", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.workout_comments where scheduled_workout_id = $1", [IDS.scheduledWorkoutA]).then((r) => r.rows),
    );
    // Cascades from scheduled_workouts' own now-fixed policy (see
    // BLOCKER 1) -- once Coach A can no longer see scheduledWorkoutA
    // itself, the comment subquery against it also returns nothing.
    expect(rows).toHaveLength(0);
  });

  it("37. athlete's read access to the (former) coach's own profile is lost too -- is_coached_by() is the mirror grant of coaches_this_athlete(), so it must revoke the same way", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c.query("select id from public.profiles where id = $1", [IDS.coachA]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("38. message-image access is lost too -- message_images_select_participant re-checks coach_athletes.status='active' on every read, same as the messages table itself", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from storage.objects where id = $1", [revocationTestImageId]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("historical coach_athletes data remains visible, but grants no authorization", async () => {
    const historical = await asUser(IDS.coachA, (c) =>
      c
        .query("select id, status from public.coach_athletes where id = $1", [IDS.coachAthleteRelAA])
        .then((r) => r.rows),
    );
    expect(historical).toHaveLength(1);
    expect(historical[0].status).toBe("ended");

    // Seeing the historical row must not, by itself, restore any access --
    // re-confirm write access is still denied even though the
    // relationship row itself is visible.
    const writeAttempt = await asUser(IDS.coachA, (c) =>
      c.query("update public.scheduled_workouts set title = 'x' where id = $1", [IDS.scheduledWorkoutA]),
    );
    expect(writeAttempt.rowCount).toBe(0);
  });
});
