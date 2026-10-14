import { describe, it, expect } from "vitest";
import {
  PHASE_PROFILES,
  REFERENCE_PLAN_WEEKS,
  proposePhaseLayout,
  selectPhaseProfile,
  weeksAvailableBetween,
  type PlannablePhase,
} from "@/lib/private-coaching/race-anchored-planning";

function phase(overrides: Partial<PlannablePhase> & { phaseKey: string }): PlannablePhase {
  return {
    phaseDefinitionId: overrides.phaseKey.toLowerCase(),
    durationWeeksMin: 1,
    durationWeeksMax: 20,
    isOptional: false,
    ...overrides,
  };
}

const FLEXIBLE: PlannablePhase[] = [
  phase({ phaseKey: "General", durationWeeksMin: 4, durationWeeksMax: 14 }),
  phase({ phaseKey: "Supportive", durationWeeksMin: 3, durationWeeksMax: 8 }),
  phase({ phaseKey: "Specific", durationWeeksMin: 3, durationWeeksMax: 9 }),
];

describe("selectPhaseProfile", () => {
  it("maps each framework's own peak mileage onto its own profile", () => {
    expect(selectPhaseProfile(45, 1).key).toBe("canyon");
    expect(selectPhaseProfile(60, 2).key).toBe("mesa");
    expect(selectPhaseProfile(75, 3).key).toBe("ridge");
    expect(selectPhaseProfile(90, 4).key).toBe("peak");
    expect(selectPhaseProfile(110, 6).key).toBe("summit");
  });

  it("keeps the real framework phase counts as the reference shape", () => {
    // Guards the one thing in this module that is not derived: these are
    // the seeded frameworks' own boundaries.
    expect(PHASE_PROFILES.map((p) => [p.general, p.supportive, p.specific])).toEqual([
      [10, 4, 4],
      [8, 5, 5],
      [7, 5, 6],
      [6, 6, 6],
      [6, 5, 7],
    ]);
    for (const profile of PHASE_PROFILES) {
      expect(profile.general + profile.supportive + profile.specific).toBe(REFERENCE_PLAN_WEEKS);
    }
  });

  it("pulls the choice down when experience lags the mileage, and never up", () => {
    // 90 mi/wk in year two is someone carrying Peak's volume without
    // Peak's background: keep more general work underneath it.
    expect(selectPhaseProfile(90, 2).key).toBe("mesa");
    // The reverse is already well served by the lower profile.
    expect(selectPhaseProfile(45, 10).key).toBe("canyon");
  });

  it("falls back to mileage alone when experience is unknown", () => {
    expect(selectPhaseProfile(90, null).key).toBe("peak");
  });

  it("treats a complete beginner at high mileage as the lowest profile", () => {
    expect(selectPhaseProfile(100, 0).key).toBe("canyon");
  });
});

