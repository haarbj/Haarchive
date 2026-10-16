import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { structureSession, structureFramework, attachFrameworkStructure } from "@/lib/private-coaching/framework-structure";
import { buildFrameworkSeed, type RawFramework } from "@/lib/private-coaching/framework-seed";

const SEED_DIR = path.join(process.cwd(), "scripts/data/framework-seeds");
const FRAMEWORK_KEYS = ["canyon", "mesa", "ridge", "peak", "summit"];

describe("structureSession", () => {
  it("resolves a plain easy range with no pace", () => {
    const { structured, worksheetQuestion } = structureSession("4–5 mi easy");
    expect(structured).toEqual({ distanceMiMin: 4, distanceMiMax: 5, steps: null });
    expect(worksheetQuestion).toBeNull();
  });

  it("sums a progression + cool-down into one total, matching the task's own worked example", () => {
    const { structured } = structureSession("5 mi Kenyan-style progression run + 0.5 mi easy cool-down");
    expect(structured).toEqual({ distanceMiMin: 5.5, distanceMiMax: 5.5, steps: null });
  });

  it("ignores strides -- they never add distance", () => {
    const { structured } = structureSession("4-5 mi easy with 4 x 20 sec strides");
    expect(structured.distanceMiMin).toBe(4);
    expect(structured.distanceMiMax).toBe(5);
  });

  it("treats a continuation clause split across a newline the same as a '+' on one line", () => {
    const { structured } = structureSession("8 mi relaxed Kenyan-style progression run\n+ 1 mi easy cool-down");
    expect(structured).toEqual({ distanceMiMin: 9, distanceMiMax: 9, steps: null });
  });

  it("leaves 'Off' at null, not on the worksheet", () => {
    const { structured, worksheetQuestion } = structureSession("Off");
    expect(structured).toEqual({ distanceMiMin: null, distanceMiMax: null, steps: null });
    expect(worksheetQuestion).toBeNull();
  });

  it("leaves 'Off or X mi' at null -- asserting X would overcount the athlete's choice", () => {
    const { structured, worksheetQuestion } = structureSession("Off or 3-5 mi easy");
    expect(structured).toEqual({ distanceMiMin: null, distanceMiMax: null, steps: null });
    expect(worksheetQuestion).toBeNull();
  });

  it("flags a conditional alternative prescription to the worksheet rather than summing both branches", () => {
    const { structured, worksheetQuestion } = structureSession(
      "8 mi Kenyan-style progression run + 1 mi easy cool-down (if marathon is on a Sunday), or: 8 mi easy progressing to moderate (if marathon is on a Saturday)",
    );
    expect(structured.distanceMiMin).toBeNull();
    expect(worksheetQuestion).not.toBeNull();
  });

  it("adds the marathon's own distance on race day, plus any stated warm-up", () => {
    const { structured } = structureSession("1 mi progressive warm-up + 4 strides\nMarathon race");
    expect(structured.distanceMiMin).toBe(27.2);
    expect(structured.distanceMiMax).toBe(27.2);
  });

  it("resolves a continuous warm-up/main/cool-down structure stated entirely in miles", () => {
    const { structured, worksheetQuestion } = structureSession("2 mi progressive warm-up + 4 strides / 7 mi at 85% 5k / 2 mi easy cool-down");
    expect(structured.distanceMiMin).toBe(11);
    expect(structured.distanceMiMax).toBe(11);
    expect(structured.steps).toHaveLength(3);
    expect(structured.steps?.[1]).toMatchObject({ stepType: "main", targetPacePercentBasis: "5k", targetPacePercentMin: 85, targetPacePercentMax: null });
    expect(worksheetQuestion).toBeNull();
  });

  it("converts a km main segment to miles rounded to one decimal, matching the task's own worked example", () => {
    const { structured } = structureSession("1.5 mi progressive warm-up + 4 strides\n4 km at 110% MP\n0.5 mi easy cool-down");
    expect(structured.distanceMiMin).toBe(4.5);
    expect(structured.steps?.[1].distanceM).toBeCloseTo(2.5 * 1609.344, 1);
  });

  it("sums a chain of continuous MP-progression segments stated in miles", () => {
    const { structured } = structureSession("1 mi progressive warm-up + 4 strides\n6 mi at 90% MP\n5 mi at 92% MP\n5 mi at 94% MP\n4-5 mi at 96% MP");
    expect(structured.distanceMiMin).toBe(1 + 6 + 5 + 5 + 4);
    expect(structured.distanceMiMax).toBe(1 + 6 + 5 + 5 + 5);
    expect(structured.steps).toHaveLength(5);
  });

  it("populates step-level pace/duration/reps/rest for a time-based main set but leaves the day total permanently null, not a worksheet question", () => {
    const { structured, worksheetQuestion } = structureSession(
      "2 mi progressive warm-up + 4 strides / 10 x 3 min at 90-92% 5k pace with 45 sec jog / 2 mi easy cool-down",
    );
    expect(structured.distanceMiMin).toBeNull();
    expect(structured.steps).toHaveLength(3);
    const main = structured.steps?.[1];
    expect(main).toMatchObject({ stepType: "interval", durationS: 180, repetitions: 10, restS: 45, targetPacePercentBasis: "5k", targetPacePercentMin: 90, targetPacePercentMax: 92 });
    // Depends on the athlete's own fitness estimate -- no single number is
    // right for every athlete, so this isn't something to ask Brody for.
    expect(worksheetQuestion).toBeNull();
  });

  it("resolves distance-based reps fully, since no pace assumption is needed", () => {
    const { structured, worksheetQuestion } = structureSession(
      "1 mi progressive warm-up + 4 strides\n8 x 1 km at 103-105% MP with 2 min jog\n0.5 mi easy cool-down",
    );
    expect(structured.distanceMiMin).not.toBeNull();
    expect(structured.steps?.[1]).toMatchObject({ stepType: "interval", repetitions: 8, targetPacePercentMin: 103, targetPacePercentMax: 105 });
    expect(worksheetQuestion).toBeNull();
  });

  it("falls through to the worksheet for a nested multi-set structure rather than guessing", () => {
    const { structured, worksheetQuestion } = structureSession(
      "1.5 mi progressive warm-up + 4 strides\n4 sets of:\n3 min at 98% 5k, 1 min jog\n2 min at 100% 5k, 1 min jog\n1 min at 102% 5k, 3 min jog\n1.5 mi easy cool-down",
    );
    expect(structured).toEqual({ distanceMiMin: null, distanceMiMax: null, steps: null });
    expect(worksheetQuestion).not.toBeNull();
  });

  it("falls through to the worksheet for a hybrid distance/time chain rather than guessing", () => {
    const { structured, worksheetQuestion } = structureSession(
      "1.5 mi progressive warm-up + 4 strides\n4 km at 101% MP, 2 min walk, 1 km at 105% MP, 2 min walk\n2 mi easy cool-down",
    );
    expect(structured.distanceMiMin).toBeNull();
    expect(worksheetQuestion).not.toBeNull();
  });
});

