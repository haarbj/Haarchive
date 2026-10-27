import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Regression coverage for the real bug found while diagnosing the
// workout-explanation deep-dive (scope 3, Finding 2): the workout detail
// page's "No structured steps -- see the notes above" line rendered
// whenever a workout had no steps, regardless of whether notes_from_coach
// actually existed to point at -- a dangling reference for any typed
// workout authored with neither steps nor notes. Confirmed via a real
// QA session (see this task's report); the "Why this workout" card
// itself was confirmed NOT role-gated (an athlete viewing their own
// assigned workout already saw it before this fix), so that symptom
// did not reproduce and needed no code change.
//
// No React render harness exists in this repo -- source-scan assertions,
// same convention as privately-coached-gate-wiring.test.ts.

const ROOT = join(__dirname, "../../..");
const WORKOUT_PAGE = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/workouts/[workoutId]/page.tsx"), "utf8");
const GUIDE_PAGE = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/learn/[guide]/page.tsx"), "utf8");
const ATHLETE_EDUCATION = readFileSync(join(ROOT, "src/lib/private-coaching/athlete-education.ts"), "utf8");

describe("the dangling 'see the notes above' line never renders without real notes", () => {
  it("only shows the notes-pointing line when notes_from_coach exists, with a real fallback otherwise", () => {
    const noStepsIdx = WORKOUT_PAGE.indexOf("No structured steps");
    expect(noStepsIdx).toBeGreaterThan(-1);
    const nearby = WORKOUT_PAGE.slice(noStepsIdx - 200, noStepsIdx + 300);
    expect(nearby).toContain("workout.notes_from_coach ?");
    expect(WORKOUT_PAGE).toContain("No structured steps for this workout.");
  });
});

describe("the workout detail page surfaces a glossary example and a deep link to the full entry", () => {
  it("imports resolveGlossaryExample and renders it inside the Why this workout card", () => {
    expect(WORKOUT_PAGE).toContain("resolveGlossaryExample");
    const cardStart = WORKOUT_PAGE.indexOf("glossaryEntry && showEducation");
    expect(cardStart).toBeGreaterThan(-1);
    const cardBody = WORKOUT_PAGE.slice(cardStart, cardStart + 3000);
    expect(cardBody).toContain("glossaryEntry.example");
    expect(cardBody).toContain("resolveGlossaryExample(glossaryEntry.example, mostRecentRace)");
  });

  it("links to the specific glossary entry via its heading anchor, not just the general listing", () => {
    expect(WORKOUT_PAGE).toContain("headingId(glossaryEntry.name)");
    expect(WORKOUT_PAGE).toContain("/coaching/learn/workout-types#");
  });
});

describe("the browsable workout-types guide personalizes example splits to the viewing athlete", () => {
  it("getAthleteGuide passes a race through to buildWorkoutTypesContent for the workout-types slug", () => {
    expect(ATHLETE_EDUCATION).toMatch(/getAthleteGuide\(slug: string, race: AthleteMostRecentRace \| null/);
    expect(ATHLETE_EDUCATION).toContain('if (slug === "workout-types") return { ...guide, content: buildWorkoutTypesContent(race) };');
  });

  it("the guide page resolves the viewer's own most recent race before calling getAthleteGuide", () => {
    expect(GUIDE_PAGE).toContain("getAthleteMostRecentRace");
    const raceIdx = GUIDE_PAGE.indexOf("const race =");
    const getGuideIdx = GUIDE_PAGE.indexOf("getAthleteGuide(slug, race)");
    expect(raceIdx).toBeGreaterThan(-1);
    expect(getGuideIdx).toBeGreaterThan(raceIdx);
  });
});
