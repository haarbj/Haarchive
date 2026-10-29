import { describe, expect, it } from "vitest";

import { buildPhaseStrip } from "@/app/(app)/(protected)/coaching/your-plan/data";
import type { TrainingPhase } from "@/lib/private-coaching/training-phases";

// Athlete-side deep-dive Finding 4: the "Your program" card on Your Plan
// said "No training phases are set up yet" for an athlete who in fact
// had a 4-week General phase scheduled to start a few days later. The
// root cause wasn't a date filter on an "active" phase -- it was that
// the card only ever rendered Program-sourced phases (phaseStrip used to
// be built from `programPhases`, a strict sourceProgramId match), so a
// freehand phase (added directly via "+ Add phase" on the schedule page,
// never generated from a Program template -- confirmed in
// src/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/actions.ts's
// savePhase, which never sets source_program_id) never had anywhere to
// show up at all, regardless of whether it was current or still to come.
// buildPhaseStrip is the extracted, pure phase-selection logic (data.ts's
// loadPlanPayoffData just calls it) -- these tests exercise it directly,
// the same way your-plan-pace-rows.test.ts does for buildPaceRowsFromWorkouts.

function phase(overrides: Partial<TrainingPhase> = {}): TrainingPhase {
  return {
    id: "phase-1",
    athleteId: "athlete-1",
    phaseType: "General",
    name: null,
    startDate: "2026-10-26",
    endDate: "2026-11-22",
    goalId: null,
    notes: null,
    explainer: null,
    sourceProgramId: null,
    sourceProgramPhaseDefinitionId: null,
    ...overrides,
  };
}

describe("buildPhaseStrip", () => {
  it("includes a freehand (non-Program) phase that hasn't started yet, flagged as upcoming -- the exact Finding 4 scenario", () => {
    const futurePhase = phase({ id: "future", startDate: "2026-10-26", endDate: "2026-11-22" });
    const strip = buildPhaseStrip([futurePhase], null, "2026-10-22");

    expect(strip).toHaveLength(1);
    expect(strip[0].id).toBe("future");
    expect(strip[0].isUpcoming).toBe(true);
    expect(strip[0].isCurrent).toBe(false);
    expect(strip[0].startDate).toBe("2026-10-26");
  });

  it("includes a freehand phase that's already active, flagged as current when it is the resolved current phase", () => {
    const activePhase = phase({ id: "active", startDate: "2026-10-12", endDate: "2026-11-08" });
    const strip = buildPhaseStrip([activePhase], activePhase, "2026-10-22");

    expect(strip).toHaveLength(1);
    expect(strip[0].isCurrent).toBe(true);
    expect(strip[0].isUpcoming).toBe(false);
  });

  it("excludes a fully completed phase with nothing current or upcoming", () => {
    const pastPhase = phase({ id: "past", startDate: "2026-08-01", endDate: "2026-08-28" });
    const strip = buildPhaseStrip([pastPhase], null, "2026-10-22");

    expect(strip).toHaveLength(0);
  });

  it("returns an empty strip when the athlete genuinely has no phases -- the one real empty-state trigger", () => {
    const strip = buildPhaseStrip([], null, "2026-10-22");
    expect(strip).toHaveLength(0);
  });

  it("shows both an active phase and a later upcoming phase together", () => {
    const activePhase = phase({ id: "active", startDate: "2026-10-12", endDate: "2026-10-25" });
    const futurePhase = phase({ id: "future", startDate: "2026-10-26", endDate: "2026-11-22" });
    const strip = buildPhaseStrip([activePhase, futurePhase], activePhase, "2026-10-22");

    expect(strip.map((p) => p.id)).toEqual(["active", "future"]);
    expect(strip.find((p) => p.id === "active")?.isCurrent).toBe(true);
    expect(strip.find((p) => p.id === "future")?.isUpcoming).toBe(true);
  });

  it("a Program-sourced phase behaves identically to a freehand one here -- sourceProgramId never gates inclusion", () => {
    const programPhase = phase({ id: "prog", sourceProgramId: "program-1", startDate: "2026-10-26", endDate: "2026-11-22" });
    const strip = buildPhaseStrip([programPhase], null, "2026-10-22");

    expect(strip).toHaveLength(1);
    expect(strip[0].isUpcoming).toBe(true);
  });
});
