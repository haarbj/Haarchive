import { describe, expect, it } from "vitest";

import { adaptationActionSummary, adaptationEvidenceLines, adaptationSignalLabel } from "@/lib/private-coaching/adaptation-card-copy";
import type { AdaptationCardRow } from "@/lib/private-coaching/adaptation-cards-service";

function card(overrides: Partial<AdaptationCardRow> = {}): AdaptationCardRow {
  return {
    id: "card-1",
    athlete_id: "athlete-1",
    coach_id: "coach-1",
    signal: "fitness_up",
    fingerprint: "fp",
    evidence: [],
    action: { kind: "insert_retest_workout" },
    status: "pending",
    decided_at: null,
    decided_by: null,
    created_at: "2026-10-20T00:00:00Z",
    ...overrides,
  };
}

describe("adaptationEvidenceLines", () => {
  it("fitness_up: includes the actual prescribed/logged RPE figures, e.g. 'Oct 12 Easy: prescribed RPE 6, logged 3'", () => {
    const row = card({
      signal: "fitness_up",
      evidence: [{ workoutId: "w-1", scheduledDate: "2026-10-12", dayLabel: "Easy", prescribedRpe: 6, loggedRpe: 3 }],
    });
    expect(adaptationEvidenceLines(row)).toEqual(["Oct 12 Easy: prescribed RPE 6, logged 3"]);
  });

  it("plan_too_low: includes the actual planned/completed distances and percent over", () => {
    const row = card({
      signal: "plan_too_low",
      evidence: [{ workoutId: "w-1", scheduledDate: "2026-10-12", dayLabel: "Long Run", plannedDistanceM: 16093, actualDistanceM: 17702, overPercent: 10 }],
    });
    expect(adaptationEvidenceLines(row)[0]).toContain("+10%");
    expect(adaptationEvidenceLines(row)[0]).toContain("Long Run");
  });

  it("going_quiet: includes the real completed/scheduled counts and rate", () => {
    const row = card({
      signal: "going_quiet",
      evidence: { windowStart: "2026-10-06", windowEnd: "2026-10-19", scheduledCount: 5, completedCount: 3, completionRate: 0.6 },
      action: { kind: "request_checkin" },
    });
    expect(adaptationEvidenceLines(row)[0]).toContain("3 of 5");
    expect(adaptationEvidenceLines(row)[0]).toContain("60%");
  });
});

describe("adaptationActionSummary", () => {
  it("states the fitness_up action concretely, without a number already decided (the coach picks the day)", () => {
    expect(adaptationActionSummary(card({ signal: "fitness_up" }))).toContain("retest");
  });

  it("states the plan_too_low action with the real current and proposed distances", () => {
    const row = card({
      signal: "plan_too_low",
      action: { kind: "raise_distance", workoutId: "w-2", scheduledDate: "2026-10-23", currentDistanceM: 10000, newDistanceM: 11000 },
    });
    const summary = adaptationActionSummary(row);
    expect(summary).toContain("6.2"); // 10000m rounds to 6.2 mi
    expect(summary).toContain("6.8"); // 11000m rounds to 6.8 mi
  });
});

describe("adaptationSignalLabel", () => {
  it("every signal has a distinct, plain-language label", () => {
    const labels = (["fitness_up", "fatigue_accumulating", "plan_too_low", "going_quiet"] as const).map(adaptationSignalLabel);
    expect(new Set(labels).size).toBe(4);
    for (const label of labels) expect(label.toLowerCase()).not.toContain("_");
  });
});
