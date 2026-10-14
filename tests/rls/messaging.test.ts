import { afterAll, describe, expect, it } from "vitest";

import { asUser, closePool } from "./db-client";
import { IDS } from "./fixtures";

afterAll(closePool);

describe("Messaging (adversarial matrix items 18-26)", () => {
  it("18. Coach A can send a message to Athlete A", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c
        .query(
          `insert into public.coach_athlete_messages (coach_athlete_id, sender_id, body)
           values ($1, $2, 'New message') returning id`,
          [IDS.coachAthleteRelAA, IDS.coachA],
        )
        .then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("19. Athlete A can send a message to Coach A", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c
        .query(
          `insert into public.coach_athlete_messages (coach_athlete_id, sender_id, body)
           values ($1, $2, 'New reply') returning id`,
          [IDS.coachAthleteRelAA, IDS.athleteA],
        )
        .then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("20. Coach A cannot send a message into Coach B <-> Athlete B's thread", async () => {
    await expect(
      asUser(IDS.coachA, (c) =>
        c.query(
          `insert into public.coach_athlete_messages (coach_athlete_id, sender_id, body)
           values ($1, $2, 'Intruding')`,
          [IDS.coachAthleteRelBB, IDS.coachA],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("21. Athlete A cannot send a message into another relationship's thread", async () => {
    await expect(
      asUser(IDS.athleteA, (c) =>
        c.query(
          `insert into public.coach_athlete_messages (coach_athlete_id, sender_id, body)
           values ($1, $2, 'Intruding')`,
          [IDS.coachAthleteRelBB, IDS.athleteA],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("22. Athlete A can update read_at on an authorized message (messageAA, sent by Coach A)", async () => {
    const result = await asUser(IDS.athleteA, (c) =>
      c.query("update public.coach_athlete_messages set read_at = now() where id = $1", [IDS.messageAA]),
    );
    expect(result.rowCount).toBe(1);
  });

  it("23. Athlete A cannot update body (BLOCKER 2 regression -- column-level privilege)", async () => {
    await expect(
      asUser(IDS.athleteA, (c) =>
        c.query("update public.coach_athlete_messages set body = 'hacked' where id = $1", [IDS.messageAA]),
      ),
    ).rejects.toThrow(/permission denied for table coach_athlete_messages/i);
  });

  it("24. Athlete A cannot update coach_athlete_id (BLOCKER 2 regression -- column-level privilege)", async () => {
    await expect(
      asUser(IDS.athleteA, (c) =>
        c.query("update public.coach_athlete_messages set coach_athlete_id = $2 where id = $1", [
          IDS.messageAA,
          IDS.coachAthleteRelBB,
        ]),
      ),
    ).rejects.toThrow(/permission denied for table coach_athlete_messages/i);
  });

  it("25. Coach A cannot modify Athlete A's message body (messageFromAthleteA, sent by the athlete)", async () => {
    await expect(
      asUser(IDS.coachA, (c) =>
        c.query("update public.coach_athlete_messages set body = 'rewritten' where id = $1", [
          IDS.messageFromAthleteA,
        ]),
      ),
    ).rejects.toThrow(/permission denied for table coach_athlete_messages/i);
  });

  it("26. A participant cannot modify a message after changing its relationship to an unrelated thread", async () => {
    // The literal BLOCKER 2 exploit path: recipient tries to reassign
    // coach_athlete_id to inject the message into an unrelated
    // conversation. Rejected at the column-privilege level before RLS's
    // row-level with-check is even reached.
    await expect(
      asUser(IDS.athleteA, (c) =>
        c.query("update public.coach_athlete_messages set coach_athlete_id = $2, body = 'injected' where id = $1", [
          IDS.messageAA,
          IDS.coachAthleteRelBB,
        ]),
      ),
    ).rejects.toThrow(/permission denied for table coach_athlete_messages/i);

    // Confirm the target thread was genuinely untouched, not just that the
    // statement errored.
    const bThreadMessages = await asUser(IDS.coachB, (c) =>
      c.query("select id from public.coach_athlete_messages where coach_athlete_id = $1", [IDS.coachAthleteRelBB]).then((r) => r.rows),
    );
    expect(bThreadMessages.map((r) => r.id)).toEqual([IDS.messageBB]);
  });
});
