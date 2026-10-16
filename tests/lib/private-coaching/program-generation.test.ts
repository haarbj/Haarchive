import { describe, expect, it } from "vitest";

import {
  computeProgramPaceTarget,
  resolveProgramGeneration,
  type GenerateProgramInput,
  type ProgramDayContent,
  type ProgramPhaseDefinition,
} from "@/lib/private-coaching/program-generation";

const MILE_METERS = 1609.344;

function phase(overrides: Partial<ProgramPhaseDefinition> & { id: string }): ProgramPhaseDefinition {
  return {
    phaseKey: overrides.phaseKey ?? "General",
    name: overrides.name ?? null,
    durationWeeksMin: overrides.durationWeeksMin ?? 1,
    durationWeeksMax: overrides.durationWeeksMax ?? 4,
    isOptional: overrides.isOptional ?? false,
    explainer: overrides.explainer ?? null,
    ...overrides,
  };
}

function day(overrides: Partial<ProgramDayContent> & { id: string; phaseDefinitionId: string; weekNumber: number; dayOfWeek: number }): ProgramDayContent {
  return {
    dayLabel: null,
    sessionSlot: null,
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
    isEventDay: false,
    isOptional: false,
    alternativeText: null,
    notes: null,
    steps: [],
    extras: [],
    ...overrides,
  };
}

function baseInput(overrides: Partial<GenerateProgramInput> = {}): GenerateProgramInput {
  const p1 = phase({ id: "p1", phaseKey: "General", durationWeeksMin: 2, durationWeeksMax: 2 });
  return {
    variantPhases: [p1],
    phaseSelections: [{ phaseDefinitionId: "p1", include: true, weeks: 2 }],
    days: [
      day({ id: "d1", phaseDefinitionId: "p1", weekNumber: 1, dayOfWeek: 1, plannedDistanceM: 5000 }),
      day({ id: "d2", phaseDefinitionId: "p1", weekNumber: 2, dayOfWeek: 1, plannedDistanceM: 8000 }),
    ],
    weekLabels: [],
    weekVolumes: [],
    scalesDistanceWithMileage: false,
    scalesDurationWithMileage: false,
    targetPeakWeeklyMiles: null,
    targetPeakWeeklyDurationS: null,
    anchor: { kind: "startDate", startDate: "2027-01-04", targetEventDate: null }, // a real Monday
    ...overrides,
  };
}

function expectResult(result: ReturnType<typeof resolveProgramGeneration>) {
  if ("error" in result) throw new Error(`Expected a result, got error: ${result.error}`);
  return result.result;
}

function expectError(result: ReturnType<typeof resolveProgramGeneration>) {
  if (!("error" in result)) throw new Error("Expected an error result, got a real result");
  return result.error;
}

describe("computeProgramPaceTarget", () => {
  it("matches the exact worked example from the pace-zone-table feature (5:24/mi 5K, 50-60%)", () => {
    const refSeconds = 5 * 60 + 24; // 324
    const target = computeProgramPaceTarget("5k", 50, 60, { "5k": refSeconds });
    expect(target).not.toBeNull();
    // 60% -> faster/min edge (7:34), 50% -> slower/max edge (8:06)
    expect(Math.round(target!.min)).toBe(454); // 7:34
    expect(Math.round(target!.max)).toBe(486); // 8:06
  });

  it("returns null when the athlete has no reference pace for that key", () => {
    expect(computeProgramPaceTarget("marathon", 90, 92, {})).toBeNull();
  });
});

