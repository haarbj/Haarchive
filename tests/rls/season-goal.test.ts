import { afterAll, describe, expect, it } from "vitest";

import { asUser, closePool } from "./db-client";
import { IDS } from "./fixtures";

// season_goal is a plain column on athlete_profiles -- these tests exist
// to confirm the migration's own claim (no new RLS needed) rather than
// to add any new policy. Every row here exercises the existing,
// column-agnostic athlete_profiles_select_own/_update_own and
// athlete_profiles_select_private_coach policies, which already cover
// this column with zero changes.

afterAll(closePool);

describe("season_goal on athlete_profiles -- existing RLS, no new policy", () => {
  it("an athlete can write their own season goal", async () => {
    const result = await asUser(IDS.athleteA, (c) =>
      c.query(
        `insert into public.athlete_profiles (user_id, season_goal) values ($1, $2)
         on conflict (user_id) do update set season_goal = excluded.season_goal`,
        [IDS.athleteA, "Qualify for Boston and get there healthy enough to enjoy it."],
      ),
    );
    expect(result.rowCount).toBe(1);
  });

  it("an athlete can read their own season goal back", async () => {
    await asUser(IDS.athleteA, (c) =>
      c.query(
        `insert into public.athlete_profiles (user_id, season_goal) values ($1, $2)
         on conflict (user_id) do update set season_goal = excluded.season_goal`,
        [IDS.athleteA, "Break 3:30 and finally enjoy a long run."],
      ),
    );
    const rows = await asUser(IDS.athleteA, (c) =>
      c.query("select season_goal from public.athlete_profiles where user_id = $1", [IDS.athleteA]).then((r) => r.rows),
    );
    expect(rows[0]?.season_goal).toBe("Break 3:30 and finally enjoy a long run.");
  });

  it("athlete A's own active coach (coach A) can read it", async () => {
    await asUser(IDS.athleteA, (c) =>
      c.query(
        `insert into public.athlete_profiles (user_id, season_goal) values ($1, $2)
         on conflict (user_id) do update set season_goal = excluded.season_goal`,
        [IDS.athleteA, "Stay healthy through the whole buildup."],
      ),
    );
    const rows = await asUser(IDS.coachA, (c) =>
      c.query("select season_goal from public.athlete_profiles where user_id = $1", [IDS.athleteA]).then((r) => r.rows),
    );
    expect(rows[0]?.season_goal).toBe("Stay healthy through the whole buildup.");
  });

  it("coach A has no UPDATE policy on athlete_profiles -- cannot write athlete A's season goal", async () => {
    const result = await asUser(IDS.coachA, (c) =>
      c.query("update public.athlete_profiles set season_goal = 'Coach wrote this' where user_id = $1", [IDS.athleteA]),
    );
    expect(result.rowCount).toBe(0);
  });

  it("a coach who doesn't coach this athlete (coach B) reads nothing -- not even a null row", async () => {
    const rows = await asUser(IDS.coachB, (c) =>
      c.query("select season_goal from public.athlete_profiles where user_id = $1", [IDS.athleteA]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("athlete B (an unrelated athlete) also reads nothing of athlete A's season goal", async () => {
    const rows = await asUser(IDS.athleteB, (c) =>
      c.query("select season_goal from public.athlete_profiles where user_id = $1", [IDS.athleteA]).then((r) => r.rows),
    );
    expect(rows).toHaveLength(0);
  });

  it("the migration's own 500-character check constraint rejects a longer value even as the athlete themselves", async () => {
    await expect(
      asUser(IDS.athleteA, (c) =>
        c.query(
          `insert into public.athlete_profiles (user_id, season_goal) values ($1, $2)
           on conflict (user_id) do update set season_goal = excluded.season_goal`,
          [IDS.athleteA, "x".repeat(501)],
        ),
      ),
    ).rejects.toThrow(/check constraint/i);
  });
});
