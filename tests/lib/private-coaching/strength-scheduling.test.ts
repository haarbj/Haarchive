import { describe, expect, it } from "vitest";

import {
  DEFAULT_STRENGTH_SELECTIONS,
  plyometricsEligibility,
  scheduleStrengthTraining,
  type StrengthGatingInput,
  type StrengthSelections,
} from "@/lib/private-coaching/strength-scheduling";
import type { ResolvedProgramDay, ResolvedProgramPhase } from "@/lib/private-coaching/program-generation";

function day(overrides: Partial<ResolvedProgramDay> & { sourceProgramDayId: string; scheduledDate: string }): ResolvedProgramDay {
  return {
    dayLabel: null,
    sessionSlot: null,
    isOptional: false,
    alternativeText: null,
    plannedDistanceM: null,
    plannedDistanceMaxM: null,
    plannedDurationS: null,
    plannedDurationMaxS: null,
    plannedPaceSPerMi: null,
    plannedPaceMaxSPerMi: null,
    paceReference: null,
    pacePercentBasis: null,
    pacePercentMin: null,
    pacePercentMax: null,
    plannedHrBpm: null,
    plannedHrMaxBpm: null,
    plannedRpe: null,
    plannedRpeMax: null,
    notes: null,
    steps: [],
    extras: [],
    ...overrides,
  };
}

function phase(overrides: Partial<ResolvedProgramPhase> & { phaseDefinitionId: string; startDate: string; endDate: string }): ResolvedProgramPhase {
  return {
    phaseKey: "General",
    name: null,
    explainer: null,
    ...overrides,
  };
}

const gatingClear: StrengthGatingInput = { injuryProne: false, reboundingFromSetback: false, experiencedAthlete: true };

// 2026-01-05 is a real Monday; a 10-week block gives plyometrics' 8-week
// floor plenty of room without complicating the per-test setup.
const TEN_WEEK_PHASE = phase({ phaseDefinitionId: "p1", phaseKey: "General", startDate: "2026-01-05", endDate: "2026-03-15" });