describe("resolveProgramGeneration -- basic resolution", () => {
  it("resolves dates, phases, and days for a simple two-week program", () => {
    const result = expectResult(resolveProgramGeneration(baseInput()));
    expect(result.startDate).toBe("2027-01-04");
    expect(result.totalWeeks).toBe(2);
    expect(result.phases).toHaveLength(1);
    expect(result.phases[0].startDate).toBe("2027-01-04");
    expect(result.phases[0].endDate).toBe("2027-01-17");
    expect(result.days).toHaveLength(2);
    expect(result.days[0].scheduledDate).toBe("2027-01-04");
    expect(result.days[1].scheduledDate).toBe("2027-01-11");
    expect(result.warnings.emptyPhaseDefinitionIds).toEqual([]);
    expect(result.warnings.outOfRangeDays).toEqual([]);
  });

  // The explainer is what the athlete reads under "Why this phase?" after
  // assignment, so it has to survive resolution byte-for-byte -- this
  // function is the only thing between the coach's authored copy and the
  // p_phases payload that writes the athlete's own copy.
  it("carries a phase's explainer through to the resolved phase unchanged", () => {
    const explainer = "What this block is for.\n\nAnd the second paragraph.";
    const result = expectResult(
      resolveProgramGeneration(
        baseInput({
          variantPhases: [phase({ id: "p1", phaseKey: "General", durationWeeksMin: 2, durationWeeksMax: 2, explainer })],
        }),
      ),
    );
    expect(result.phases[0].explainer).toBe(explainer);
  });

  it("resolves a phase with no authored explainer to null rather than a placeholder", () => {
    const result = expectResult(resolveProgramGeneration(baseInput()));
    expect(result.phases[0].explainer).toBeNull();
  });

  it("a required phase is always included even if phaseSelections says include: false", () => {
    const input = baseInput({ phaseSelections: [{ phaseDefinitionId: "p1", include: false, weeks: 2 }] });
    const result = expectResult(resolveProgramGeneration(input));
    expect(result.days).toHaveLength(2);
  });

  it("rejects a weeks selection outside the phase's own [min,max] range", () => {
    const input = baseInput({ phaseSelections: [{ phaseDefinitionId: "p1", include: true, weeks: 5 }] });
    const error = expectError(resolveProgramGeneration(input));
    expect(error).toMatch(/between 2 and 2/);
  });
});

