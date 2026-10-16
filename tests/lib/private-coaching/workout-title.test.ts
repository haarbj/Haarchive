import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { classifyWorkoutTitle, type TitleStep } from "@/lib/private-coaching/workout-title";
import { structureFramework } from "@/lib/private-coaching/framework-structure";
import { buildRecoveryProgramSeed, recoveryWorksheetEntries } from "@/lib/private-coaching/post-race";
import type { RawFramework } from "@/lib/private-coaching/framework-seed";

const SEED_DIR = path.join(process.cwd(), "scripts/data/framework-seeds");
const FRAMEWORK_KEYS = ["canyon", "mesa", "ridge", "peak", "summit"];

function loadRaw(key: string): RawFramework {
  return JSON.parse(readFileSync(path.join(SEED_DIR, `${key}.json`), "utf8")) as RawFramework;
}

describe("classifyWorkoutTitle -- never returns 'Workout'", () => {
  it("never returns the literal string 'Workout' for any real session across all five frameworks", () => {
    for (const key of FRAMEWORK_KEYS) {
      const raw = loadRaw(key);
      const { structured } = structureFramework(raw);
      let i = 0;
      for (const week of raw.weeks) {
        for (const day of week.days) {
          for (const session of day.sessions) {
            const s = structured[i++];
            const title = classifyWorkoutTitle({ notes: session.workout, distanceMiMin: s.distanceMiMin, steps: s.steps as TitleStep[] | null });
            expect(title, `${key}: ${JSON.stringify(session.workout)} -> "${title}"`).not.toBe("Workout");
            expect(title.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("never returns 'Workout' for any of the 42 recovery program days", () => {
    const plan = buildRecoveryProgramSeed();
    for (const day of plan.days) {
      const title = classifyWorkoutTitle({ notes: day.notes, distanceMiMin: day.distanceMiMin ?? null, steps: (day.steps ?? null) as TitleStep[] | null });
      expect(title, `${JSON.stringify(day.notes)} -> "${title}"`).not.toBe("Workout");
    }
  });
});

describe("classifyWorkoutTitle -- representative sessions per framework", () => {
  it("canyon: plain easy, very easy, off, off-or, race", () => {
    expect(classifyWorkoutTitle({ notes: "4–5 mi easy", distanceMiMin: 4, steps: null })).toBe("Easy");
    expect(classifyWorkoutTitle({ notes: "4–6 mi very easy", distanceMiMin: 4, steps: null })).toBe("Very Easy");
    expect(classifyWorkoutTitle({ notes: "Off", distanceMiMin: null, steps: null })).toBe("Off");
    expect(classifyWorkoutTitle({ notes: "Off or 3–5 mi easy", distanceMiMin: null, steps: null })).toBe("Off or Easy");
    expect(classifyWorkoutTitle({ notes: "1 mi progressive warm-up + 4 strides\nMarathon race", distanceMiMin: 27.2, steps: null })).toBe("Race");
  });

  it("canyon: Kenyan-style progression run, with and without strides/distance qualifiers", () => {
    expect(classifyWorkoutTitle({ notes: "5 mi Kenyan-style progression run + 0.5 mi easy cool-down", distanceMiMin: 5.5, steps: null })).toBe(
      "Kenyan Progression Run",
    );
  });

  it("canyon: easy with strides is its own named category, distinct from plain easy", () => {
    expect(classifyWorkoutTitle({ notes: "4–5 mi easy with 4 × 20 sec strides", distanceMiMin: 4, steps: null })).toBe("Easy + Strides");
  });

  it("canyon: time-based reps with a real rest duration -> Intervals", () => {
    const steps: TitleStep[] = [
      { stepType: "warmup" },
      { stepType: "interval", targetPacePercentBasis: "5k", targetPacePercentMin: 100, repetitions: 10, restS: 60 },
      { stepType: "cooldown" },
    ];
    expect(classifyWorkoutTitle({ notes: "1 mi progressive warm-up + 4 strides\n10 x 1.5 min at 100% 5k with 1 min jog\n0.5 mi easy cool-down", distanceMiMin: null, steps })).toBe(
      "Intervals",
    );
  });

  it("canyon: float-recovery alternating distance reps (no rest_s on either leg) -> Cruise Intervals", () => {
    const steps: TitleStep[] = [
      { stepType: "warmup" },
      { stepType: "interval", targetPacePercentBasis: "5k", targetPacePercentMin: 90, targetPacePercentMax: 92, repetitions: 4, restS: null },
      { stepType: "interval", targetPacePercentBasis: "5k", targetPacePercentMin: 75, repetitions: 4, restS: null },
      { stepType: "cooldown" },
    ];
    expect(
      classifyWorkoutTitle({
        notes: "1.5 mi progressive warm-up + 4 strides\n4–5 sets of (1200m at 90–92% 5k, 400m at 75% 5k)\n1 mi easy cool-down",
        distanceMiMin: 6.1,
        steps,
      }),
    ).toBe("Cruise Intervals");
  });

  it("canyon: a long run (>=10mi) with no percent at all -> Easy LR", () => {
    expect(classifyWorkoutTitle({ notes: "10–11 mi easy through rolling hills", distanceMiMin: 10, steps: null })).toBe("Easy LR");
  });

  it("canyon: a long run with a sub-85% continuous percent -> Moderate LR, not Quality", () => {
    const steps: TitleStep[] = [{ stepType: "warmup" }, { stepType: "main", targetPacePercentBasis: "5k", targetPacePercentMin: 75 }, { stepType: "cooldown" }];
    expect(classifyWorkoutTitle({ notes: "1 mi progressive warm-up + 4 strides\n9 mi at 70–75% 5k\nNo cool-down", distanceMiMin: 10, steps })).toBe(
      "Moderate LR",
    );
  });

  it("canyon: a long run at 90-92% MP -> Quality LR (the task's own 'MP-or-faster' anchor case)", () => {
    const steps: TitleStep[] = [{ stepType: "warmup" }, { stepType: "main", targetPacePercentBasis: "marathon", targetPacePercentMin: 90, targetPacePercentMax: 92 }, { stepType: "cooldown" }];
    expect(classifyWorkoutTitle({ notes: "1 mi progressive warm-up + 4 strides\n15–16 mi at 90–92% MP\nNo cool-down", distanceMiMin: 17, steps })).toBe(
      "Quality LR",
    );
  });

  it("canyon: a multi-segment MP-progression chain, not a long run -> MP Progression", () => {
    const steps: TitleStep[] = [
      { stepType: "warmup" },
      { stepType: "main", targetPacePercentBasis: "marathon", targetPacePercentMin: 108 },
      { stepType: "main", targetPacePercentBasis: "marathon", targetPacePercentMin: 109 },
      { stepType: "cooldown" },
    ];
    expect(classifyWorkoutTitle({ notes: "3 km at 108% MP, 4 min walk/jog\n2 km at 109% MP, 4 min walk/jog", distanceMiMin: 7, steps })).toBe(
      "MP Progression",
    );
  });

  it("canyon: a single continuous tempo segment, not a long run -> Steady State", () => {
    const steps: TitleStep[] = [{ stepType: "warmup" }, { stepType: "main", targetPacePercentBasis: "5k", targetPacePercentMin: 85 }, { stepType: "cooldown" }];
    expect(classifyWorkoutTitle({ notes: "1 mi progressive warm-up + 4 strides\n4 mi at 85% 5k\n0.5 mi easy cool-down", distanceMiMin: 5.5, steps })).toBe(
      "Steady State",
    );
  });

  it("mesa: an embedded-fartlek easy run, not a long run -> Fartlek", () => {
    expect(
      classifyWorkoutTitle({ notes: "6-8 mi easy with 28 min of (1 min at ~95% 5k effort, 3 min easy) in the middle", distanceMiMin: 6, steps: null }),
    ).toBe("Fartlek");
  });

  it("ridge: moderate progressing to strong, not a long run -> Strong (reads by its own ending tier)", () => {
    expect(classifyWorkoutTitle({ notes: "5–6 mi moderate progressing to strong", distanceMiMin: 5, steps: null })).toBe("Strong");
  });

  it("recovery program: uphill fast reps -> Hill Repeats", () => {
    expect(
      classifyWorkoutTitle({ notes: "8-12 x 1 min fast uphill (~115% of marathon pace effort), easy jog down (can do on flat ground)", distanceMiMin: null, steps: null }),
    ).toBe("Hill Repeats");
  });

  it("recovery program: timed repeats at a percent of marathon pace -> Intervals, not Easy -- even with a trailing warm-up/cool-down note containing the word 'easy'", () => {
    // T21.2 Week 4 Tuesday. Before this fix, the trailing "...1-2 mi easy
    // cool-down" text outranked everything else and this read as "Easy",
    // despite being the hardest session of the week.
    expect(
      classifyWorkoutTitle({
        notes: "5-8 x 3 min at 105% of marathon pace, 45 sec jog. 1-2 mi progressive warm-up and 1-2 mi easy cool-down.",
        distanceMiMin: null,
        steps: null,
      }),
    ).toBe("Intervals");
  });

  it("recovery program: a continuous segment followed by timed fast reps -> Intervals, not Easy", () => {
    // T21.2 Week 4 Thursday -- same "easy cool-down" trap as above, plus a
    // leading continuous segment before the reps.
    expect(
      classifyWorkoutTitle({
        notes: "4 km at 110% of marathon pace, 4-5 min walk/jog, then 6-8 x 1 min fast (~115% effort), 2 min jog. 1-2 mi progressive warm-up and 1-2 mi easy cool-down.",
        distanceMiMin: null,
        steps: null,
      }),
    ).toBe("Intervals");
  });

  it("does not let the timed-repeats-at-pace check swallow a strides day (strides stay Easy + Strides, not Intervals)", () => {
    expect(
      classifyWorkoutTitle({ notes: "3 mi easy progressing to moderate, then 8-10 x 20 sec strides", distanceMiMin: 3, steps: null }),
    ).toBe("Easy + Strides");
  });

  it("does not let the timed-repeats-at-pace check override an uphill repeats day (Hill Repeats still wins)", () => {
    expect(
      classifyWorkoutTitle({
        notes: "6-10 x 1 min fast uphill (~112-115% of marathon pace effort), easy jog down (can do on flat ground). 1-2 mi progressive warm-up and 1-2 mi easy cool-down.",
        distanceMiMin: null,
        steps: null,
      }),
    ).toBe("Hill Repeats");
  });
});

describe("classifyWorkoutTitle -- edge cases the task calls out explicitly", () => {
  it("a null-distance, steps-less day (every pace-dependent time-based main set) still falls back to a real prose-derived label", () => {
    // "5-8 x 3 min at 105% of marathon pace, 45 sec jog" (recovery W4D2) --
    // distance null, steps null (Part A keeps recovery pace-free), but the
    // prose still has nothing this classifier can read as progression/
    // uphill/off, so it falls through to the plain-easy-tier branch.
    // There is no "easy"/"moderate" word in this one either -- it bottoms
    // out at the real last-resort label, never "Workout".
    const title = classifyWorkoutTitle({ notes: "5-8 x 3 min at 105% of marathon pace, 45 sec jog. 1-2 mi progressive warm-up and 1-2 mi easy cool-down.", distanceMiMin: null, steps: null });
    expect(title).not.toBe("Workout");
    expect(title.length).toBeGreaterThan(0);
  });

  it("mesa W17D7's own conditional-variant prose (before auto-resolution picks a branch) still classifies from its primary characteristic, not 'Workout'", () => {
    // conditionalVariants means distanceMiMin/steps are both null at the
    // template level (see framework-structure.ts's own ConditionalVariant
    // comment) -- the day's own verbatim prose is still real, and its
    // first-mentioned branch is a Kenyan-style progression run.
    const title = classifyWorkoutTitle({
      notes: "8 mi Kenyan-style progression run + 1 mi easy cool-down (if marathon is on a Sunday), or: 8 mi easy progressing to moderate (if marathon is on a Saturday)",
      distanceMiMin: null,
      steps: null,
    });
    expect(title).toBe("Kenyan Progression Run");
  });

  it("every one of the 5 genuinely unstructured recovery days (pace-dependent, no steps) gets a real, non-'Workout' title", () => {
    const plan = buildRecoveryProgramSeed();
    const paceDependentDays = plan.days.filter((d) => d.distanceMiMin == null && !/^off\b/i.test(d.notes.trim()));
    expect(paceDependentDays).toHaveLength(5);
    for (const day of paceDependentDays) {
      const title = classifyWorkoutTitle({ notes: day.notes, distanceMiMin: null, steps: null });
      expect(title, day.notes).not.toBe("Workout");
    }
  });

  it("a day with steps but no percent anywhere in them (a pure-distance warm-up/cool-down pair with no quality main set) falls back to prose", () => {
    const steps: TitleStep[] = [{ stepType: "warmup" }, { stepType: "main" }, { stepType: "cooldown" }];
    expect(classifyWorkoutTitle({ notes: "7 mi easy + 5 mi progressing from moderate to ~90% 5k pace + 1 mi easy cool-down", distanceMiMin: 13, steps })).not.toBe(
      "Workout",
    );
  });

  it("the absolute last-resort fallback is a real word, never 'Workout', for prose with no recognizable characteristic at all", () => {
    expect(classifyWorkoutTitle({ notes: "xyz unrecognizable prose", distanceMiMin: null, steps: null })).toBe("Quality");
    expect(classifyWorkoutTitle({ notes: "xyz unrecognizable prose", distanceMiMin: 5, steps: null })).toBe("Training Day");
  });
});

describe("coverage sanity: title distribution over the real corpus stays within a known, reviewed set", () => {
  it("every title produced across all 842 real days is one of the taxonomy's own named categories", () => {
    const KNOWN_TITLES = new Set([
      "Off",
      "Off or Easy",
      "Race",
      "Very Easy",
      "Easy",
      "Easy + Strides",
      "Fartlek",
      "Moderate",
      "Strong",
      "Easy LR",
      "Moderate LR",
      "Quality LR",
      "Kenyan Progression Run",
      "MP Progression",
      "Steady State",
      "Intervals",
      "Cruise Intervals",
      "Hill Repeats",
      "Quality",
      "Training Day",
    ]);

    for (const key of FRAMEWORK_KEYS) {
      const raw = loadRaw(key);
      const { structured } = structureFramework(raw);
      let i = 0;
      for (const week of raw.weeks) {
        for (const day of week.days) {
          for (const session of day.sessions) {
            const s = structured[i++];
            const title = classifyWorkoutTitle({ notes: session.workout, distanceMiMin: s.distanceMiMin, steps: s.steps as TitleStep[] | null });
            expect(KNOWN_TITLES.has(title), `${key}: ${JSON.stringify(session.workout)} -> unexpected title "${title}"`).toBe(true);
          }
        }
      }
    }

    const plan = buildRecoveryProgramSeed();
    for (const day of plan.days) {
      const title = classifyWorkoutTitle({ notes: day.notes, distanceMiMin: day.distanceMiMin ?? null, steps: (day.steps ?? null) as TitleStep[] | null });
      expect(KNOWN_TITLES.has(title), `recovery: ${JSON.stringify(day.notes)} -> unexpected title "${title}"`).toBe(true);
    }
  });

  it("recoveryWorksheetEntries is still empty -- this module reads the same Prompt 21 output, not a second source of truth", () => {
    expect(recoveryWorksheetEntries()).toHaveLength(0);
  });
});
