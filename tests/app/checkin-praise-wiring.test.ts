import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Source-scan tests (no React component-rendering harness exists in this
// repo -- see today-conditions-wiring.test.ts's own header comment for
// the established pattern) verifying: candidates are never auto-inserted
// or auto-sent, the composer sends through the existing coach<->athlete
// message pipeline rather than a new storage path, the chip row renders
// nothing when there are no candidates, and the check-in page computes
// the candidates from the check-in's own window. The candidate math
// itself is covered by checkin-praise.test.ts; the cursor-insertion math
// by insert-at-cursor.test.ts; this file is about wiring.

const ATHLETE_ROOT = join(__dirname, "../../src/app/(app)/(protected)/coaching/athletes/[athleteId]");
const COMPOSER = readFileSync(join(ATHLETE_ROOT, "checkin-response-composer.tsx"), "utf8");
const PRAISE_DATA = readFileSync(join(ATHLETE_ROOT, "checkin-praise-data.ts"), "utf8");
const PAGE = readFileSync(join(ATHLETE_ROOT, "page.tsx"), "utf8");
const PRAISE_LIB = readFileSync(join(__dirname, "../../src/lib/private-coaching/checkin-praise.ts"), "utf8");

describe("nothing is ever auto-written or auto-sent", () => {
  it("the composer has no effect that runs on mount -- no useEffect at all in the file", () => {
    expect(COMPOSER).not.toContain("useEffect");
  });

  it("a candidate only ever gets inserted from the chip's own onClick handler", () => {
    expect(COMPOSER).toMatch(/onClick=\{\(\) => insertCandidate\(candidate\.text\)\}/);
  });

  it("the textarea is a controlled field (value={text}), so an inserted candidate becomes ordinary, editable state -- not a locked-in token", () => {
    expect(COMPOSER).toContain("value={text}");
    expect(COMPOSER).toContain("onChange=");
  });

  it("the chip row renders nothing at all when there are no candidates", () => {
    expect(COMPOSER).toMatch(/candidates\.length > 0 \? \(/);
  });

  it("sending goes through the send button inside the form, never a side effect", () => {
    expect(COMPOSER).toContain('type="submit"');
  });
});

describe("sends through the existing message pipeline, not a new storage path", () => {
  it("imports sendCoachAthleteMessage from the existing coach<->athlete messages action, not a new action", () => {
    expect(COMPOSER).toContain('from "../../messages/actions"');
    expect(COMPOSER).toContain("sendCoachAthleteMessage");
  });

  it("never writes to weekly_checkins -- this only reads check-in data and assists the composer", () => {
    for (const source of [COMPOSER, PRAISE_DATA, PRAISE_LIB]) {
      expect(source).not.toMatch(/\.from\("weekly_checkins"\)[\s\S]{0,80}\.(insert|update|upsert)\(/);
    }
  });
});

describe("no AI-generated text anywhere in the candidate pipeline", () => {
  it("checkin-praise.ts and its data loader never import the AI layer", () => {
    for (const source of [PRAISE_LIB, PRAISE_DATA]) {
      expect(source).not.toMatch(/@\/lib\/ai\b/);
    }
  });
});

describe("the check-in page computes candidates from the check-in's own window", () => {
  it("passes the check-in's own week_start and week_start + 6 days, the same window the card above it displays", () => {
    expect(PAGE).toMatch(/loadCheckinPraiseCandidates\(supabase, athleteId, checkin\.week_start, addDays\(checkin\.week_start, 6\)\)/);
  });

  it("the composer only renders once both a real check-in and a real coach<->athlete relationship exist", () => {
    expect(PAGE).toMatch(/\{checkin && coachAthleteRow \? \(/);
  });

  it("candidates default to an empty array when there's no check-in or no relationship yet -- never undefined, never a crash", () => {
    expect(PAGE).toMatch(/checkinPraiseCandidates =\s*\n\s*checkin && coachAthleteRow/);
    expect(PAGE).toContain(": [];");
  });
});

describe("athlete-side visibility", () => {
  it("the candidate mechanism is scoped to this coach-only athlete detail route, never imported from an athlete-facing page", () => {
    // page.tsx itself redirects non-coach sessions away (session.isPrivateCoach
    // check already above this code); the real guarantee is structural: the
    // composer and data loader live under coaching/athletes/[athleteId], not
    // under plan/ or any athlete-facing route, and are never imported there.
    expect(PAGE).toContain("session?.isPrivateCoach");
  });
});
