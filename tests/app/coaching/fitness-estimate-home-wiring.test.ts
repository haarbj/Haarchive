import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Regression coverage for scope 4 (athlete-side deep-dive, Finding 3):
// the fitness estimate lived only on the coach's own /settings-style
// data without any athlete-facing home or coach-side value display.
// Diagnosis (see this task's report for the full trail): the real
// athlete-facing paces surface is "Your paces" on /coaching/your-plan
// (PaceSection in plan-payoff-view.tsx) -- /coaching/pace-zones exists
// but is scoped to admin-coached athletes only and was never the real
// general-purpose surface. The coach-side athlete detail page fetched
// athlete_fitness_estimates for an existence check only (hasFitnessAnchor),
// never rendering the actual value or linking anywhere.
//
// No React render harness exists in this repo -- source-scan assertions,
// same convention as privately-coached-gate-wiring.test.ts.

const ROOT = join(__dirname, "../../..");
const PLAN_PAYOFF_VIEW = readFileSync(join(ROOT, "src/components/private-coaching/plan-payoff-view.tsx"), "utf8");
const YOUR_PLAN_DATA = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/your-plan/data.ts"), "utf8");
const ATHLETE_DETAIL_PAGE = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/athletes/[athleteId]/page.tsx"), "utf8");
const FITNESS_ESTIMATES_SECTION = readFileSync(
  join(ROOT, "src/app/(app)/(protected)/settings/fitness-estimates-section.tsx"),
  "utf8",
);
const SETTINGS_ACTIONS = readFileSync(join(ROOT, "src/app/(app)/(protected)/settings/actions.ts"), "utf8");

describe("Your Paces surfaces a 'Your current fitness estimate' block at the top", () => {
  it("PaceSection renders FitnessEstimatesSection before the existing pace-rows list, inside an anchorable section", () => {
    expect(PLAN_PAYOFF_VIEW).toContain('<section id="your-paces">');
    const sectionStart = PLAN_PAYOFF_VIEW.indexOf('<section id="your-paces">');
    const blockIdx = PLAN_PAYOFF_VIEW.indexOf("Your current fitness estimate", sectionStart);
    const fitnessComponentIdx = PLAN_PAYOFF_VIEW.indexOf("<FitnessEstimatesSection", sectionStart);
    const existingRemedyIdx = PLAN_PAYOFF_VIEW.indexOf("data.hasFitnessAnchor", sectionStart);
    expect(blockIdx).toBeGreaterThan(sectionStart);
    expect(fitnessComponentIdx).toBeGreaterThan(blockIdx);
    expect(existingRemedyIdx).toBeGreaterThan(fitnessComponentIdx);
  });

  it("the block is read-only in coach-preview mode, never editable on the athlete's behalf", () => {
    const componentIdx = PLAN_PAYOFF_VIEW.indexOf("<FitnessEstimatesSection");
    const callSite = PLAN_PAYOFF_VIEW.slice(componentIdx, componentIdx + 300);
    expect(callSite).toContain("readOnly={isPreview}");
  });

  it("loadPlanPayoffData resolves both the raw estimate rows and a recompute-from-race suggestion, never a second formula", () => {
    expect(YOUR_PLAN_DATA).toContain("fitnessEstimateRows");
    expect(YOUR_PLAN_DATA).toContain("suggestFitnessEstimateFromRace(key, race)");
  });
});

describe("the athlete can change or recompute the estimate through the block's own controls", () => {
  it("FitnessEstimatesSection accepts suggestions and a readOnly flag, hiding Update/Clear when read-only", () => {
    expect(FITNESS_ESTIMATES_SECTION).toContain("suggestions?:");
    expect(FITNESS_ESTIMATES_SECTION).toContain("readOnly?:");
    expect(FITNESS_ESTIMATES_SECTION).toMatch(/\{!readOnly \?[\s\S]*?Update[\s\S]*?Clear/);
  });

  it("a suggestion offers a 'recompute from your race' control using the same stored value, not a separately-typed one", () => {
    expect(FITNESS_ESTIMATES_SECTION).toContain("Recompute from your most recent race");
    expect(FITNESS_ESTIMATES_SECTION).toContain("setTimeInput(formatClock(suggestion.timeS))");
  });

  it("the save/delete actions also revalidate Your Paces, not just Settings", () => {
    const updateFn = SETTINGS_ACTIONS.slice(
      SETTINGS_ACTIONS.indexOf("export async function updateFitnessEstimate"),
      SETTINGS_ACTIONS.indexOf("export async function deleteFitnessEstimate"),
    );
    expect(updateFn).toContain('revalidatePath("/coaching/your-plan")');
    const deleteFn = SETTINGS_ACTIONS.slice(SETTINGS_ACTIONS.indexOf("export async function deleteFitnessEstimate"));
    expect(deleteFn).toContain('revalidatePath("/coaching/your-plan")');
  });
});

describe("the coach-side athlete card shows the real value and deep-links to Your Paces", () => {
  it("fetches the real estimate values (not just an existence check) via the shared getAthleteFitnessEstimates", () => {
    expect(ATHLETE_DETAIL_PAGE).toContain("getAthleteFitnessEstimates(supabase, athleteId)");
    expect(ATHLETE_DETAIL_PAGE).not.toContain('.from("athlete_fitness_estimates")\n        .select("reference_key")');
  });

  it("links to the athlete's own Your Paces block via the your-plan-preview anchor", () => {
    expect(ATHLETE_DETAIL_PAGE).toContain("/your-plan-preview#your-paces");
  });

  it("shows an honest empty state, never a fabricated number, when no estimate is on file", () => {
    expect(ATHLETE_DETAIL_PAGE).toContain("No fitness estimate on file yet.");
  });
});