describe("resolveProgramGeneration -- scaling", () => {
  it("distance and duration scale fully independently", () => {
    const input = baseInput({
      days: [
        day({ id: "d1", phaseDefinitionId: "p1", weekNumber: 1, dayOfWeek: 1, plannedDistanceM: 5000, plannedDurationS: 1800 }),
        day({ id: "d2", phaseDefinitionId: "p1", weekNumber: 2, dayOfWeek: 1, plannedDistanceM: 5000, plannedDurationS: 1800 }),
      ],
      scalesDistanceWithMileage: true,
      targetPeakWeeklyMiles: (5000 / MILE_METERS) * 2, // double the reference peak
      scalesDurationWithMileage: false,
    });
    const result = expectResult(resolveProgramGeneration(input));
    // Distance doubled, duration untouched.
    expect(result.days[0].plannedDistanceM).toBeCloseTo(10000, 0);
    expect(result.days[0].plannedDurationS).toBe(1800);
  });

  it("rounds scaled distances to a whole meter, never a raw float (a real regression -- e.g. 8851m at a ~0.805 scale must never come out as 7123.576587317464)", () => {
    const input = baseInput({
      days: [
        day({ id: "d1", phaseDefinitionId: "p1", weekNumber: 1, dayOfWeek: 1, plannedDistanceM: 8851 }),
        day({ id: "d2", phaseDefinitionId: "p1", weekNumber: 2, dayOfWeek: 1, plannedDistanceM: 5000 }),
      ],
      scalesDistanceWithMileage: true,
      // A deliberately non-round target so the ratio isn't a clean fraction.
      targetPeakWeeklyMiles: 4.417,
    });
    const result = expectResult(resolveProgramGeneration(input));
    for (const resolvedDay of result.days) {
      if (resolvedDay.plannedDistanceM != null) expect(Number.isInteger(resolvedDay.plannedDistanceM)).toBe(true);
    }
  });

  it("rounds scaled step-level distances to a whole meter too", () => {
    const input = baseInput({
      days: [
        day({
          id: "d1",
          phaseDefinitionId: "p1",
          weekNumber: 1,
          dayOfWeek: 1,
          plannedDistanceM: 8851,
          steps: [
            {
              stepOrder: 0,
              stepType: "main",
              durationS: null,
              durationMaxS: null,
              distanceM: 8851,
              distanceMaxM: null,
              targetType: "open",
              targetMin: null,
              targetMax: null,
              targetUnit: null,
              targetPaceReference: null,
              targetPacePercentBasis: null,
              targetPacePercentMin: null,
              targetPacePercentMax: null,
              repetitions: null,
              repetitionsMax: null,
              restS: null,
              restMaxS: null,
              instructions: null,
            },
          ],
        }),
      ],
      scalesDistanceWithMileage: true,
      targetPeakWeeklyMiles: 4.417,
    });
    const result = expectResult(resolveProgramGeneration(input));
    expect(Number.isInteger(result.days[0].steps[0]!.distanceM)).toBe(true);
  });

  it("both scaling flags off leaves everything exactly as authored", () => {
    const result = expectResult(resolveProgramGeneration(baseInput()));
    expect(result.days[0].plannedDistanceM).toBe(5000);
    expect(result.days[1].plannedDistanceM).toBe(8000);
    expect(result.referencePeakWeeklyMiles).toBeNull();
    expect(result.referencePeakWeeklyDurationS).toBeNull();
  });

  it("pace, HR, and RPE are never scaled under any setting", () => {
    const input = baseInput({
      days: [
        day({
          id: "d1",
          phaseDefinitionId: "p1",
          weekNumber: 1,
          dayOfWeek: 1,
          plannedDistanceM: 5000,
          plannedPaceSPerMi: 360,
          plannedHrBpm: 150,
          plannedRpe: 5,
        }),
      ],
      phaseSelections: [{ phaseDefinitionId: "p1", include: true, weeks: 1 }],
      variantPhases: [phase({ id: "p1", durationWeeksMin: 1, durationWeeksMax: 1 })],
      scalesDistanceWithMileage: true,
      targetPeakWeeklyMiles: (5000 / MILE_METERS) * 3,
    });
    const result = expectResult(resolveProgramGeneration(input));
    expect(result.days[0].plannedPaceSPerMi).toBe(360);
    expect(result.days[0].plannedHrBpm).toBe(150);
    expect(result.days[0].plannedRpe).toBe(5);
    expect(result.days[0].plannedDistanceM).toBeCloseTo(15000, 0);
  });

  it("rejects a missing/zero/negative target when scaling is on", () => {
    const zero = baseInput({ scalesDistanceWithMileage: true, targetPeakWeeklyMiles: 0 });
    expect(expectError(resolveProgramGeneration(zero))).toMatch(/greater than zero/);
    const negative = baseInput({ scalesDistanceWithMileage: true, targetPeakWeeklyMiles: -5 });
    expect(expectError(resolveProgramGeneration(negative))).toMatch(/greater than zero/);
    const missing = baseInput({ scalesDistanceWithMileage: true, targetPeakWeeklyMiles: null });
    expect(expectError(resolveProgramGeneration(missing))).toMatch(/greater than zero/);
  });

  it("rejects scaling-enabled with zero distance-bearing content, rather than dividing by zero", () => {
    const input = baseInput({
      days: [day({ id: "d1", phaseDefinitionId: "p1", weekNumber: 1, dayOfWeek: 1, plannedDurationS: 1800 })],
      scalesDistanceWithMileage: true,
      targetPeakWeeklyMiles: 40,
    });
    const error = expectError(resolveProgramGeneration(input));
    expect(error).toMatch(/no distance-based workouts/);
  });

  it("passes pace-percent-basis/min/max straight through unresolved, like pace_reference already does -- resolution happens live, at read time, against the athlete's current fitness estimate (see fitness-estimates.ts)", () => {
    const input = baseInput({
      days: [
        day({
          id: "d1",
          phaseDefinitionId: "p1",
          weekNumber: 1,
          dayOfWeek: 1,
          pacePercentBasis: "5k",
          pacePercentMin: 50,
          pacePercentMax: 60,
        }),
      ],
      phaseSelections: [{ phaseDefinitionId: "p1", include: true, weeks: 1 }],
      variantPhases: [phase({ id: "p1", durationWeeksMin: 1, durationWeeksMax: 1 })],
    });
    const result = expectResult(resolveProgramGeneration(input));
    expect(result.days[0].pacePercentBasis).toBe("5k");
    expect(result.days[0].pacePercentMin).toBe(50);
    expect(result.days[0].pacePercentMax).toBe(60);
    expect(result.days[0].plannedPaceSPerMi).toBeNull();
    expect(result.days[0].plannedPaceMaxSPerMi).toBeNull();
  });
});

