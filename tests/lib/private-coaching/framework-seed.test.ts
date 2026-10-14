import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildCrashCourseSeeds,
  buildFrameworkSeed,
  parseDifficulty,
  parseGoalMileage,
  phaseKeyFor,
  type RawCrashCourse,
  type RawFramework,
} from "@/lib/private-coaching/framework-seed";

const SEED_DIR = path.join(process.cwd(), "scripts/data/framework-seeds");

function loadFramework(key: string): RawFramework {
  return JSON.parse(readFileSync(path.join(SEED_DIR, `${key}.json`), "utf8")) as RawFramework;
}

describe("parseDifficulty", () => {
  it("keeps a whole-number rating as a point value, not a 1-wide range", () => {
    expect(parseDifficulty("7/10")).toEqual({ label: "7/10", rpeMin: 7, rpeMax: null });
    expect(parseDifficulty("10/10")).toEqual({ label: "10/10", rpeMin: 10, rpeMax: null });
  });

  it("widens a half point into the containing integer envelope rather than rounding it", () => {
    // 7.5 is neither 7 nor 8; 7..8 is wider than the source but never
    // narrower, and the verbatim label is what gets displayed.
    expect(parseDifficulty("7.5/10")).toEqual({ label: "7.5/10", rpeMin: 7, rpeMax: 8 });
    expect(parseDifficulty("9.5/10")).toEqual({ label: "9.5/10", rpeMin: 9, rpeMax: 10 });
  });

  it("parses integer and half-point ranges", () => {
    expect(parseDifficulty("6-7/10")).toEqual({ label: "6-7/10", rpeMin: 6, rpeMax: 7 });
    expect(parseDifficulty("8.5-9/10")).toEqual({ label: "8.5-9/10", rpeMin: 8, rpeMax: 9 });
    expect(parseDifficulty("9-9.5/10")).toEqual({ label: "9-9.5/10", rpeMin: 9, rpeMax: 10 });
  });

  it("accepts the en dash Peak and Summit use as a range separator", () => {
    expect(parseDifficulty("7.5–8/10")).toEqual({ label: "7.5–8/10", rpeMin: 7, rpeMax: 8 });
    expect(parseDifficulty("8–8.5/10")).toEqual({ label: "8–8.5/10", rpeMin: 8, rpeMax: 9 });
  });

  it("treats a missing or blank rating as no rating, not as zero", () => {
    expect(parseDifficulty(null)).toEqual({ label: null, rpeMin: null, rpeMax: null });
    expect(parseDifficulty(undefined)).toEqual({ label: null, rpeMin: null, rpeMax: null });
    expect(parseDifficulty("   ")).toEqual({ label: null, rpeMin: null, rpeMax: null });
  });

  it("refuses ratings it cannot represent rather than guessing", () => {
    expect(() => parseDifficulty("hard")).toThrow(/Unparseable difficulty/);
    expect(() => parseDifficulty("9-8/10")).toThrow(/runs backwards/);
    expect(() => parseDifficulty("11/10")).toThrow(/out of the 1-10 RPE range/);
    expect(() => parseDifficulty("0/10")).toThrow(/out of the 1-10 RPE range/);
  });

  it("parses every difficulty string that actually appears in the seed files", () => {
    const seen = new Set<string>();
    for (const key of ["canyon", "mesa", "ridge", "peak", "summit"]) {
      for (const week of loadFramework(key).weeks) {
        for (const day of week.days) {
          for (const session of day.sessions) {
            if (session.difficulty) seen.add(session.difficulty);
          }
        }
      }
    }
    expect(seen.size).toBeGreaterThan(20);
    for (const raw of seen) {
      const parsed = parseDifficulty(raw);
      expect(parsed.label).toBe(raw);
      expect(parsed.rpeMin).toBeGreaterThanOrEqual(1);
      expect(parsed.rpeMin).toBeLessThanOrEqual(10);
      if (parsed.rpeMax != null) expect(parsed.rpeMax).toBeGreaterThan(parsed.rpeMin!);
    }
  });
});