describe("structureFramework", () => {
  const rawFixture: RawFramework = {
    framework: "fixture",
    source: "test fixture",
    distance: "marathon",
    duration_weeks: 1,
    variants: [{ id: "fixture-40", peak_mileage: 40, initial_mileage: 25 }],
    phases: [{ name: "general", weeks: [1] }],
    weeks: [
      {
        week: 1,
        phase: "general",
        goal_mileage: { "fixture-40": "25-30" },
        days: [
          { day: "M", sessions: [{ slot: "single", workout: "4-5 mi easy", difficulty: null }] },
          { day: "T", sessions: [{ slot: "single", workout: "Off", difficulty: null }] },
          { day: "W", sessions: [{ slot: "single", workout: "2 mi progressive warm-up + 4 strides / 7 mi at 85% 5k / 2 mi easy cool-down", difficulty: "7-8/10" }] },
          { day: "T", sessions: [{ slot: "single", workout: "Off or 3-5 mi very easy", difficulty: null }] },
          { day: "F", sessions: [{ slot: "single", workout: "5-7 mi easy", difficulty: null }] },
          { day: "S", sessions: [{ slot: "single", workout: "10-11 mi easy through rolling hills", difficulty: "5/10" }] },
          { day: "S", sessions: [{ slot: "single", workout: "Off", difficulty: null }] },
        ],
      },
    ],
  };

  it("produces one structured result per raw session, in the same traversal order buildFrameworkSeed uses", () => {
    const { structured, worksheet } = structureFramework(rawFixture);
    expect(structured).toHaveLength(7);
    expect(worksheet).toHaveLength(0);
    expect(structured[0]).toEqual({ distanceMiMin: 4, distanceMiMax: 5, steps: null });
    expect(structured[2].distanceMiMin).toBe(11);
    expect(structured[2].steps).toHaveLength(3);
  });

  it("attachFrameworkStructure merges by index without altering buildFrameworkSeed's own output shape", () => {
    const plan = buildFrameworkSeed(rawFixture);
    const { plan: enriched, worksheet } = attachFrameworkStructure(plan, rawFixture);
    expect(worksheet).toHaveLength(0);
    expect(enriched.days).toHaveLength(plan.days.length);
    expect(enriched.days[0].notes).toBe(plan.days[0].notes);
    expect(enriched.days[0].distanceMiMin).toBe(4);
    expect(enriched.days[2].distanceMiMin).toBe(11);
    expect(enriched.days[2].steps).toHaveLength(3);
    // Every other SeedDay field survives the merge untouched.
    expect(enriched.days[2].difficultyLabel).toBe(plan.days[2].difficultyLabel);
  });

  it("throws if the structured array and buildFrameworkSeed's days array ever disagree in length", () => {
    const plan = buildFrameworkSeed(rawFixture);
    const mismatched = { ...plan, days: plan.days.slice(1) };
    expect(() => attachFrameworkStructure(mismatched, rawFixture)).toThrow(/traversal mismatch/);
  });
});

