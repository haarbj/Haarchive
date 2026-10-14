import { describe, it, expect } from "vitest";
import {
  FRAMEWORK_LADDER,
  NON_MARATHON_BLOCK_AFTER,
  PEAK_STEP,
  findRung,
  groupPhasesIntoCycles,
  suggestNextBuildup,
  type CyclePhaseInput,
  type TrainingCycle,
} from "@/lib/private-coaching/multi-cycle";

function phase(overrides: Partial<CyclePhaseInput> & { startDate: string; endDate: string }): CyclePhaseInput {
  return {
    phaseKey: "General",
    programId: "p1",
    programName: "Canyon",
    frameworkKey: "canyon",
    volumeVariantKey: "canyon-40",
    peakMileage: 40,
    ...overrides,
  };
}

function cycle(variantKey: string | null, peakMileage: number | null, startDate = "2027-01-04"): TrainingCycle {
  return {
    programId: "p1",
    programName: "X",
    frameworkKey: variantKey?.split("-")[0] ?? null,
    volumeVariantKey: variantKey,
    peakMileage,
    startDate,
    endDate: "2027-05-10",
    phaseKeys: ["General", "Supportive", "Specific"],
  };
}

describe("FRAMEWORK_LADDER", () => {
  it("is the five seeded frameworks and their real variants, in order", () => {
    expect(FRAMEWORK_LADDER.map((r) => r.variantKey)).toEqual([
      "canyon-40",
      "canyon-50",
      "mesa-55",
      "mesa-65",
      "ridge-70",
      "ridge-80",
      "peak-85",
      "peak-95",
      "summit-100",
      "summit-110",
      "summit-120",
    ]);
  });

  it("never steps more than the per-cycle limit, anywhere on the ladder", () => {
    // The ladder and the +5-10 rule have to agree, or following the ladder
    // would break the rule the module states.
    for (let i = 1; i < FRAMEWORK_LADDER.length; i += 1) {
      const step = FRAMEWORK_LADDER[i].peakMileage - FRAMEWORK_LADDER[i - 1].peakMileage;
      expect(step).toBeGreaterThanOrEqual(PEAK_STEP.min);
      expect(step).toBeLessThanOrEqual(PEAK_STEP.max);
    }
  });

  it("rises monotonically and keeps each framework's rungs together", () => {
    for (let i = 1; i < FRAMEWORK_LADDER.length; i += 1) {
      expect(FRAMEWORK_LADDER[i].peakMileage).toBeGreaterThan(FRAMEWORK_LADDER[i - 1].peakMileage);
      expect(FRAMEWORK_LADDER[i].tier).toBeGreaterThanOrEqual(FRAMEWORK_LADDER[i - 1].tier);
    }
  });

  it("finds a rung by variant key, and nothing for an unknown one", () => {
    expect(findRung("peak-95")).toMatchObject({ frameworkName: "Peak", peakMileage: 95, tier: 3 });
    expect(findRung("not-a-variant")).toBeNull();
    expect(findRung(null)).toBeNull();
  });
});

describe("groupPhasesIntoCycles", () => {
  it("groups consecutive phases from one assignment into one cycle", () => {
    const cycles = groupPhasesIntoCycles([
      phase({ phaseKey: "General", startDate: "2027-01-04", endDate: "2027-03-14" }),
      phase({ phaseKey: "Supportive", startDate: "2027-03-15", endDate: "2027-04-11" }),
      phase({ phaseKey: "Specific", startDate: "2027-04-12", endDate: "2027-05-09" }),
    ]);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toMatchObject({ startDate: "2027-01-04", endDate: "2027-05-09", peakMileage: 40 });
    expect(cycles[0].phaseKeys).toEqual(["General", "Supportive", "Specific"]);
  });

  it("splits two buildups off the same program when a real gap separates them", () => {
    const cycles = groupPhasesIntoCycles([
      phase({ startDate: "2027-01-04", endDate: "2027-05-09" }),
      phase({ startDate: "2027-09-06", endDate: "2028-01-09" }),
    ]);
    expect(cycles).toHaveLength(2);
  });

  it("splits when the volume variant changes, even with no gap", () => {
    const cycles = groupPhasesIntoCycles([
      phase({ startDate: "2027-01-04", endDate: "2027-05-09", volumeVariantKey: "canyon-40", peakMileage: 40 }),
      phase({ startDate: "2027-05-10", endDate: "2027-09-12", volumeVariantKey: "canyon-50", peakMileage: 50 }),
    ]);
    expect(cycles).toHaveLength(2);
    expect(cycles.map((c) => c.peakMileage)).toEqual([40, 50]);
  });

  it("keeps hand-built phases in the history without a peak or a tier", () => {
    const cycles = groupPhasesIntoCycles([
      phase({ startDate: "2027-01-04", endDate: "2027-02-14", programId: null, programName: null, frameworkKey: null, volumeVariantKey: null, peakMileage: null }),
    ]);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].peakMileage).toBeNull();
    expect(findRung(cycles[0].volumeVariantKey)).toBeNull();
  });

  it("orders by date regardless of input order", () => {
    const cycles = groupPhasesIntoCycles([
      phase({ startDate: "2027-09-06", endDate: "2028-01-09" }),
      phase({ startDate: "2027-01-04", endDate: "2027-05-09" }),
    ]);
    expect(cycles.map((c) => c.startDate)).toEqual(["2027-01-04", "2027-09-06"]);
  });

  it("handles no phases at all", () => {
    expect(groupPhasesIntoCycles([])).toEqual([]);
  });
});

