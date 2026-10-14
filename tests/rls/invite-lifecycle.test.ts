import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { asUser, closePool, withCommittedServiceRole } from "./db-client";
import { IDS } from "./fixtures";

afterAll(closePool);

const cleanupInviteIds: string[] = [];
const cleanupRelationshipIds: string[] = [];

afterEach(async () => {
  if (cleanupInviteIds.length === 0 && cleanupRelationshipIds.length === 0) return;
  await withCommittedServiceRole(async (c) => {
    if (cleanupRelationshipIds.length) {
      await c.query("delete from public.coach_athletes where id = any($1)", [cleanupRelationshipIds]);
      cleanupRelationshipIds.length = 0;
    }
    if (cleanupInviteIds.length) {
      await c.query("delete from public.coach_athlete_invites where id = any($1)", [cleanupInviteIds]);
      cleanupInviteIds.length = 0;
    }
  });
});

describe("Invite lifecycle (adversarial matrix items 37-42)", () => {
  it("37. pending invite grants no coaching access", async () => {
    const invite = await withCommittedServiceRole((c) =>
      c
        .query(
          "insert into public.coach_athlete_invites (coach_id, athlete_email) values ($1, $2) returning id",
          [IDS.coachA, `pending-${randomUUID()}@rls-test.invalid`],
        )
        .then((r) => r.rows[0]),
    );
    cleanupInviteIds.push(invite.id);

    // coach_athlete_invites has zero policies for authenticated -- deny-all.
    const asCoach = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.coach_athlete_invites where id = $1", [invite.id]).then((r) => r.rows),
    );
    expect(asCoach).toHaveLength(0);

    // No coach_athletes row exists yet for the invited email's (not-yet-
    // real) athlete -- every coaches_this_athlete()-gated policy denies
    // by construction with no relationship row to find, which the rest of
    // this suite already exercises exhaustively; this just confirms the
    // premise: an invite alone creates no such row.
    const wouldBeAthleteId = randomUUID();
    const relRows = await withCommittedServiceRole((c) =>
      c
        .query("select id from public.coach_athletes where coach_id = $1 and athlete_id = $2", [
          IDS.coachA,
          wouldBeAthleteId,
        ])
        .then((r) => r.rows),
    );
    expect(relRows).toHaveLength(0);
  });

  it("38. a valid invite can be accepted (i.e. the resulting coach_athletes row grants real access)", async () => {
    const admin = await withCommittedServiceRole(async (c) => {
      const email = `accept-${randomUUID()}@rls-test.invalid`;
      const newAthleteId = randomUUID();
      await c.query("insert into auth.users (id, email) values ($1, $2)", [newAthleteId, email]);
      // on_auth_user_created (init_schema.sql) already auto-created a
      // profiles row for newAthleteId off the auth.users insert above --
      // on conflict do nothing, matching fixtures.ts's own convention,
      // since this test doesn't assert on display_name.
      await c.query(
        "insert into public.profiles (id, display_name) values ($1, 'Invite Test Athlete') on conflict (id) do nothing",
        [newAthleteId],
      );
      const invite = await c
        .query(
          "insert into public.coach_athlete_invites (coach_id, athlete_email) values ($1, $2) returning id",
          [IDS.coachA, email],
        )
        .then((r) => r.rows[0]);
      // Redemption itself is inherently service-role-mediated in the real
      // app too (coach_athlete_invites is deny-all for authenticated) --
      // this is the exact mutation acceptPrivateCoachInvite performs.
      const rel = await c
        .query(
          "insert into public.coach_athletes (coach_id, athlete_id, status) values ($1, $2, 'active') returning id",
          [IDS.coachA, newAthleteId],
        )
        .then((r) => r.rows[0]);
      await c.query("update public.coach_athlete_invites set redeemed_at = now(), redeemed_by = $2 where id = $1", [
        invite.id,
        newAthleteId,
      ]);
      return { inviteId: invite.id, relId: rel.id, newAthleteId };
    });
    cleanupInviteIds.push(admin.inviteId);
    cleanupRelationshipIds.push(admin.relId);

    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from public.profiles where id = $1", [admin.newAthleteId]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);

    await withCommittedServiceRole((c) =>
      c.query("delete from public.profiles where id = $1", [admin.newAthleteId]),
    );
  });

  it("39. expired invite -- NOT a database-level constraint; documented, not asserted as an RLS boundary", async () => {
    // There is no CHECK constraint or trigger preventing redemption of an
    // invite whose expires_at has passed -- expiry is enforced entirely by
    // isInviteExpired() in application code (see
    // tests/lib/private-coaching/invites.test.ts, already covered there).
    // Asserting a fake DB-level rejection here would misrepresent what
    // this schema actually does -- this test instead confirms the honest
    // fact: an "expired" invite is not, by itself, un-redeemable at the
    // database layer.
    const invite = await withCommittedServiceRole((c) =>
      c
        .query(
          `insert into public.coach_athlete_invites (coach_id, athlete_email, expires_at)
           values ($1, $2, now() - interval '1 day') returning id`,
          [IDS.coachA, `expired-${randomUUID()}@rls-test.invalid`],
        )
        .then((r) => r.rows[0]),
    );
    cleanupInviteIds.push(invite.id);

    const stillExists = await withCommittedServiceRole((c) =>
      c.query("select expires_at < now() as is_expired from public.coach_athlete_invites where id = $1", [invite.id]).then((r) => r.rows[0]),
    );
    expect(stillExists.is_expired).toBe(true);
    // No assertion that redemption is blocked -- it isn't, at this layer.
  });

  it("40. duplicate active relationship cannot be created", async () => {
    // coach_athletes_active_pair_idx -- a real unique index, not an app check.
    await expect(
      withCommittedServiceRole((c) =>
        c.query("insert into public.coach_athletes (coach_id, athlete_id, status) values ($1, $2, 'active')", [
          IDS.coachA,
          IDS.athleteA,
        ]),
      ),
    ).rejects.toThrow(/duplicate key value violates unique constraint/i);
  });

  it("41. duplicate live invite cannot be created", async () => {
    const email = `dup-${randomUUID()}@rls-test.invalid`;
    const first = await withCommittedServiceRole((c) =>
      c
        .query("insert into public.coach_athlete_invites (coach_id, athlete_email) values ($1, $2) returning id", [
          IDS.coachA,
          email,
        ])
        .then((r) => r.rows[0]),
    );
    cleanupInviteIds.push(first.id);

    await expect(
      withCommittedServiceRole((c) =>
        c.query("insert into public.coach_athlete_invites (coach_id, athlete_email) values ($1, $2)", [
          IDS.coachA,
          email,
        ]),
      ),
    ).rejects.toThrow(/duplicate key value violates unique constraint/i);
  });

  it("42. ended relationship can only be re-established through the service-role-mediated invite flow", async () => {
    // coach_athletes has ZERO insert policy for authenticated -- every
    // insert, re-establishment included, must go through service_role
    // (the trigger on signup, or the accept action). Neither the coach nor
    // the athlete can create the row directly, regardless of relationship
    // history.
    await expect(
      asUser(IDS.coachA, (c) =>
        c.query("insert into public.coach_athletes (coach_id, athlete_id, status) values ($1, $2, 'active')", [
          IDS.coachA,
          IDS.athleteC,
        ]),
      ),
    ).rejects.toThrow(/permission denied for table coach_athletes|row-level security/i);

    await expect(
      asUser(IDS.athleteC, (c) =>
        c.query("insert into public.coach_athletes (coach_id, athlete_id, status) values ($1, $2, 'active')", [
          IDS.coachA,
          IDS.athleteC,
        ]),
      ),
    ).rejects.toThrow(/permission denied for table coach_athletes|row-level security/i);
  });

  it("43. self-coaching: the DB no longer rejects coach_id = athlete_id -- app code is the sole enforcement point", async () => {
    // coach_athletes_not_self was dropped in the self-coach migration
    // (20260827120000) specifically so becomeSelfCoach (self-coach-actions.ts)
    // can insert this shape deliberately. Documented here in the same
    // "what's NOT a DB-level boundary" style as test 39: this is not itself
    // a security gap, because coach_athletes has zero authenticated insert
    // policy (test 42 above) -- only a service-role write can reach this
    // table at all, and inviteAthlete/acceptPrivateCoachInvite are the only
    // two application call sites capable of doing so with two INDEPENDENT
    // ids, both of which now explicitly reject coach_id === athlete_id
    // before ever reaching this insert (see roster/actions.ts and
    // coaching-invite/[token]/actions.ts). becomeSelfCoach is the only
    // caller that ever intends this shape.
    const rel = await withCommittedServiceRole((c) =>
      c
        .query("insert into public.coach_athletes (coach_id, athlete_id, status) values ($1, $1, 'active') returning id", [
          IDS.athleteC,
        ])
        .then((r) => r.rows[0]),
    );
    cleanupRelationshipIds.push(rel.id);
  });
});