describe("resolveProgramGeneration -- empty phases/weeks", () => {
  it("reports an entirely-empty phase and an empty week within an otherwise-authored phase", () => {
    const p1 = phase({ id: "p1", durationWeeksMin: 2, durationWeeksMax: 2 });
    const p2 = phase({ id: "p2", phaseKey: "Empty", durationWeeksMin: 1, durationWeeksMax: 1 });
    const input = baseInput({
      variantPhases: [p1, p2],
      phaseSelections: [
        { phaseDefinitionId: "p1", include: true, weeks: 2 },
        { phaseDefinitionId: "p2", include: true, weeks: 1 },
      ],
      days: [day({ id: "d1", phaseDefinitionId: "p1", weekNumber: 1, dayOfWeek: 1, plannedDistanceM: 5000 })], // week 2 of p1 has nothing; p2 has nothing at all
    });
    const result = expectResult(resolveProgramGeneration(input));
    expect(result.warnings.emptyPhaseDefinitionIds).toEqual(["p2"]);
    expect(result.warnings.emptyWeeks).toEqual([{ phaseDefinitionId: "p1", weekNumber: 2 }]);
  });
});

describe("resolveProgramGeneration -- out-of-range authored content", () => {
  it("reports and excludes authored days beyond a shorter selected phase duration, without touching the input", () => {
    const p1 = phase({ id: "p1", durationWeeksMin: 1, durationWeeksMax: 4 });
    const days = [
      day({ id: "d1", phaseDefinitionId: "p1", weekNumber: 1, dayOfWeek: 1, plannedDistanceM: 5000 }),
      day({ id: "d2", phaseDefinitionId: "p1", weekNumber: 3, dayOfWeek: 1, plannedDistanceM: 6000 }), // out of range if only 2 weeks selected
    ];
    const input = baseInput({
      variantPhases: [p1],
      phaseSelections: [{ phaseDefinitionId: "p1", include: true, weeks: 2 }],
      days,
    });
    const result = expectResult(resolveProgramGeneration(input));
    expect(result.days.map((d) => d.sourceProgramDayId)).toEqual(["d1"]);
    expect(result.warnings.outOfRangeDays).toEqual([{ sourceProgramDayId: "d2", phaseDefinitionId: "p1", weekNumber: 3 }]);
    // The original input array is untouched.
    expect(days).toHaveLength(2);
  });

  it("an event-day slot outside the selected weeks is a hard error, never a fallback anchor", () => {
    const p1 = phase({ id: "p1", durationWeeksMin: 1, durationWeeksMax: 4 });
    const input = baseInput({
      variantPhases: [p1],
      phaseSelections: [{ phaseDefinitionId: "p1", include: true, weeks: 2 }],
      days: [day({ id: "d1", phaseDefinitionId: "p1", weekNumber: 3, dayOfWeek: 7, isEventDay: true })],
      anchor: { kind: "targetEventDate", targetEventDate: "2027-02-14" },
    });
    const error = expectError(resolveProgramGeneration(input));
    expect(error).toMatch(/outside the 2 weeks/);
  });
});