describe("suggestNextBuildup", () => {
  it("finishes a framework's own range before stepping up a tier", () => {
    const suggestion = suggestNextBuildup({
      cycles: [cycle("canyon-40", 40)],
      unresolvedInjury: false,
      consecutiveMarathonCycles: 1,
    });
    expect(suggestion.rung?.variantKey).toBe("canyon-50");
    expect(suggestion.title).toMatch(/Repeat Canyon at its higher 50/);
    expect(suggestion.detail).toMatch(/Volume first, intensity second/);
  });

  it("steps up a tier once the framework's range is done", () => {
    const suggestion = suggestNextBuildup({
      cycles: [cycle("canyon-40", 40), cycle("canyon-50", 50)],
      unresolvedInjury: false,
      consecutiveMarathonCycles: 2,
    });
    expect(suggestion.rung?.variantKey).toBe("mesa-55");
    expect(suggestion.title).toMatch(/Step up to Mesa at 55/);
    // And it explains why the limit exists in tissue terms.
    expect(suggestion.detail).toMatch(/tendons take months to adapt and bone longer still/);
  });

  it("never suggests more than the per-cycle step", () => {
    for (const rung of FRAMEWORK_LADDER) {
      const suggestion = suggestNextBuildup({
        cycles: [cycle(rung.variantKey, rung.peakMileage)],
        unresolvedInjury: false,
        consecutiveMarathonCycles: 1,
      });
      if (!suggestion.rung || suggestion.rung.variantKey === rung.variantKey) continue;
      expect(suggestion.rung.peakMileage - rung.peakMileage).toBeLessThanOrEqual(PEAK_STEP.max);
    }
  });

  it("repeats a previously-completed level when an injury cause is unresolved", () => {
    const suggestion = suggestNextBuildup({
      cycles: [cycle("mesa-55", 55)],
      unresolvedInjury: true,
      consecutiveMarathonCycles: 1,
    });
    expect(suggestion.rung?.variantKey).toBe("mesa-55");
    expect(suggestion.title).toMatch(/Rebuild at a level they have already handled/);
    expect(suggestion.actions.join(" ")).toMatch(/Repeat Mesa at 55 miles a week/);
    // Progress gated on the cause, not on symptoms going away.
    expect(suggestion.actions.join(" ")).toMatch(/not once the pain has stopped/);
  });

  it("lets the injury rule outrank even a due non-marathon block", () => {
    const suggestion = suggestNextBuildup({
      cycles: [cycle("mesa-55", 55)],
      unresolvedInjury: true,
      consecutiveMarathonCycles: 6,
    });
    expect(suggestion.title).toMatch(/Rebuild at a level/);
    expect(suggestion.suggestNonMarathonBlock).toBe(false);
  });

  it("suggests a non-marathon block after enough consecutive buildups", () => {
    expect(NON_MARATHON_BLOCK_AFTER).toEqual({ min: 2, max: 4 });
    const suggestion = suggestNextBuildup({
      cycles: [cycle("ridge-70", 70)],
      unresolvedInjury: false,
      consecutiveMarathonCycles: 4,
    });
    expect(suggestion.suggestNonMarathonBlock).toBe(true);
    expect(suggestion.title).toMatch(/4 marathon buildups in a row is enough/);
    expect(suggestion.actions.join(" ")).toMatch(/unstructured period is a legitimate choice/);
    // Return at the same peak, not a higher one.
    expect(suggestion.actions.join(" ")).toMatch(/same peak, not a higher one/);
  });

  it("mentions a due block as an option without forcing it, below the threshold", () => {
    const suggestion = suggestNextBuildup({
      cycles: [cycle("ridge-70", 70)],
      unresolvedInjury: false,
      consecutiveMarathonCycles: 3,
    });
    expect(suggestion.suggestNonMarathonBlock).toBe(false);
    expect(suggestion.rung?.variantKey).toBe("ridge-80");
    expect(suggestion.actions.join(" ")).toMatch(/marathon buildup 4 in a row/);
  });

  it("says volume is not the remaining lever at the top of the ladder", () => {
    const suggestion = suggestNextBuildup({
      cycles: [cycle("summit-120", 120)],
      unresolvedInjury: false,
      consecutiveMarathonCycles: 1,
    });
    expect(suggestion.rung?.variantKey).toBe("summit-120");
    expect(suggestion.title).toMatch(/top of the ladder/);
    expect(suggestion.detail).toMatch(/more workout volume and more recovery rather than more miles/);
  });

  it("handles an athlete with no completed buildup on the ladder", () => {
    const suggestion = suggestNextBuildup({ cycles: [], unresolvedInjury: false, consecutiveMarathonCycles: 0 });
    expect(suggestion.title).toMatch(/No completed buildup on record/);
    expect(suggestion.actions.join(" ")).toMatch(/matches their current weekly mileage/);
  });

  it("ignores hand-built cycles when looking for the last known level", () => {
    const suggestion = suggestNextBuildup({
      cycles: [cycle("mesa-55", 55), cycle(null, null, "2027-06-01")],
      unresolvedInjury: false,
      consecutiveMarathonCycles: 1,
    });
    expect(suggestion.rung?.variantKey).toBe("mesa-65");
  });
});