describe("parseGoalMileage", () => {
  it("parses a plain total and a range", () => {
    expect(parseGoalMileage("70")).toEqual({ label: "70", min: 70, max: null });
    expect(parseGoalMileage("85-90")).toEqual({ label: "85-90", min: 85, max: 90 });
    expect(parseGoalMileage("95–105")).toEqual({ label: "95–105", min: 95, max: 105 });
  });

  it("strips the unit the crash course carries", () => {
    expect(parseGoalMileage("25 mi")).toEqual({ label: "25 mi", min: 25, max: null });
  });

  it("preserves race week's 'n/a' as an authored value with no numeric target", () => {
    // Race week prescribes no weekly total at all -- this must not become 0
    // or a silently dropped row.
    expect(parseGoalMileage("n/a")).toEqual({ label: "n/a", min: null, max: null });
  });

  it("refuses values it cannot represent", () => {
    expect(() => parseGoalMileage("about fifty")).toThrow(/Unparseable goal mileage/);
    expect(() => parseGoalMileage("90-80")).toThrow(/runs backwards/);
    expect(() => parseGoalMileage("")).toThrow(/empty/);
  });
});

describe("phaseKeyFor", () => {
  it("title-cases to match the existing Canyon seed's phase_key values", () => {
    expect(phaseKeyFor("general")).toBe("General");
    expect(phaseKeyFor("supportive")).toBe("Supportive");
    expect(phaseKeyFor("specific")).toBe("Specific");
  });
});

