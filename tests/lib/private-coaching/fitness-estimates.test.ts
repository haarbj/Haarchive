import { describe, expect, it } from "vitest";

import { resolvePacePercent, suggestFitnessEstimateFromRace, type AthleteFitnessEstimate } from "@/lib/private-coaching/fitness-estimates";
import type { PaceReferenceKey, AthleteMostRecentRace } from "@/lib/private-coaching/pace-reference";
import { predictRaceTime } from "@/lib/coaching-engine";
import { metersFor } from "@/lib/race-distances";

function estimate(referenceKey: PaceReferenceKey, estimatedTimeS: number, updatedAt = "2026-09-01"): AthleteFitnessEstimate {
  return { referenceKey, estimatedTimeS, updatedAt };
}

describe("resolvePacePercent", () => {
  it("returns null when the athlete has no estimate on file for that basis", () => {
    expect(resolvePacePercent("5k", 50, 60, {})).toBeNull();
  });

  it("matches the exact worked example from the pace-zone-table feature (5:24/mi 5K, 50-60%)", () => {
    // A 5:24/mi 5K pace over 3.10686 mi -> 1006s, matching
    // program-generation.test.ts's own identical worked example.
    const estimates = { "5k": estimate("5k", 1006) };
    const result = resolvePacePercent("5k", 50, 60, estimates);
    expect(result).not.toBeNull();
    // 60% (faster) produces the min (faster/lower) edge; 50% produces the max.
    expect(result!.minSPerMi).toBeLessThan(result!.maxSPerMi);
  });

  it("percentMin === percentMax resolves to a single point, and the source label reads as one percent, not a degenerate range", () => {
    const estimates = { marathon: estimate("marathon", 3 * 3600) }; // 3:00:00 marathon
    const result = resolvePacePercent("marathon", 90, 90, estimates);
    expect(result).not.toBeNull();
    expect(result!.minSPerMi).toBe(result!.maxSPerMi);
    expect(result!.sourceLabel).toContain("90%");
    expect(result!.sourceLabel).not.toContain("90-90%");
  });

  it("the source label names the basis, the athlete's own estimate, and when it was set", () => {
    const estimates = { "5k": estimate("5k", 1012, "2026-08-15") };
    const result = resolvePacePercent("5k", 90, 92, estimates);
    expect(result!.sourceLabel).toContain("90-92%");
    expect(result!.sourceLabel).toContain("5K Pace");
    expect(result!.sourceLabel).toContain("16:52"); // 1012s formatted as a clock
  });

  it("a different basis with no estimate doesn't borrow another basis' number", () => {
    const estimates = { "5k": estimate("5k", 1000) };
    expect(resolvePacePercent("marathon", 90, 92, estimates)).toBeNull();
  });

  // updated_at is a real timestamptz column (athlete_fitness_estimates,
  // not null default now()) -- every real row looks like this, not like
  // this file's own plain-date `estimate()` helper default. The bug:
  // formatDate assumes a plain "yyyy-mm-dd" date and appends its own
  // "T00:00:00", which collides with a real timestamp's own time/offset
  // and produces "Invalid Date". Pinned here with a realistic value so a
  // future change can't silently reintroduce it.
  it("a real timestamptz updated_at (not a plain date) renders a real date, never 'Invalid Date'", () => {
    const estimates = { "5k": estimate("5k", 1012, "2026-08-15T14:23:01.123456+00:00") };
    const result = resolvePacePercent("5k", 90, 92, estimates);
    expect(result!.sourceLabel).not.toContain("Invalid Date");
    // Locale-tolerant on purpose (toLocaleDateString's exact string is
    // environment-dependent) -- confirms a real date rendered (the year
    // and day number), matching the same timestamp's own date portion.
    expect(result!.sourceLabel).toContain("updated");
    expect(result!.sourceLabel).toContain("2026");
    expect(result!.sourceLabel).toContain("15");
  });

  it("a null/empty updated_at omits the whole 'updated ...' clause instead of rendering 'Invalid Date'", () => {
    const estimates = { "5k": estimate("5k", 1012, "") };
    const result = resolvePacePercent("5k", 90, 92, estimates);
    expect(result!.sourceLabel).not.toContain("Invalid Date");
    expect(result!.sourceLabel).not.toContain("updated");
    // The estimate itself is still shown -- only the broken date clause is dropped.
    expect(result!.sourceLabel).toContain("16:52");
  });

  it("a malformed updated_at also omits the clause rather than rendering 'Invalid Date'", () => {
    const estimates = { "5k": estimate("5k", 1012, "not-a-real-date") };
    const result = resolvePacePercent("5k", 90, 92, estimates);
    expect(result!.sourceLabel).not.toContain("Invalid Date");
    expect(result!.sourceLabel).not.toContain("updated");
  });
});

describe("suggestFitnessEstimateFromRace", () => {
  const race: AthleteMostRecentRace = {
    id: "r1",
    raceName: "QA Test Half",
    raceDate: "2026-09-01",
    distanceM: 21097.5,
    finishTimeS: 4800, // 1:20:00
  };

  it("returns null when no race is on file -- never a fabricated number", () => {
    expect(suggestFitnessEstimateFromRace("marathon", null)).toBeNull();
  });

  it("predicts the marathon time via the exact same Riegel projection resolvePaceReference already uses, never a second formula", () => {
    const suggestion = suggestFitnessEstimateFromRace("marathon", race);
    expect(suggestion).not.toBeNull();
    const expected = Math.round(predictRaceTime(race.distanceM, race.finishTimeS, metersFor("marathon")));
    expect(suggestion!.timeS).toBe(expected);
    // The real-world case this scope's own deep-dive cited: a 1:20:00 half
    // implies roughly a 2.08x marathon time (Riegel's 1.06 exponent on a
    // ~2x distance ratio) -- confirms the suggestion lands in that
    // neighborhood, not some unrelated number.
    expect(suggestion!.timeS).toBeGreaterThan(9900); // > 2:45:00
    expect(suggestion!.timeS).toBeLessThan(10500); // < 2:55:00
  });

  it("names the source race in its label, never presenting the number as if it came from nowhere", () => {
    const suggestion = suggestFitnessEstimateFromRace("5k", race);
    expect(suggestion!.sourceLabel).toContain("QA Test Half");
  });
});
