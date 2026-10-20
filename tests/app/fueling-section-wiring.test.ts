import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Source-scan tests (no React component-rendering harness exists in this
// repo -- see realignment-service-wiring.test.ts's own header comment for
// the established pattern) verifying both the athlete and the coach
// render the identical fueling card from the same single adapter call,
// and that the card is computed at read time, never stored.

const ROOT = join(__dirname, "../..");
const PAGE = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/workouts/[workoutId]/page.tsx"), "utf8");
const SECTION = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/workouts/[workoutId]/fueling-section.tsx"), "utf8");
const ADAPTER = readFileSync(join(ROOT, "src/lib/private-coaching/workout-fueling.ts"), "utf8");

describe("both the athlete and the coach render the identical fueling card from one adapter call", () => {
  it("page.tsx calls buildWorkoutFuelingCard exactly once -- never a per-role branch", () => {
    const calls = PAGE.match(/buildWorkoutFuelingCard\(/g) ?? [];
    expect(calls).toHaveLength(1);
  });

  it("the one call is never conditioned on isCoach/viewerIsAthlete", () => {
    const start = PAGE.indexOf("const fuelingCard = buildWorkoutFuelingCard(");
    expect(start).toBeGreaterThan(-1);
    const block = PAGE.slice(start, PAGE.indexOf("});", start) + 3);
    expect(block).not.toContain("isCoach");
    expect(block).not.toContain("viewerIsAthlete");
    expect(block).not.toContain("effectiveIsCoach");
  });

  it("FuelingSection itself renders nothing role-specific -- no isCoach/viewerIsAthlete prop or branch at all", () => {
    expect(SECTION).not.toContain("isCoach");
    expect(SECTION).not.toContain("viewerIsAthlete");
  });

  it("<FuelingSection> is rendered unconditionally on fuelingCard alone, not gated by role", () => {
    const start = PAGE.indexOf("{fuelingCard ?");
    expect(start).toBeGreaterThan(-1);
    const line = PAGE.slice(start, PAGE.indexOf("\n", start));
    expect(line).toBe("{fuelingCard ? <FuelingSection card={fuelingCard} /> : null}");
  });
});

describe("the fueling card is computed at read time, never stored", () => {
  it("workout-fueling.ts never imports a Supabase client or writes anything", () => {
    expect(ADAPTER).not.toContain("createClient");
    expect(ADAPTER).not.toContain("createServiceRoleClient");
    expect(ADAPTER).not.toMatch(/\.from\(/);
    expect(ADAPTER).not.toContain("supabase");
  });

  it("page.tsx feeds the adapter the workout's own currently-resolved fields, not a cached/stored value", () => {
    const start = PAGE.indexOf("const fuelingCard = buildWorkoutFuelingCard(");
    const block = PAGE.slice(start, PAGE.indexOf("});", start) + 3);
    expect(block).toContain("effectiveVolume.distanceM");
    expect(block).toContain("effectiveVolume.durationS");
    expect(block).not.toContain("fueling_plan");
    expect(block).not.toContain("conditions_analysis");
  });
});

describe("eligibility lives in exactly one place", () => {
  it("isWorkoutFuelingEligible is the only duration-threshold check, and nothing else duplicates it", () => {
    expect(ADAPTER.match(/FUELING_DURATION_THRESHOLD_MINUTES/g)?.length).toBeGreaterThanOrEqual(1);
    expect(PAGE).not.toMatch(/75/);
  });
});