describe("coverage over the real seed files", () => {
  it("gives every real session either a distance, a deliberate off/off-or null, or a worksheet entry -- never a silent gap", () => {
    let total = 0;
    for (const key of FRAMEWORK_KEYS) {
      const raw = JSON.parse(readFileSync(path.join(SEED_DIR, `${key}.json`), "utf8")) as RawFramework;
      for (const week of raw.weeks) {
        for (const day of week.days) {
          for (const session of day.sessions) {
            total++;
            const { structured, worksheetQuestion } = structureSession(session.workout);
            const isDeliberateNull = /^off\.?$/i.test(session.workout.trim()) || /^off\s+or\b/i.test(session.workout.trim());
            const accountedFor = structured.distanceMiMin != null || structured.steps != null || worksheetQuestion != null || isDeliberateNull;
            expect(accountedFor, `unaccounted session: ${JSON.stringify(session.workout)}`).toBe(true);
          }
        }
      }
    }
    expect(total).toBe(800);
  });

  it("never computes an implausible distance (<=0 or >35mi) for any real session", () => {
    for (const key of FRAMEWORK_KEYS) {
      const raw = JSON.parse(readFileSync(path.join(SEED_DIR, `${key}.json`), "utf8")) as RawFramework;
      for (const week of raw.weeks) {
        for (const day of week.days) {
          for (const session of day.sessions) {
            const { structured } = structureSession(session.workout);
            if (structured.distanceMiMin != null) {
              expect(structured.distanceMiMin).toBeGreaterThan(0);
              expect(structured.distanceMiMin).toBeLessThanOrEqual(35);
            }
            if (structured.distanceMiMax != null) {
              expect(structured.distanceMiMax).toBeGreaterThanOrEqual(structured.distanceMiMin ?? 0);
            }
          }
        }
      }
    }
  });
});