function weekOf(mondayIso: string, labels: (string | null)[]): ResolvedProgramDay[] {
  return labels.map((label, i) => {
    const d = new Date(`${mondayIso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return day({ sourceProgramDayId: `${mondayIso}-${i}`, scheduledDate: d.toISOString().slice(0, 10), dayLabel: label, plannedDistanceM: label ? 8000 : null });
  });
}

describe("plyometricsEligibility", () => {
  it("is eligible for a healthy, experienced athlete in a long-enough buildup", () => {
    const result = plyometricsEligibility({ ...gatingClear, totalWeeks: 10 });
    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("is never eligible for an injury-prone athlete, regardless of anything else", () => {
    const result = plyometricsEligibility({ injuryProne: true, reboundingFromSetback: false, experiencedAthlete: true, totalWeeks: 20 });
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/injury-prone/);
  });

  it("is never eligible when rebounding from a setback", () => {
    const result = plyometricsEligibility({ injuryProne: false, reboundingFromSetback: true, experiencedAthlete: true, totalWeeks: 20 });
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/rebounding from a setback/);
  });

  it("requires an experienced athlete", () => {
    const result = plyometricsEligibility({ injuryProne: false, reboundingFromSetback: false, experiencedAthlete: false, totalWeeks: 20 });
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/healthy, experienced/);
  });

  it("requires at least eight weeks in the buildup", () => {
    const result = plyometricsEligibility({ ...gatingClear, totalWeeks: 5 });
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/eight weeks/);
  });
});

describe("scheduleStrengthTraining", () => {
  it("never touches a day that isn't an easy run, regardless of which options are selected", () => {
    const days = weekOf("2026-01-05", ["Long Run", "Threshold", "Easy", "Intervals", "Easy", null, "Easy"]);
    const selections: StrengthSelections = { foundation: true, heavyLifting: true, plyometrics: true, hillSprints: true };
    const { days: result } = scheduleStrengthTraining(days, [TEN_WEEK_PHASE], selections, gatingClear);

    const nonEasy = result.filter((d) => !["easy"].includes((d.dayLabel ?? "").toLowerCase()));
    for (const d of nonEasy) {
      expect(d.extras).toEqual([]);
    }
  });

  it("puts both foundation routines on every easy day when selected", () => {
    const days = weekOf("2026-01-05", ["Easy", "Threshold", "Easy", "Long Run", "Easy", null, "Easy"]);
    const { days: result } = scheduleStrengthTraining(days, [TEN_WEEK_PHASE], DEFAULT_STRENGTH_SELECTIONS, gatingClear);

    const easyDays = result.filter((d) => (d.dayLabel ?? "").toLowerCase() === "easy");
    expect(easyDays).toHaveLength(4);
    for (const d of easyDays) {
      expect(d.extras.map((e) => e.kind)).toEqual(["Strength", "Strength"]);
      expect(d.extras[0].items.length).toBeGreaterThan(0);
    }
  });

  it("does nothing when every option is turned off", () => {
    const days = weekOf("2026-01-05", ["Easy", "Easy", "Easy"]);
    const selections: StrengthSelections = { foundation: false, heavyLifting: false, plyometrics: false, hillSprints: false };
    const { days: result, appliedOptions } = scheduleStrengthTraining(days, [TEN_WEEK_PHASE], selections, gatingClear);

    for (const d of result) expect(d.extras).toEqual([]);
    expect(appliedOptions.every((o) => !o.included)).toBe(true);
  });

  it("schedules heavy lifting on at most the first two easy days of a week, after the run", () => {
    const days = weekOf("2026-01-05", ["Easy", "Threshold", "Easy", "Long Run", "Easy", null, "Easy"]);
    const selections: StrengthSelections = { foundation: false, heavyLifting: true, plyometrics: false, hillSprints: false };
    const { days: result } = scheduleStrengthTraining(days, [TEN_WEEK_PHASE], selections, gatingClear);

    const easyDaysWithLifting = result.filter((d) => d.extras.some((e) => e.overview?.includes("Heavy lifting")));
    expect(easyDaysWithLifting).toHaveLength(2);
    for (const d of easyDaysWithLifting) {
      expect(d.extras[0].overview).toMatch(/after today's run, never before it/);
    }
  });

  it("loads heavy lifting at full volume in the general phase and reduced volume in supportive/specific", () => {
    const generalPhase = phase({ phaseDefinitionId: "g", phaseKey: "General", startDate: "2026-01-05", endDate: "2026-01-11" });
    const supportivePhase = phase({ phaseDefinitionId: "s", phaseKey: "Supportive", startDate: "2026-01-12", endDate: "2026-01-18" });
    const generalDays = weekOf("2026-01-05", ["Easy", "Easy"]);
    const supportiveDays = weekOf("2026-01-12", ["Easy", "Easy"]);
    const selections: StrengthSelections = { foundation: false, heavyLifting: true, plyometrics: false, hillSprints: false };

    const { days: result } = scheduleStrengthTraining([...generalDays, ...supportiveDays], [generalPhase, supportivePhase], selections, gatingClear);

    const generalResult = result.filter((d) => d.scheduledDate <= "2026-01-11");
    const supportiveResult = result.filter((d) => d.scheduledDate >= "2026-01-12");
    expect(generalResult[0].extras[0].items.join(" ")).toMatch(/2-3 sets x 4 reps/);
    expect(supportiveResult[0].extras[0].items.join(" ")).toMatch(/60-70%/);
  });

  it("schedules plyometrics on an easy day heavy lifting didn't already claim, when eligible", () => {
    const days = weekOf("2026-01-05", ["Easy", "Easy", "Easy"]);
    const selections: StrengthSelections = { foundation: false, heavyLifting: true, plyometrics: true, hillSprints: false };
    const { days: result, appliedOptions } = scheduleStrengthTraining(days, [TEN_WEEK_PHASE], selections, gatingClear);

    const plyoDays = result.filter((d) => d.extras.some((e) => e.overview?.includes("Plyometrics")));
    const liftingDays = result.filter((d) => d.extras.some((e) => e.overview?.includes("Heavy lifting")));
    expect(plyoDays).toHaveLength(1);
    expect(plyoDays[0].sourceProgramDayId).not.toBe(liftingDays[0].sourceProgramDayId);
    expect(plyoDays[0].sourceProgramDayId).not.toBe(liftingDays[1].sourceProgramDayId);
    expect(appliedOptions.find((o) => o.key === "plyometrics")?.included).toBe(true);
  });

  it("withholds plyometrics and surfaces the rationale when the athlete is rebounding from a setback", () => {
    const days = weekOf("2026-01-05", ["Easy", "Easy", "Easy"]);
    const selections: StrengthSelections = { foundation: false, heavyLifting: false, plyometrics: true, hillSprints: false };
    const rebounding: StrengthGatingInput = { injuryProne: false, reboundingFromSetback: true, experiencedAthlete: true };

    const { days: result, appliedOptions } = scheduleStrengthTraining(days, [TEN_WEEK_PHASE], selections, rebounding);

    for (const d of result) expect(d.extras).toEqual([]);
    const plyoOption = appliedOptions.find((o) => o.key === "plyometrics");
    expect(plyoOption?.included).toBe(false);
    expect(plyoOption?.rationale).toMatch(/rebounding from a setback/);
  });

  it("withholds plyometrics in a buildup shorter than eight weeks", () => {
    const shortPhase = phase({ phaseDefinitionId: "short", phaseKey: "General", startDate: "2026-01-05", endDate: "2026-01-18" });
    const days = weekOf("2026-01-05", ["Easy", "Easy"]);
    const selections: StrengthSelections = { foundation: false, heavyLifting: false, plyometrics: true, hillSprints: false };

    const { appliedOptions } = scheduleStrengthTraining(days, [shortPhase], selections, gatingClear);
    const plyoOption = appliedOptions.find((o) => o.key === "plyometrics");
    expect(plyoOption?.included).toBe(false);
    expect(plyoOption?.rationale).toMatch(/eight weeks/);
  });

  it("appends hill sprints to every easy run when selected", () => {
    const days = weekOf("2026-01-05", ["Easy", "Threshold", "Easy"]);
    const selections: StrengthSelections = { foundation: false, heavyLifting: false, plyometrics: false, hillSprints: true };
    const { days: result } = scheduleStrengthTraining(days, [TEN_WEEK_PHASE], selections, gatingClear);

    const easyDays = result.filter((d) => (d.dayLabel ?? "").toLowerCase() === "easy");
    expect(easyDays).toHaveLength(2);
    for (const d of easyDays) {
      expect(d.extras).toHaveLength(1);
      expect(d.extras[0].kind).toBe("Hill Sprints");
    }
    const threshold = result.find((d) => d.dayLabel === "Threshold")!;
    expect(threshold.extras).toEqual([]);
  });

  it("preserves any extras a day already carried and orders new ones after them", () => {
    const days = weekOf("2026-01-05", ["Easy"]);
    days[0] = { ...days[0], extras: [{ kind: "Drills", overview: "A-skips", count: null, distanceM: null, durationS: null, items: [], extraOrder: 0 }] };
    const selections: StrengthSelections = { foundation: false, heavyLifting: false, plyometrics: false, hillSprints: true };

    const { days: result } = scheduleStrengthTraining(days, [TEN_WEEK_PHASE], selections, gatingClear);
    expect(result[0].extras).toHaveLength(2);
    expect(result[0].extras[0].kind).toBe("Drills");
    expect(result[0].extras[0].extraOrder).toBe(0);
    expect(result[0].extras[1].kind).toBe("Hill Sprints");
    expect(result[0].extras[1].extraOrder).toBe(1);
  });
});