describe("buildFrameworkSeed", () => {
  // The framework parameters Prompt 11 Part D2 specifies, asserted against
  // the real seed files so a bad re-transcription fails here rather than
  // silently seeding wrong methodology.
  const EXPECTED = {
    canyon: { phases: [10, 4, 4], variants: ["canyon-40", "canyon-50"], peak: [40, 50], initial: [25, 34], sessions: 126 },
    mesa: { phases: [8, 5, 5], variants: ["mesa-55", "mesa-65"], peak: [55, 65], initial: [40, 45], sessions: 126 },
    ridge: { phases: [7, 5, 6], variants: ["ridge-70", "ridge-80"], peak: [70, 80], initial: [50, 55], sessions: 156 },
    peak: { phases: [6, 6, 6], variants: ["peak-85", "peak-95"], peak: [85, 95], initial: [60, 65], sessions: 181 },
    summit: {
      phases: [6, 5, 7],
      variants: ["summit-100", "summit-110", "summit-120"],
      peak: [100, 110, 120],
      initial: [70, 77, 85],
      sessions: 211,
    },
  } as const;

  for (const [key, expected] of Object.entries(EXPECTED)) {
    describe(key, () => {
      const plan = buildFrameworkSeed(loadFramework(key));

      it("lays out General/Supportive/Specific with the specified week counts", () => {
        expect(plan.phases.map((p) => p.phaseKey)).toEqual(["General", "Supportive", "Specific"]);
        expect(plan.phases.map((p) => p.durationWeeksMin)).toEqual([...expected.phases]);
        // A seeded framework's phases are fixed-length, not a range.
        expect(plan.phases.map((p) => p.durationWeeksMax)).toEqual([...expected.phases]);
        expect(plan.phases.reduce((n, p) => n + p.durationWeeksMin, 0)).toBe(18);
      });

      it("creates one 18-week duration variant and the specified peak-volume variants", () => {
        expect(plan.durationVariantName).toBe("18-Week");
        expect(plan.volumeVariants.map((v) => v.variantKey)).toEqual([...expected.variants]);
        expect(plan.volumeVariants.map((v) => v.peakMileage)).toEqual([...expected.peak]);
        expect(plan.volumeVariants.map((v) => v.initialMileage)).toEqual([...expected.initial]);
      });

      it("pre-selects no peak-volume variant, leaving the choice to the coach", () => {
        expect(plan.volumeVariants.every((v) => !v.isDefault)).toBe(true);
      });

      it("spans the program-wide mileage range across every variant", () => {
        expect(plan.program.peakMileageMin).toBe(Math.min(...expected.peak));
        expect(plan.program.peakMileageMax).toBe(Math.max(...expected.peak));
        expect(plan.program.initialMileageMin).toBe(Math.min(...expected.initial));
        expect(plan.program.initialMileageMax).toBe(Math.max(...expected.initial));
      });

      it("authors every session, including both halves of a double", () => {
        expect(plan.days.length).toBe(expected.sessions);
        // 18 weeks x 7 days of real day slots, regardless of doubles.
        const slots = new Set(plan.days.map((d) => `${d.phaseKey}:${d.weekNumber}:${d.dayOfWeek}`));
        expect(slots.size).toBe(126);
      });

      it("keys days Monday-first, 1..7, within phase-relative weeks", () => {
        for (const day of plan.days) {
          expect(day.dayOfWeek).toBeGreaterThanOrEqual(1);
          expect(day.dayOfWeek).toBeLessThanOrEqual(7);
          expect(day.weekNumber).toBeGreaterThanOrEqual(1);
        }
        const phaseLengths = new Map(plan.phases.map((p) => [p.phaseKey, p.durationWeeksMin]));
        for (const day of plan.days) {
          expect(day.weekNumber).toBeLessThanOrEqual(phaseLengths.get(day.phaseKey)!);
        }
      });

      it("stores prescription text verbatim and never empty", () => {
        for (const day of plan.days) {
          expect(day.notes.trim().length).toBeGreaterThan(0);
        }
      });

      it("records a goal mileage for every week of every variant", () => {
        expect(plan.phaseWeekVolumes.length).toBe(18 * expected.variants.length);
        for (const variant of expected.variants) {
          expect(plan.phaseWeekVolumes.filter((v) => v.variantKey === variant).length).toBe(18);
        }
      });

      it("labels exactly 18 phase weeks and flags the fitness-estimate checkpoints", () => {
        expect(plan.phaseWeeks.length).toBe(18);
        expect(plan.phaseWeeks.filter((w) => w.reviseFitnessEstimate).length).toBeGreaterThan(0);
      });

      it("carries the source attribution and event distance onto the program", () => {
        expect(plan.program.frameworkKey).toBe(key);
        expect(plan.program.eventDistance).toBe("marathon");
        expect(plan.program.sourceReference).toMatch(/Marathon Excellence/);
      });

      it("never stores any source plan name in any stored field", () => {
        // Breeze/Wind/Gale/Tornado/Hurricane are build references that live
        // only in each seed file's own source_plan_name -- Part D2 forbids
        // them being stored as names or appearing in the UI. Checked
        // against ALL FIVE names, not just this framework's own, and across
        // every field the loader writes, including coach-visible week notes
        // and day prescriptions (peak.json week 8 shipped with "Tornado" in
        // its note -- see scripts/data/framework-seeds/README.md).
        expect(loadFramework(key).source_plan_name).toBeTruthy();
        const stored = [
          plan.program.name,
          plan.program.description,
          plan.program.recommendedFor ?? "",
          plan.program.typicalGoalTimes ?? "",
          ...plan.volumeVariants.map((v) => v.name),
          ...plan.phases.map((p) => p.notes ?? ""),
          ...plan.phaseWeeks.map((w) => w.notes ?? ""),
          ...plan.days.map((d) => d.notes),
          ...plan.days.map((d) => d.alternativeText ?? ""),
        ].join("\n");
        for (const sourcePlanName of ["Breeze", "Wind", "Gale", "Tornado", "Hurricane"]) {
          expect(stored).not.toMatch(new RegExp(`\\b${sourcePlanName}\\b`));
        }
      });
    });
  }

  it("names the program after the framework, never the source plan", () => {
    expect(buildFrameworkSeed(loadFramework("peak")).program.name).toBe("Peak");
    expect(buildFrameworkSeed(loadFramework("summit")).program.name).toBe("Summit");
  });

  it("maps AM and PM sessions onto the same day slot with distinct slots", () => {
    const plan = buildFrameworkSeed(loadFramework("summit"));
    const sameSlot = plan.days.filter((d) => d.phaseKey === "General" && d.weekNumber === 1 && d.dayOfWeek === 2);
    expect(sameSlot.map((d) => d.sessionSlot).sort()).toEqual(["AM", "PM"]);
  });

  it("stores a single-session day with a null slot", () => {
    const plan = buildFrameworkSeed(loadFramework("canyon"));
    expect(plan.days.every((d) => d.sessionSlot === null)).toBe(true);
  });

  it("preserves optional flags and single-session alternatives verbatim", () => {
    const plan = buildFrameworkSeed(loadFramework("peak"));
    expect(plan.days.filter((d) => d.isOptional).length).toBe(25);
    const alternatives = plan.days.filter((d) => d.alternativeText != null);
    expect(alternatives.length).toBe(3);
    expect(alternatives.some((d) => /single-threshold alternative/i.test(d.alternativeText!))).toBe(true);
    expect(alternatives.some((d) => /single-workout alternative/i.test(d.alternativeText!))).toBe(true);
  });

  it("leaves every seeded day prose-only, with no day-level pace percent", () => {
    // See this module's header: these transcriptions bundle warm-up and
    // cool-down into the same string, so a day-level percent would
    // misattribute the main set's pace to the whole workout.
    for (const key of Object.keys(EXPECTED)) {
      const plan = buildFrameworkSeed(loadFramework(key));
      expect(Object.keys(plan.days[0])).not.toContain("pacePercentBasis");
    }
  });

  describe("structural validation", () => {
    function mutate(key: string, fn: (raw: RawFramework) => void): RawFramework {
      const raw = loadFramework(key);
      fn(raw);
      return raw;
    }

    it("rejects a week that is not seven days", () => {
      expect(() => buildFrameworkSeed(mutate("canyon", (r) => r.weeks[0].days.pop()))).toThrow(/expected 7/);
    });

    it("rejects a week whose declared phase disagrees with the phase list", () => {
      expect(() => buildFrameworkSeed(mutate("canyon", (r) => { r.weeks[0].phase = "specific"; }))).toThrow(
        /says phase "specific"/,
      );
    });

    it("rejects a variant missing a goal mileage for some week", () => {
      expect(() => buildFrameworkSeed(mutate("canyon", (r) => { delete r.weeks[3].goal_mileage["canyon-40"]; }))).toThrow(
        /no goal mileage for variant canyon-40/,
      );
    });

    it("rejects a duration that disagrees with the authored weeks", () => {
      expect(() => buildFrameworkSeed(mutate("canyon", (r) => { r.duration_weeks = 12; }))).toThrow(/duration_weeks is 12/);
    });

    it("rejects two phases claiming the same week", () => {
      expect(() => buildFrameworkSeed(mutate("canyon", (r) => { r.phases[1].weeks.push(1); }))).toThrow(
        /claimed by more than one phase/,
      );
    });

    it("rejects a day repeating the same session slot", () => {
      expect(() =>
        buildFrameworkSeed(
          mutate("summit", (r) => {
            r.weeks[0].days[1].sessions = [
              { slot: "AM", workout: "a", difficulty: null },
              { slot: "AM", workout: "b", difficulty: null },
            ];
          }),
        ),
      ).toThrow(/repeats the AM slot/);
    });

    it("rejects a day with no sessions", () => {
      expect(() => buildFrameworkSeed(mutate("canyon", (r) => { r.weeks[0].days[0].sessions = []; }))).toThrow(
        /has no sessions/,
      );
    });
  });
});