describe("resolveProgramGeneration -- event-day anchoring", () => {
  it("an in-range event-day slot resolves startDate so that slot lands exactly on the target event date (daysBetween = 0)", () => {
    const p1 = phase({ id: "p1", durationWeeksMin: 2, durationWeeksMax: 2 });
    const input = baseInput({
      variantPhases: [p1],
      phaseSelections: [{ phaseDefinitionId: "p1", include: true, weeks: 2 }],
      days: [day({ id: "d1", phaseDefinitionId: "p1", weekNumber: 2, dayOfWeek: 7, isEventDay: true })], // last Sunday
      anchor: { kind: "targetEventDate", targetEventDate: "2027-03-14" }, // a real Sunday
    });
    const result = expectResult(resolveProgramGeneration(input));
    expect(result.days[0].scheduledDate).toBe("2027-03-14");
    expect(result.raceDayAlignment).not.toBeNull();
    expect(result.raceDayAlignment!.daysBetween).toBe(0);
    expect(result.raceDayAlignment!.eventDaySourceProgramDayId).toBe("d1");
  });

  it("with no event-day slot, daysBetween reflects a real, non-forced gap", () => {
    const p1 = phase({ id: "p1", durationWeeksMin: 2, durationWeeksMax: 2 });
    const input = baseInput({
      variantPhases: [p1],
      phaseSelections: [{ phaseDefinitionId: "p1", include: true, weeks: 2 }],
      days: [day({ id: "d1", phaseDefinitionId: "p1", weekNumber: 1, dayOfWeek: 1, plannedDistanceM: 5000 })],
      anchor: { kind: "targetEventDate", targetEventDate: "2027-03-10" }, // a Wednesday, not the final week's Monday
    });
    const result = expectResult(resolveProgramGeneration(input));
    expect(result.raceDayAlignment).not.toBeNull();
    expect(result.raceDayAlignment!.daysBetween).not.toBe(0);
    expect(result.raceDayAlignment!.eventDaySourceProgramDayId).toBeNull();
  });

  it("flags (never moves) an authored day that lands after the target event date", () => {
    const p1 = phase({ id: "p1", durationWeeksMin: 2, durationWeeksMax: 2 });
    const input = baseInput({
      variantPhases: [p1],
      phaseSelections: [{ phaseDefinitionId: "p1", include: true, weeks: 2 }],
      days: [
        day({ id: "d1", phaseDefinitionId: "p1", weekNumber: 2, dayOfWeek: 7, isEventDay: true }), // race day
        day({ id: "d2", phaseDefinitionId: "p1", weekNumber: 2, dayOfWeek: 1, plannedDistanceM: 3000 }), // before race day (Monday of week 2)
      ],
      anchor: { kind: "targetEventDate", targetEventDate: "2027-03-14" },
    });
    // Add a stray day the day AFTER race day by using a second phase.
    const p2 = phase({ id: "p2", phaseKey: "Cooldown", durationWeeksMin: 1, durationWeeksMax: 1 });
    input.variantPhases.push(p2);
    input.phaseSelections.push({ phaseDefinitionId: "p2", include: true, weeks: 1 });
    input.days.push(day({ id: "d3", phaseDefinitionId: "p2", weekNumber: 1, dayOfWeek: 1, plannedDistanceM: 2000 }));

    const result = expectResult(resolveProgramGeneration(input));
    const strayDay = result.days.find((d) => d.sourceProgramDayId === "d3")!;
    expect(strayDay.scheduledDate > "2027-03-14").toBe(true);
    expect(result.warnings.daysAfterEventDate).toContain("d3");
    // Still present in the normal output, never removed.
    expect(result.days.map((d) => d.sourceProgramDayId)).toContain("d3");
  });
});

