import { describe, expect, it } from "vitest";

import { createScriptedSupabaseClient } from "../../app/supabase-test-utils";
import { getActiveCoachRelationship } from "@/lib/private-coaching/athlete-coach";

// Regression coverage for the athlete-coach-visibility bug: an athlete can
// have TWO simultaneous active coach_athletes rows -- a self-coach row
// (coach_id = athlete_id, from becomeSelfCoach) and a real coach's row
// (from accepting an invite) -- and nothing in the schema dedupes that
// (coach_athletes_active_pair_idx only prevents a duplicate of the SAME
// pair). Every "who is my coach" read site used to do an unordered
// `.limit(1).maybeSingle()`, which could return either row with no
// guaranteed preference, and previously kept surfacing the self-coach row
// even after a real invite was accepted ("You're coaching yourself" never
// went away). getActiveCoachRelationship is the fix: it must always
// prefer a genuine non-self coach row over a self-coach row, regardless
// of which order the database happens to return them in.

const ATHLETE_ID = "athlete-1";
const COACH_ID = "coach-1";

describe("getActiveCoachRelationship", () => {
  it("returns the real coach when only a real-coach row exists", () => {
    const { client } = createScriptedSupabaseClient(
      [{ table: "coach_athletes", result: { data: [{ coach_id: COACH_ID }], error: null } }],
      ATHLETE_ID,
    );
    return getActiveCoachRelationship(client as never, ATHLETE_ID).then((result) => {
      expect(result).toEqual({ coachId: COACH_ID, isSelfCoached: false });
    });
  });

  it("prefers the real coach over a self-coach row when the self-coach row is returned FIRST", () => {
    const { client } = createScriptedSupabaseClient(
      [
        {
          table: "coach_athletes",
          result: {
            data: [{ coach_id: ATHLETE_ID }, { coach_id: COACH_ID }],
            error: null,
          },
        },
      ],
      ATHLETE_ID,
    );
    return getActiveCoachRelationship(client as never, ATHLETE_ID).then((result) => {
      expect(result).toEqual({ coachId: COACH_ID, isSelfCoached: false });
    });
  });

  it("prefers the real coach over a self-coach row when the self-coach row is returned LAST", () => {
    const { client } = createScriptedSupabaseClient(
      [
        {
          table: "coach_athletes",
          result: {
            data: [{ coach_id: COACH_ID }, { coach_id: ATHLETE_ID }],
            error: null,
          },
        },
      ],
      ATHLETE_ID,
    );
    return getActiveCoachRelationship(client as never, ATHLETE_ID).then((result) => {
      expect(result).toEqual({ coachId: COACH_ID, isSelfCoached: false });
    });
  });

  it("falls back to the self-coach row (isSelfCoached: true) when no real coach exists", () => {
    const { client } = createScriptedSupabaseClient(
      [{ table: "coach_athletes", result: { data: [{ coach_id: ATHLETE_ID }], error: null } }],
      ATHLETE_ID,
    );
    return getActiveCoachRelationship(client as never, ATHLETE_ID).then((result) => {
      expect(result).toEqual({ coachId: ATHLETE_ID, isSelfCoached: true });
    });
  });

  it("returns null when the athlete has no active coach_athletes row at all", () => {
    const { client } = createScriptedSupabaseClient([{ table: "coach_athletes", result: { data: [], error: null } }], ATHLETE_ID);
    return getActiveCoachRelationship(client as never, ATHLETE_ID).then((result) => {
      expect(result).toBeNull();
    });
  });

  it("returns null when the query itself returns no rows (null data)", () => {
    const { client } = createScriptedSupabaseClient([{ table: "coach_athletes", result: { data: null, error: null } }], ATHLETE_ID);
    return getActiveCoachRelationship(client as never, ATHLETE_ID).then((result) => {
      expect(result).toBeNull();
    });
  });
});
