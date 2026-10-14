import { describe, expect, it } from "vitest";

import {
  getPhaseForWeek,
  weeksInPhase,
  weekPositionInPhase,
  phaseWeekCount,
  getPhaseTypeAccent,
  buildRoadmapSections,
  roadmapWeeks,
  type TrainingPhase,
} from "@/lib/private-coaching/training-phases";

function phase(overrides: Partial<TrainingPhase>): TrainingPhase {
  return {
    id: "p1",
    athleteId: "a1",
    phaseType: "Base",
    name: null,
    startDate: "2026-08-24",
    endDate: "2026-09-20",
    goalId: null,
    notes: null,
    explainer: null,
    sourceProgramId: null,
    sourceProgramPhaseDefinitionId: null,
    ...overrides,
  };
}

describe("weeksInPhase", () => {
  it("enumerates every Monday from start to end for a phase starting on a Monday", () => {
    expect(weeksInPhase(phase({ startDate: "2026-08-24", endDate: "2026-09-20" }))).toEqual([
      "2026-08-24",
      "2026-08-31",
      "2026-09-07",
      "2026-09-14",
    ]);
  });

  it("starts from the following Monday when the phase begins mid-week", () => {
    // Phase starts Wednesday 2026-08-26 -- the week containing it belongs
    // to whichever phase owns ITS Monday (Aug 24), not this phase, so the
    // first full week of this phase is the following Monday, Aug 31.
    expect(weeksInPhase(phase({ startDate: "2026-08-26", endDate: "2026-09-20" }))).toEqual([
      "2026-08-31",
      "2026-09-07",
      "2026-09-14",
    ]);
  });

  it("returns a single week for a phase spanning less than 7 days", () => {
    expect(weeksInPhase(phase({ startDate: "2026-08-24", endDate: "2026-08-27" }))).toEqual(["2026-08-24"]);
  });
});

describe("getPhaseForWeek", () => {
  const phases = [
    phase({ id: "base", phaseType: "Base", startDate: "2026-08-24", endDate: "2026-09-20" }),
    phase({ id: "build", phaseType: "Build", startDate: "2026-09-21", endDate: "2026-10-18" }),
  ];

  it("finds the phase whose range contains the week's Monday", () => {
    expect(getPhaseForWeek(phases, "2026-09-07")?.id).toBe("base");
    expect(getPhaseForWeek(phases, "2026-09-21")?.id).toBe("build");
  });

  it("is exact on the boundary Monday between two adjacent phases", () => {
    // Worked example from the plan: Phase A ends Sep 20, Phase B starts
    // Sep 21 -- the week beginning Sep 21 is Phase B in full, and the
    // preceding week (beginning Sep 14) is still entirely Phase A.
    expect(getPhaseForWeek(phases, "2026-09-14")?.id).toBe("base");
    expect(getPhaseForWeek(phases, "2026-09-21")?.id).toBe("build");
  });

  it("returns null for a week before any phase, after all phases, or with no phases at all", () => {
    expect(getPhaseForWeek(phases, "2026-08-17")).toBeNull();
    expect(getPhaseForWeek(phases, "2026-10-19")).toBeNull();
    expect(getPhaseForWeek([], "2026-09-07")).toBeNull();
  });
});

describe("weekPositionInPhase / phaseWeekCount", () => {
  const base = phase({ startDate: "2026-08-24", endDate: "2026-09-20" });

  it("returns the 1-indexed position and total week count", () => {
    expect(weekPositionInPhase(base, "2026-09-07")).toEqual({ week: 3, of: 4 });
    expect(phaseWeekCount(base)).toBe(4);
  });

  it("returns null for a week that isn't actually in the phase", () => {
    expect(weekPositionInPhase(base, "2026-10-05")).toBeNull();
  });
});

describe("getPhaseTypeAccent", () => {
  it("recognizes a suggested type case- and whitespace-insensitively", () => {
    expect(getPhaseTypeAccent("Base")).toBe("forest");
    expect(getPhaseTypeAccent("  build  ")).toBe("warning");
  });

  it("falls back to neutral for a custom/unrecognized type", () => {
    expect(getPhaseTypeAccent("Prep")).toBe("neutral");
  });
});

describe("buildRoadmapSections / roadmapWeeks", () => {
  const base = phase({ id: "base", phaseType: "Base", startDate: "2026-08-24", endDate: "2026-09-06" }); // 2 weeks
  const build = phase({ id: "build", phaseType: "Build", startDate: "2026-09-21", endDate: "2026-10-04" }); // 2 weeks, gap before it

  it("returns just the phase sections when phases are back-to-back with no gap", () => {
    const adjacent = phase({ id: "adjacent", phaseType: "Peak", startDate: "2026-09-07", endDate: "2026-09-20" });
    const sections = buildRoadmapSections([base, adjacent]);
    expect(sections).toEqual([
      { kind: "phase", phase: base },
      { kind: "phase", phase: adjacent },
    ]);
  });

  it("inserts an Unphased section for a real gap between two phases", () => {
    const sections = buildRoadmapSections([base, build]);
    expect(sections).toEqual([
      { kind: "phase", phase: base },
      { kind: "unphased", weeks: ["2026-09-07", "2026-09-14"] },
      { kind: "phase", phase: build },
    ]);
  });

  it("returns an empty list for no phases", () => {
    expect(buildRoadmapSections([])).toEqual([]);
  });

  it("roadmapWeeks flattens every phase's weeks and every gap's weeks in order", () => {
    expect(roadmapWeeks([base, build])).toEqual([
      "2026-08-24",
      "2026-08-31",
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
    ]);
  });
});