describe("buildCrashCourseSeeds", () => {
  const raw = JSON.parse(readFileSync(path.join(SEED_DIR, "crash-course.json"), "utf8")) as RawCrashCourse;
  const plans = buildCrashCourseSeeds(raw);

  it("produces one assignable program per level, not one program with three variants", () => {
    // A coach assigns exactly one level; the levels are alternatives
    // matched to current mileage, not variants of a shared prescription.
    expect(plans.length).toBe(3);
    expect(plans.map((p) => p.program.frameworkKey)).toEqual([
      "crash-course-i",
      "crash-course-ii",
      "crash-course-iii",
    ]);
    expect(plans.map((p) => p.program.name)).toEqual([
      "5K Crash Course - Level I",
      "5K Crash Course - Level II",
      "5K Crash Course - Level III",
    ]);
  });

  it("is a four-week 5K program, not a marathon framework", () => {
    for (const plan of plans) {
      expect(plan.program.eventDistance).toBe("5k");
      expect(plan.durationVariantName).toBe("4-Week");
      expect(plan.phases).toHaveLength(1);
      expect(plan.phases[0].durationWeeksMin).toBe(4);
      expect(plan.days.length).toBe(28);
      expect(plan.phaseWeeks.length).toBe(4);
    }
  });

  it("derives each level's mileage from its real weekly totals", () => {
    // Level I climbs 25 -> 28; Level III holds 40 throughout.
    expect(plans[0].volumeVariants[0]).toMatchObject({ name: "25 mi/wk", initialMileage: 25, peakMileage: 28 });
    expect(plans[1].volumeVariants[0]).toMatchObject({ name: "32 mi/wk", initialMileage: 32, peakMileage: 35 });
    expect(plans[2].volumeVariants[0]).toMatchObject({ name: "40 mi/wk", initialMileage: 40, peakMileage: 40 });
  });

  it("carries the effort-guideline table as the program's pacing glossary", () => {
    for (const plan of plans) {
      expect(plan.program.glossaryTerms).toEqual([
        "Very easy - Relaxing recovery run",
        "Easy - Normal training run",
        "Moderate - An uptempo run with smooth, rhythmic breathing",
        "Strong - Marathon to half marathon pace",
        "Fast - About 5k pace",
        "Very fast - About 3k / two-mile pace, ~5% faster than 5k pace",
      ]);
    }
  });

  it("puts the culminating 5K and the estimate checkpoint on week 4 only", () => {
    for (const plan of plans) {
      const flagged = plan.phaseWeeks.filter((w) => w.reviseFitnessEstimate);
      expect(flagged.map((w) => w.weekNumber)).toEqual([4]);
      expect(plan.phaseWeeks[3].notes).toMatch(/initial 5K fitness estimate/i);
      // Earlier weeks genuinely have no per-week commentary in the source.
      expect(plan.phaseWeeks.slice(0, 3).every((w) => w.notes === null)).toBe(true);
    }
  });

  it("authors the week-4 Saturday 5K at 10/10", () => {
    for (const plan of plans) {
      const saturday = plan.days.find((d) => d.weekNumber === 4 && d.dayOfWeek === 6)!;
      expect(saturday.notes).toBe("5k race");
      expect(saturday.difficultyLabel).toBe("10/10");
      expect(saturday.plannedRpe).toBe(10);
    }
  });

  it("keeps every day a single session with no slot", () => {
    for (const plan of plans) {
      expect(plan.days.every((d) => d.sessionSlot === null)).toBe(true);
      expect(plan.days.every((d) => !d.isOptional && d.alternativeText === null)).toBe(true);
    }
  });

  it("stores rest days verbatim rather than dropping them", () => {
    const offDays = plans[0].days.filter((d) => d.notes === "Off");
    expect(offDays.length).toBeGreaterThan(0);
    expect(offDays.every((d) => d.difficultyLabel === null && d.plannedRpe === null)).toBe(true);
  });

  it("rejects a level that is not four weeks", () => {
    const mutated = JSON.parse(JSON.stringify(raw)) as RawCrashCourse;
    mutated.levels[0].weeks.pop();
    expect(() => buildCrashCourseSeeds(mutated)).toThrow(/3 weeks authored, expected 4/);
  });

  it("rejects a week that is not seven days", () => {
    const mutated = JSON.parse(JSON.stringify(raw)) as RawCrashCourse;
    mutated.levels[1].weeks[0].days.pop();
    expect(() => buildCrashCourseSeeds(mutated)).toThrow(/expected 7/);
  });
});
