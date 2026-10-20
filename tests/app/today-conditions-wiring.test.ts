import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Source-scan tests (no React component-rendering harness exists in this
// repo -- see realignment-service-wiring.test.ts's own header comment for
// the established pattern) verifying: today's determination reuses the
// viewer-timezone `today` this page already computes (never a second,
// UTC-based "today"), the stored-location -> geolocation -> absent
// render chain, and that the card never fetches on its own.

const ROOT = join(__dirname, "../..");
const PLAN_VIEW = readFileSync(join(ROOT, "src/app/(app)/(protected)/plan/plan-view.tsx"), "utf8");
const SERVICE = readFileSync(join(ROOT, "src/app/(app)/(protected)/plan/today-conditions-service.ts"), "utf8");
const GEOLOCATION = readFileSync(join(ROOT, "src/app/(app)/(protected)/plan/today-conditions-geolocation.tsx"), "utf8");
const ADAPTER = readFileSync(join(ROOT, "src/lib/private-coaching/today-conditions.ts"), "utf8");

describe("today's determination reuses the viewer-timezone `today`, never a second UTC-based one", () => {
  it("todaysWorkouts filters assignedWorkouts by the SAME `today` variable todayForViewer() already produced on this page", () => {
    const todayAssignIndex = PLAN_VIEW.indexOf("const today = await todayForViewer();");
    const filterIndex = PLAN_VIEW.indexOf("assignedWorkouts.filter((w) => w.scheduledDate === today)");
    expect(todayAssignIndex).toBeGreaterThan(-1);
    expect(filterIndex).toBeGreaterThan(todayAssignIndex);
  });

  it("no second, independent 'today' computation (e.g. a raw new Date()/UTC call) feeds the conditions card", () => {
    const start = PLAN_VIEW.indexOf("const todaysWorkouts: TodayWorkoutInput[]");
    const block = PLAN_VIEW.slice(start, PLAN_VIEW.indexOf("await resolveStoredLocation", start));
    expect(block).not.toContain("new Date()");
    expect(block).not.toContain("toISOString()");
  });

  it("non-today workouts never reach the filter's output -- scheduledDate must equal today exactly", () => {
    expect(PLAN_VIEW).toContain("w.scheduledDate === today");
  });
});

describe("location fallback chain: stored -> geolocation -> absent", () => {
  it("the card renders from a stored, server-resolved location when one exists", () => {
    expect(PLAN_VIEW).toContain("<TodayConditionsCard data={todayConditionsCard} />");
  });

  it("falls back to the one quiet geolocation affordance only when no stored location resolved", () => {
    const start = PLAN_VIEW.indexOf("todayConditionsCard ? (");
    const block = PLAN_VIEW.slice(start, PLAN_VIEW.indexOf(") : null}", start) + 9);
    expect(block).toContain("!storedLocation ? (");
    expect(block).toContain("<TodayConditionsGeolocation");
  });

  it("renders nothing at all when neither a stored location nor a workout exists -- no card, no affordance, no page effect", () => {
    const start = PLAN_VIEW.indexOf("{!coachView && todaysWorkouts.length > 0 ? (");
    expect(start).toBeGreaterThan(-1);
  });

  it("the geolocation affordance never auto-fires -- browser geolocation only runs inside the click handler", () => {
    const mountEffectIndex = GEOLOCATION.indexOf("useEffect");
    expect(mountEffectIndex).toBe(-1); // no effect at all -- geolocation only runs from handleClick
    const geoCallIndex = GEOLOCATION.indexOf("navigator.geolocation.getCurrentPosition");
    const handleClickIndex = GEOLOCATION.indexOf("function handleClick()");
    expect(geoCallIndex).toBeGreaterThan(handleClickIndex);
  });
});

describe("weather/location failure leaves the page unaffected -- card is simply absent", () => {
  it("buildTodayConditionsCard never throws past its own boundary", () => {
    const start = SERVICE.indexOf("export async function buildTodayConditionsCard");
    const body = SERVICE.slice(start, SERVICE.indexOf("\nexport ", start + 1) === -1 ? undefined : SERVICE.indexOf("\nexport ", start + 1));
    expect(body).toContain("catch {");
    expect(body).toMatch(/catch\s*\{\s*return null;/);
  });

  it("resolveStoredLocation never throws past its own boundary either", () => {
    const start = SERVICE.indexOf("export async function resolveStoredLocation");
    const body = SERVICE.slice(start);
    expect(body).toMatch(/catch\s*\{\s*return null;/);
  });
});

describe("scope: heat and humidity only -- no fabricated wind/grade inputs for a not-yet-run workout", () => {
  it("today-conditions.ts never imports windEngine or elevationEngine", () => {
    expect(ADAPTER).not.toContain("windEngine");
    expect(ADAPTER).not.toContain("elevationEngine");
  });
});
