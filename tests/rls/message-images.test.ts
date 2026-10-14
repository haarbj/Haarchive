import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asAnon, asUser, closePool, withCommittedServiceRole } from "./db-client";
import { IDS } from "./fixtures";

// message_images_select_participant (20260826030000) is this project's
// first-ever storage.objects RLS policy -- no existing test precedent to
// follow, so this is a small, self-contained matrix rather than an
// extension of an existing file. Objects are inserted directly (as
// service_role would after a real upload, not through the Storage API,
// which this harness has no stand-in for -- see tests/rls/README.md's own
// "what this deliberately does not do").
const objectAA = { id: "00000000-0000-4000-8000-0000000070a1", path: `${IDS.coachAthleteRelAA}/photo.jpg` };
const objectBB = { id: "00000000-0000-4000-8000-0000000070b1", path: `${IDS.coachAthleteRelBB}/photo.jpg` };

beforeAll(async () => {
  await withCommittedServiceRole(async (c) => {
    await c.query("insert into storage.objects (id, bucket_id, name) values ($1, 'message-images', $2)", [
      objectAA.id,
      objectAA.path,
    ]);
    await c.query("insert into storage.objects (id, bucket_id, name) values ($1, 'message-images', $2)", [
      objectBB.id,
      objectBB.path,
    ]);
  });
});

afterAll(async () => {
  await withCommittedServiceRole((c) =>
    c.query("delete from storage.objects where id = any($1)", [[objectAA.id, objectBB.id]]),
  );
  await closePool();
});

describe("message-images storage.objects RLS", () => {
  it("Coach A (a participant of the AA relationship) can read the AA thread's image", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from storage.objects where id = $1", [objectAA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("Athlete A (the other participant of the AA relationship) can read the same image", async () => {
    const rows = await asUser(IDS.athleteA, (c) =>
      c.query("select id from storage.objects where id = $1", [objectAA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
  });

  it("Coach A cannot read the BB thread's image -- not a participant of that relationship", async () => {
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select id from storage.objects where id = $1", [objectBB.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("Athlete C (unrelated to any relationship) cannot read either image", async () => {
    const rows = await asUser(IDS.athleteC, (c) =>
      c
        .query("select id from storage.objects where id = any($1)", [[objectAA.id, objectBB.id]])
        .then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("an unauthenticated (anon) request cannot read the image -- no auth.uid() at all to match against", async () => {
    const rows = await asAnon((c) =>
      c.query("select id from storage.objects where id = $1", [objectAA.id]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });
});