describe("proposePhaseLayout", () => {
  it("reproduces the framework shape when the weeks line up with the reference length", () => {
    const proposal = proposePhaseLayout({ phases: FLEXIBLE, weeksAvailable: 18, peakMileage: 60, experienceYears: 2 });
    expect(proposal.profileKey).toBe("mesa");
    expect(proposal.phases.map((p) => p.weeks)).toEqual([8, 5, 5]);
    expect(proposal.totalWeeks).toBe(18);
    expect(proposal.fit).toEqual({ kind: "exact", weeks: 18 });
  });

  it("gives a more experienced, higher-mileage athlete a longer specific block", () => {
    const low = proposePhaseLayout({ phases: FLEXIBLE, weeksAvailable: 18, peakMileage: 45, experienceYears: 1 });
    const high = proposePhaseLayout({ phases: FLEXIBLE, weeksAvailable: 18, peakMileage: 110, experienceYears: 6 });
    const specific = (p: typeof low) => p.phases.find((x) => x.phaseKey === "Specific")!.weeks;
    const general = (p: typeof low) => p.phases.find((x) => x.phaseKey === "General")!.weeks;
    expect(specific(high)).toBeGreaterThan(specific(low));
    expect(general(high)).toBeLessThan(general(low));
  });

  it("always uses exactly the weeks available when the phases allow it", () => {
    for (const weeks of [12, 14, 15, 16, 18, 20]) {
      const proposal = proposePhaseLayout({ phases: FLEXIBLE, weeksAvailable: weeks, peakMileage: 75, experienceYears: 3 });
      expect(proposal.totalWeeks).toBe(weeks);
      expect(proposal.fit.kind).toBe("exact");
    }
  });

  it("never proposes a phase outside its own authored range", () => {
    for (const weeks of [8, 12, 18, 26]) {
      const proposal = proposePhaseLayout({ phases: FLEXIBLE, weeksAvailable: weeks, peakMileage: 60, experienceYears: 2 });
      for (const proposed of proposal.phases) {
        const authored = FLEXIBLE.find((p) => p.phaseDefinitionId === proposed.phaseDefinitionId)!;
        expect(proposed.weeks).toBeGreaterThanOrEqual(authored.durationWeeksMin);
        expect(proposed.weeks).toBeLessThanOrEqual(authored.durationWeeksMax);
      }
    }
  });

  it("takes time out of General before Specific when weeks are tight", () => {
    const roomy = proposePhaseLayout({ phases: FLEXIBLE, weeksAvailable: 18, peakMileage: 60, experienceYears: 2 });
    const tight = proposePhaseLayout({ phases: FLEXIBLE, weeksAvailable: 12, peakMileage: 60, experienceYears: 2 });
    const weeksOf = (p: typeof roomy, key: string) => p.phases.find((x) => x.phaseKey === key)!.weeks;
    const generalLost = weeksOf(roomy, "General") - weeksOf(tight, "General");
    const specificLost = weeksOf(roomy, "Specific") - weeksOf(tight, "Specific");
    expect(generalLost).toBeGreaterThan(specificLost);
  });

  it("reports a genuine shortfall instead of forcing the plan to fit", () => {
    const proposal = proposePhaseLayout({ phases: FLEXIBLE, weeksAvailable: 6, peakMileage: 60, experienceYears: 2 });
    // Minimum authored lengths total 10 weeks, so 6 cannot work.
    expect(proposal.fit).toEqual({ kind: "short", weeksAvailable: 6, weeksNeeded: 10, shortfall: 4 });
    expect(proposal.totalWeeks).toBe(10);
    expect(proposal.notes.join(" ")).toMatch(/4 weeks short/);
    // And it says why compressing is the risky option.
    expect(proposal.notes.join(" ")).toMatch(/Injury risk tracks how big a change is/);
  });

  it("reports spare weeks rather than padding the specific block", () => {
    const capped: PlannablePhase[] = [
      phase({ phaseKey: "General", durationWeeksMin: 4, durationWeeksMax: 6 }),
      phase({ phaseKey: "Supportive", durationWeeksMin: 3, durationWeeksMax: 4 }),
      phase({ phaseKey: "Specific", durationWeeksMin: 3, durationWeeksMax: 4 }),
    ];
    const proposal = proposePhaseLayout({ phases: capped, weeksAvailable: 20, peakMileage: 60, experienceYears: 2 });
    expect(proposal.fit).toEqual({ kind: "long", weeksAvailable: 20, weeksUsed: 14, surplus: 6 });
    expect(proposal.notes.join(" ")).toMatch(/best spent as easy general running before the plan starts/);
  });

  it("confirms a fixed-length plan as the plan's own layout, not a suggestion", () => {
    const fixed: PlannablePhase[] = [
      phase({ phaseKey: "General", durationWeeksMin: 10, durationWeeksMax: 10 }),
      phase({ phaseKey: "Supportive", durationWeeksMin: 4, durationWeeksMax: 4 }),
      phase({ phaseKey: "Specific", durationWeeksMin: 4, durationWeeksMax: 4 }),
    ];
    const proposal = proposePhaseLayout({ phases: fixed, weeksAvailable: 15, peakMileage: 45, experienceYears: 1 });
    expect(proposal.phases.map((p) => p.weeks)).toEqual([10, 4, 4]);
    expect(proposal.fit).toEqual({ kind: "short", weeksAvailable: 15, weeksNeeded: 18, shortfall: 3 });
    expect(proposal.notes.join(" ")).toMatch(/authored at a fixed length/);
  });

  it("leaves an optional phase out when the time is already committed, and includes it when there is room", () => {
    const withBase: PlannablePhase[] = [
      phase({ phaseKey: "Base", durationWeeksMin: 2, durationWeeksMax: 6, isOptional: true }),
      ...FLEXIBLE,
    ];
    const tight = proposePhaseLayout({ phases: withBase, weeksAvailable: 18, peakMileage: 60, experienceYears: 2 });
    expect(tight.phases.find((p) => p.phaseKey === "Base")!.include).toBe(false);

    const capped: PlannablePhase[] = [
      phase({ phaseKey: "Base", durationWeeksMin: 2, durationWeeksMax: 6, isOptional: true }),
      phase({ phaseKey: "General", durationWeeksMin: 4, durationWeeksMax: 6 }),
      phase({ phaseKey: "Supportive", durationWeeksMin: 3, durationWeeksMax: 4 }),
      phase({ phaseKey: "Specific", durationWeeksMin: 3, durationWeeksMax: 4 }),
    ];
    const roomy = proposePhaseLayout({ phases: capped, weeksAvailable: 18, peakMileage: 60, experienceYears: 2 });
    const base = roomy.phases.find((p) => p.phaseKey === "Base")!;
    expect(base.include).toBe(true);
    expect(base.weeks).toBeGreaterThanOrEqual(2);
    expect(roomy.totalWeeks).toBe(18);
  });

  it("leaves a phase it doesn't recognise at its shortest length and says so", () => {
    const odd: PlannablePhase[] = [...FLEXIBLE, phase({ phaseKey: "Sharpening", durationWeeksMin: 2, durationWeeksMax: 5 })];
    const proposal = proposePhaseLayout({ phases: odd, weeksAvailable: 20, peakMileage: 60, experienceYears: 2 });
    expect(proposal.notes.join(" ")).toMatch(/Sharpening is not a General, Supportive or Specific phase/);
    expect(proposal.phases.find((p) => p.phaseKey === "Sharpening")!.weeks).toBeGreaterThanOrEqual(2);
  });

  it("handles a plan with no phases without throwing", () => {
    const proposal = proposePhaseLayout({ phases: [], weeksAvailable: 18, peakMileage: 60, experienceYears: 2 });
    expect(proposal.phases).toEqual([]);
    expect(proposal.notes).toEqual(["This plan has no phases to lay out."]);
  });
});

