import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { allHandOverrides, lookupHandOverride } from "@/lib/private-coaching/framework-structure-overrides";
import { structureFramework } from "@/lib/private-coaching/framework-structure";
import type { RawFramework } from "@/lib/private-coaching/framework-seed";
import { MILE_METERS } from "@/lib/race-distances";

const SEED_DIR = path.join(process.cwd(), "scripts/data/framework-seeds");
const FRAMEWORK_KEYS = ["canyon", "mesa", "ridge", "peak", "summit"];

function loadRaw(key: string): RawFramework {
  return JSON.parse(readFileSync(path.join(SEED_DIR, `${key}.json`), "utf8")) as RawFramework;
}

describe("lookupHandOverride", () => {
  it("has no two entries for the same program with the same normalized text (checked once here, not re-derived at lookup time)", () => {
    const seen = new Set<string>();
    for (const e of allHandOverrides()) {
      const key = `${e.program}\u0000${e.workoutText.replace(/\n/g, " / ").trim()}`;
      expect(seen.has(key), `duplicate override for ${e.program}: ${e.workoutText}`).toBe(false);
      seen.add(key);
    }
  });

  it("matches a canyon/mesa/ridge-style newline-joined session against a '/'-joined override key", () => {
    const found = lookupHandOverride(
      "canyon",
      "1.5 mi progressive warm-up + 4 strides\n2 sets of (2 km at 108% MP, 1 km at 112% MP) with 3 min jog within sets and 4 min jog between sets\n1 mi easy cool-down",
    );
    expect(found).not.toBeNull();
    expect(found!.distanceMiMin).toBe(6.1);
  });

  it("returns null for a session with no hand override", () => {
    expect(lookupHandOverride("canyon", "4–5 mi easy")).toBeNull();
  });
});

describe("summit W9D3a -- Brody's exact-sequence directive", () => {
  const workoutText =
    "4 mi progressing to 95% MP + 4 strides / 4-1, 3-1, 2-1, 1-1 km at 103 / 105% MP with 2 min walk / 0.5 mi easy cool-down";

  it("encodes exactly the 4-pair, 14k sequence as 8 main-set steps, plus warm-up and cool-down", () => {
    const structured = lookupHandOverride("summit", workoutText);
    expect(structured).not.toBeNull();
    const steps = structured!.steps!;
    expect(steps).toHaveLength(10); // warmup + 8 main + cooldown

    // The 8 main-set steps, in order: 4k@103, 1k@105, 3k@103, 1k@105, 2k@103, 1k@105, 1k@103, 1k@105.
    const mainSteps = steps.slice(1, 9);
    expect(mainSteps.map((s) => s.distanceM)).toEqual([4000, 1000, 3000, 1000, 2000, 1000, 1000, 1000]);
    expect(mainSteps.map((s) => s.targetPacePercentMin)).toEqual([103, 105, 103, 105, 103, 105, 103, 105]);
    expect(mainSteps.every((s) => s.targetPacePercentBasis === "marathon")).toBe(true);

    // 4 pairs, 14k total main-set distance.
    const totalMainM = mainSteps.reduce((sum, s) => sum + (s.distanceM ?? 0), 0);
    expect(totalMainM).toBe(14000);
  });

  it("day total is 4 (warm-up) + 8.6 (14k, summed per-leg in miles) + 0.5 (cool-down) = 13.1 mi", () => {
    const structured = lookupHandOverride("summit", workoutText);
    expect(structured!.distanceMiMin).toBe(13.1);
    expect(structured!.distanceMiMax).toBe(13.1);
  });

  it("is reachable through the full structureFramework pipeline on the real summit.json, not just the raw lookup", () => {
    const raw = loadRaw("summit");
    const { structured, worksheet } = structureFramework(raw);
    const match = structured.find(
      (d) => d.steps?.length === 10 && d.steps[1].distanceM === 4000 && d.steps[1].targetPacePercentMin === 103,
    );
    expect(match).toBeDefined();
    expect(worksheet.find((w) => w.week === 9)).toBeUndefined();
  });
});

describe("mesa W17D7 -- Brody's bake-the-conditional-in directive", () => {
  const workoutText =
    "8 mi Kenyan-style progression run + 1 mi easy cool-down (if marathon is on a Sunday), or: 8 mi easy progressing to moderate (if marathon is on a Saturday)";

  it("encodes both variants, never picking one", () => {
    const structured = lookupHandOverride("mesa", workoutText);
    expect(structured).not.toBeNull();
    // Deliberately null -- there is no single answer; see conditionalVariants.
    expect(structured!.distanceMiMin).toBeNull();
    expect(structured!.steps).toBeNull();
    expect(structured!.conditionalVariants).toHaveLength(2);
  });

  it("sunday-marathon variant is the 8mi progression + 1mi cool-down (9mi)", () => {
    const structured = lookupHandOverride("mesa", workoutText)!;
    const sunday = structured.conditionalVariants!.find((v) => v.condition === "sunday-marathon")!;
    expect(sunday.distanceMiMin).toBe(9);
    expect(sunday.distanceMiMax).toBe(9);
    expect(sunday.steps).toHaveLength(2);
    expect(sunday.steps![0].distanceM).toBeCloseTo(8 * MILE_METERS, 0);
    expect(sunday.steps![1].stepType).toBe("cooldown");
  });

  it("saturday-marathon variant is the 8mi easy-progressing-to-moderate alone (8mi)", () => {
    const structured = lookupHandOverride("mesa", workoutText)!;
    const saturday = structured.conditionalVariants!.find((v) => v.condition === "saturday-marathon")!;
    expect(saturday.distanceMiMin).toBe(8);
    expect(saturday.distanceMiMax).toBe(8);
    expect(saturday.steps).toHaveLength(1);
  });

  it("is reachable through the full structureFramework pipeline on the real mesa.json and produces no worksheet entry", () => {
    const raw = loadRaw("mesa");
    const { structured, worksheet } = structureFramework(raw);
    const match = structured.find((d) => d.conditionalVariants != null);
    expect(match).toBeDefined();
    expect(match!.conditionalVariants).toHaveLength(2);
    expect(worksheet.find((w) => w.week === 17 && w.day === 7)).toBeUndefined();
  });
});