describe("resolveProgramGeneration -- event-day defense in depth", () => {
  it("more than one day marked is_event_day is a hard error, never an arbitrary pick", () => {
    const input = baseInput({
      days: [
        day({ id: "d1", phaseDefinitionId: "p1", weekNumber: 1, dayOfWeek: 1, isEventDay: true }),
        day({ id: "d2", phaseDefinitionId: "p1", weekNumber: 2, dayOfWeek: 1, isEventDay: true }),
      ],
    });
    const error = expectError(resolveProgramGeneration(input));
    expect(error).toMatch(/more than one day marked as race day/);
  });
});

describe("resolveProgramGeneration -- calendar-date correctness (DST / year boundary)", () => {
  it("computes exact dates across a US DST transition (spring forward)", () => {
    // 2027-03-14 is a Sunday just after the US DST transition (2nd Sunday
    // of March = Mar 14, 2027) -- a naive local-time Date computation
    // could misfire by a day here if it weren't UTC-based throughout.
    const p1 = phase({ id: "p1", durationWeeksMin: 2, durationWeeksMax: 2 });
    const input = baseInput({
      variantPhases: [p1],
      phaseSelections: [{ phaseDefinitionId: "p1", include: true, weeks: 2 }],
      days: [day({ id: "d1", phaseDefinitionId: "p1", weekNumber: 2, dayOfWeek: 7, plannedDistanceM: 1000 })],
      anchor: { kind: "startDate", startDate: "2027-03-08", targetEventDate: null }, // spans the DST change
    });
    const result = expectResult(resolveProgramGeneration(input));
    expect(result.days[0].scheduledDate).toBe("2027-03-21");
    expect(result.endDate).toBe("2027-03-21");
  });

  it("computes exact dates across a year boundary", () => {
    const p1 = phase({ id: "p1", durationWeeksMin: 3, durationWeeksMax: 3 });
    const input = baseInput({
      variantPhases: [p1],
      phaseSelections: [{ phaseDefinitionId: "p1", include: true, weeks: 3 }],
      days: [day({ id: "d1", phaseDefinitionId: "p1", weekNumber: 3, dayOfWeek: 5, plannedDistanceM: 1000 })],
      anchor: { kind: "startDate", startDate: "2027-12-20", targetEventDate: null },
    });
    const result = expectResult(resolveProgramGeneration(input));
    expect(result.days[0].scheduledDate).toBe("2028-01-07");
  });
});

describe("resolveProgramGeneration -- week target volume", () => {
  it("derives a week's total from its own day distances when the program has no volume variants", () => {
    // Unchanged behavior for every hand-authored program, where the days
    // ARE the volume. 5000 m and 8000 m -> 3.1 and 5 miles.
    const result = expectResult(resolveProgramGeneration(baseInput()));
    expect(result.weeks.map((w) => w.targetVolumeMin)).toEqual([3.1, 5]);
    expect(result.weeks.every((w) => w.targetVolumeMax === null)).toBe(true);
  });

  it("prefers the selected variant's authored goal mileage over the summed day distances", () => {
    // The seeded frameworks author a weekly total the athlete distributes
    // themselves, and their days carry no distances at all -- summing them
    // would write 0 for every week.
    const result = expectResult(
      resolveProgramGeneration(
        baseInput({
          weekVolumes: [
            { phaseDefinitionId: "p1", weekNumber: 1, goalMileageMin: 40, goalMileageMax: null },
            { phaseDefinitionId: "p1", weekNumber: 2, goalMileageMin: 85, goalMileageMax: 90 },
          ],
        }),
      ),
    );
    expect(result.weeks[0]).toMatchObject({ targetVolumeMin: 40, targetVolumeMax: null });
    expect(result.weeks[1]).toMatchObject({ targetVolumeMin: 85, targetVolumeMax: 90 });
  });

  it("leaves a week with no prescribed total absent, not zero", () => {
    // Race week's authored goal mileage is "n/a".
    const result = expectResult(
      resolveProgramGeneration(
        baseInput({
          weekVolumes: [{ phaseDefinitionId: "p1", weekNumber: 2, goalMileageMin: null, goalMileageMax: null }],
        }),
      ),
    );
    // Week 1 has no authored row at all, so it still derives its total.
    expect(result.weeks[0].targetVolumeMin).toBe(3.1);
    // Week 2 is authored as "no total prescribed" -- it must not fall back
    // to the derived number, and must not become 0.
    expect(result.weeks[1].targetVolumeMin).toBeNull();
    expect(result.weeks[1].targetVolumeMax).toBeNull();
  });

  it("ignores authored goal mileage belonging to a different phase", () => {
    const result = expectResult(
      resolveProgramGeneration(
        baseInput({
          weekVolumes: [{ phaseDefinitionId: "other-phase", weekNumber: 1, goalMileageMin: 99, goalMileageMax: null }],
        }),
      ),
    );
    expect(result.weeks[0].targetVolumeMin).toBe(3.1);
  });
});