describe("weeksAvailableBetween", () => {
  it("counts whole weeks and reports the remainder separately", () => {
    // 2027-01-04 is a Monday; 126 days later is exactly 18 weeks.
    expect(weeksAvailableBetween("2027-01-04", "2027-05-10")).toEqual({ weeks: 18, spareDays: 0 });
    expect(weeksAvailableBetween("2027-01-04", "2027-05-14")).toEqual({ weeks: 18, spareDays: 4 });
  });

  it("never rounds spare days up into a week that does not exist", () => {
    expect(weeksAvailableBetween("2027-01-04", "2027-01-10").weeks).toBe(0);
    expect(weeksAvailableBetween("2027-01-04", "2027-01-11").weeks).toBe(1);
  });

  it("returns zero for a race that has already happened", () => {
    expect(weeksAvailableBetween("2027-05-10", "2027-01-04")).toEqual({ weeks: 0, spareDays: 0 });
  });

  it("is unaffected by a DST boundary", () => {
    // US DST begins 2027-03-14; this span crosses it.
    expect(weeksAvailableBetween("2027-03-01", "2027-03-29")).toEqual({ weeks: 4, spareDays: 0 });
  });

  it("rejects invalid dates", () => {
    expect(() => weeksAvailableBetween("nope", "2027-05-10")).toThrow(/Invalid start date/);
    expect(() => weeksAvailableBetween("2027-01-04", "nope")).toThrow(/Invalid race date/);
  });
});