describe("canyon W13D3 -- the 80%-not-85% discrepancy, resolved per Brody", () => {
  const workoutText =
    "1.5 mi progressive warm-up + 4 strides / 7 × (1 km at 105% MP, 1 km at 80% MP) / 1 mi easy cool-down";

  it("encodes the 7x alternating pair as 2 interval steps (1km @105% + 1km @80%), plus warm-up and cool-down", () => {
    const structured = lookupHandOverride("canyon", workoutText);
    expect(structured).not.toBeNull();
    const steps = structured!.steps!;
    expect(steps).toHaveLength(4); // warmup + 2 intervals + cooldown

    expect(steps[0].stepType).toBe("warmup");
    expect(steps[0].distanceM).toBeCloseTo(1.5 * MILE_METERS, 0);
    expect(steps[0].targetPacePercentMin).toBeNull();

    expect(steps[1].stepType).toBe("interval");
    expect(steps[1].distanceM).toBe(1000);
    expect(steps[1].targetPacePercentBasis).toBe("marathon");
    expect(steps[1].targetPacePercentMin).toBe(105);
    expect(steps[1].repetitions).toBe(7);

    expect(steps[2].stepType).toBe("interval");
    expect(steps[2].distanceM).toBe(1000);
    expect(steps[2].targetPacePercentBasis).toBe("marathon");
    expect(steps[2].targetPacePercentMin).toBe(80);
    expect(steps[2].repetitions).toBe(7);

    expect(steps[3].stepType).toBe("cooldown");
    expect(steps[3].distanceM).toBeCloseTo(1 * MILE_METERS, 0);
    expect(steps[3].targetPacePercentMin).toBeNull();
  });

  it("day total is 1.5 (warm-up) + 8.4 (7x2km, summed per-leg in miles) + 1 (cool-down) = 10.9 mi", () => {
    const structured = lookupHandOverride("canyon", workoutText);
    expect(structured!.distanceMiMin).toBe(10.9);
    expect(structured!.distanceMiMax).toBe(10.9);
  });

  it("is reachable through the full structureFramework pipeline on the real canyon.json and produces no worksheet entry", () => {
    const raw = loadRaw("canyon");
    const { structured, worksheet } = structureFramework(raw);
    const match = structured.find(
      (d) =>
        d.steps?.length === 4 &&
        d.steps[1].distanceM === 1000 &&
        d.steps[1].targetPacePercentMin === 105 &&
        d.steps[2].targetPacePercentMin === 80,
    );
    expect(match).toBeDefined();
    expect(worksheet.find((w) => w.week === 13 && w.day === 3)).toBeUndefined();
  });
});

describe("coverage over the real seed files, with overrides applied", () => {
  it("leaves zero worksheet entries across all five frameworks", () => {
    let allWorksheet: { program: string; week: number; day: number }[] = [];
    for (const key of FRAMEWORK_KEYS) {
      const { worksheet } = structureFramework(loadRaw(key));
      allWorksheet = allWorksheet.concat(worksheet);
    }
    expect(allWorksheet).toHaveLength(0);
  });

  it("every hand-overridden session no longer appears on the worksheet", () => {
    for (const key of FRAMEWORK_KEYS) {
      const raw = loadRaw(key);
      const { worksheet } = structureFramework(raw);
      for (const week of raw.weeks) {
        for (const day of week.days) {
          for (const session of day.sessions) {
            const override = lookupHandOverride(key, session.workout);
            if (!override) continue;
            const stillOnWorksheet = worksheet.some((w) => w.week === week.week && w.prescription === session.workout);
            expect(stillOnWorksheet, `${key} w${week.week}: ${session.workout}`).toBe(false);
          }
        }
      }
    }
  });

  it("every overridden day's distance, where set, is a plausible running distance (not a transcription slip)", () => {
    for (const e of allHandOverrides()) {
      if (e.structured.conditionalVariants) {
        for (const v of e.structured.conditionalVariants) {
          if (v.distanceMiMin != null) expect(v.distanceMiMin).toBeGreaterThan(0);
          if (v.distanceMiMin != null) expect(v.distanceMiMin).toBeLessThan(30);
        }
        continue;
      }
      if (e.structured.distanceMiMin != null) {
        expect(e.structured.distanceMiMin).toBeGreaterThan(0);
        expect(e.structured.distanceMiMin).toBeLessThan(30);
      }
      if (e.structured.distanceMiMax != null) {
        expect(e.structured.distanceMiMax).toBeGreaterThanOrEqual(e.structured.distanceMiMin ?? 0);
      }
    }
  });
});