describe("resolveProgramGeneration -- week notes", () => {
  it("carries a week's authored notes through to the resolved week", () => {
    const result = expectResult(
      resolveProgramGeneration(
        baseInput({
          weekLabels: [{ phaseDefinitionId: "p1", weekNumber: 1, label: null, notes: "Down week -- back off and absorb the block before it." }],
        }),
      ),
    );
    expect(result.weeks[0].notes).toBe("Down week -- back off and absorb the block before it.");
    expect(result.weeks[1].notes).toBeNull();
  });

  it("leaves notes null for a week with no authored row, rather than inventing anything", () => {
    const result = expectResult(resolveProgramGeneration(baseInput()));
    expect(result.weeks.every((w) => w.notes === null)).toBe(true);
  });

  it("carries label and notes independently -- a week can have one without the other", () => {
    const result = expectResult(
      resolveProgramGeneration(
        baseInput({
          weekLabels: [
            { phaseDefinitionId: "p1", weekNumber: 1, label: "Peak Week", notes: null },
            { phaseDefinitionId: "p1", weekNumber: 2, label: null, notes: "A real narrative note with no short label." },
          ],
        }),
      ),
    );
    expect(result.weeks[0]).toMatchObject({ label: "Peak Week", notes: null });
    expect(result.weeks[1]).toMatchObject({ label: null, notes: "A real narrative note with no short label." });
  });

  it("ignores authored notes belonging to a different phase", () => {
    const result = expectResult(
      resolveProgramGeneration(
        baseInput({
          weekLabels: [{ phaseDefinitionId: "other-phase", weekNumber: 1, label: null, notes: "Not this program's note." }],
        }),
      ),
    );
    expect(result.weeks[0].notes).toBeNull();
  });
});

describe("resolveProgramGeneration -- optional sessions and alternatives", () => {
  it("carries a framework's optional flag and stated alternative onto the generated day, unscaled", () => {
    const result = expectResult(
      resolveProgramGeneration(
        baseInput({
          days: [
            day({
              id: "d1",
              phaseDefinitionId: "p1",
              weekNumber: 1,
              dayOfWeek: 1,
              plannedDistanceM: 5000,
              isOptional: true,
              alternativeText: "Single-workout alternative: 3 x 2 km at 103% MP with 2 min walk.",
            }),
          ],
          // Scaling on, to prove neither field is treated as a quantity.
          scalesDistanceWithMileage: true,
          targetPeakWeeklyMiles: 50,
        }),
      ),
    );
    expect(result.days[0].isOptional).toBe(true);
    expect(result.days[0].alternativeText).toBe("Single-workout alternative: 3 x 2 km at 103% MP with 2 min walk.");
  });

  it("leaves a day required when the program doesn't mark it optional", () => {
    const result = expectResult(resolveProgramGeneration(baseInput()));
    expect(result.days.every((d) => d.isOptional === false)).toBe(true);
    expect(result.days.every((d) => d.alternativeText === null)).toBe(true);
  });
});
