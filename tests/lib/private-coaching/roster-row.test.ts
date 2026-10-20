import { describe, expect, it } from "vitest";

import {
  buildRosterRow,
  computeRosterAttentionBadges,
  hasActiveProgramForWeek,
  sortRosterRows,
  type RosterAttentionInput,
  type RosterRow,
  type RosterRowInput,
} from "@/lib/private-coaching/roster-row";
import type { TrainingPhase } from "@/lib/private-coaching/training-phases";
import { MILE_METERS } from "@/lib/race-distances";

const TODAY = "2026-10-20"; // a real Tuesday

function phase(overrides: Partial<TrainingPhase> = {}): TrainingPhase {
  return {
    id: "phase-1",
    athleteId: "athlete-1",
    phaseType: "build",
    name: null,
    startDate: "2026-09-21", // Monday
    endDate: "2026-10-25", // Sunday, 5 full weeks
    goalId: null,
    notes: null,
    explainer: null,
    sourceProgramId: null,
    sourceProgramPhaseDefinitionId: null,
    ...overrides,
  };
}

function attentionInput(overrides: Partial<RosterAttentionInput> = {}): RosterAttentionInput {
  return {
    missedWorkoutDates: [],
    recentCompletions: [],
    scheduledWorkoutDates: [],
    hasActiveProgram: true,
    lastCheckinWeekStart: null,
    today: TODAY,
    hasIncompleteIntake: false,
    ...overrides,
  };
}

describe("computeRosterAttentionBadges", () => {
  it("returns no badges at all when nothing is wrong -- a clean row, not a 'good job' badge", () => {
    const badges = computeRosterAttentionBadges(
      attentionInput({ hasActiveProgram: true, lastCheckinWeekStart: "2026-10-19" }),
    );
    expect(badges).toEqual([]);
  });

  describe("missed_workout -- within the last 7 days, not 8", () => {
    it("a workout missed exactly 7 days ago is flagged (the boundary is inclusive)", () => {
      const badges = computeRosterAttentionBadges(attentionInput({ missedWorkoutDates: ["2026-10-13"] }));
      expect(badges.some((b) => b.reason === "missed_workout")).toBe(true);
    });

    it("a workout missed exactly 8 days ago is NOT flagged", () => {
      const badges = computeRosterAttentionBadges(attentionInput({ missedWorkoutDates: ["2026-10-12"] }));
      expect(badges.some((b) => b.reason === "missed_workout")).toBe(false);
    });

    it("today's own workout is never 'missed' -- the day isn't over", () => {
      const badges = computeRosterAttentionBadges(attentionInput({ missedWorkoutDates: [TODAY] }));
      expect(badges.some((b) => b.reason === "missed_workout")).toBe(false);
    });

    it("names the most recent missed weekday, and counts any extras", () => {
      const badges = computeRosterAttentionBadges(attentionInput({ missedWorkoutDates: ["2026-10-14"] })); // a Wednesday
      const badge = badges.find((b) => b.reason === "missed_workout");
      expect(badge?.detail).toBe("Missed Wed");
    });

    it("shows a +N suffix for more than one missed workout in the window", () => {
      const badges = computeRosterAttentionBadges(attentionInput({ missedWorkoutDates: ["2026-10-13", "2026-10-14"] }));
      const badge = badges.find((b) => b.reason === "missed_workout");
      expect(badge?.detail).toBe("Missed Wed +1");
    });
  });

  describe("rpe_spike -- reuses isRpeNoteworthy exactly, scoped to the last 7 days", () => {
    it("flags when a completion in the window has a noteworthy RPE (3+ above prescribed)", () => {
      const badges = computeRosterAttentionBadges(
        attentionInput({
          recentCompletions: [{ completedAt: "2026-10-19T12:00:00Z", plannedRpe: 6, plannedRpeMax: null, loggedRpe: 9 }],
        }),
      );
      expect(badges.some((b) => b.reason === "rpe_spike")).toBe(true);
    });

    it("does not flag a 2-point difference -- not noteworthy by isRpeNoteworthy's own boundary", () => {
      const badges = computeRosterAttentionBadges(
        attentionInput({
          recentCompletions: [{ completedAt: "2026-10-19T12:00:00Z", plannedRpe: 6, plannedRpeMax: null, loggedRpe: 8 }],
        }),
      );
      expect(badges.some((b) => b.reason === "rpe_spike")).toBe(false);
    });

    it("ignores a noteworthy RPE completed outside the 7-day window", () => {
      const badges = computeRosterAttentionBadges(
        attentionInput({
          recentCompletions: [{ completedAt: "2026-10-01T12:00:00Z", plannedRpe: 6, plannedRpeMax: null, loggedRpe: 9 }],
        }),
      );
      expect(badges.some((b) => b.reason === "rpe_spike")).toBe(false);
    });

    it("flags an unprescribed RPE 9+ the same way isRpeNoteworthy does", () => {
      const badges = computeRosterAttentionBadges(
        attentionInput({
          recentCompletions: [{ completedAt: "2026-10-19T12:00:00Z", plannedRpe: null, plannedRpeMax: null, loggedRpe: 9 }],
        }),
      );
      expect(badges.some((b) => b.reason === "rpe_spike")).toBe(true);
    });
  });

  describe("no_checkin -- only for athletes with an active program, within the last 7 days", () => {
    it("is suppressed entirely for a program-less athlete, no matter how stale the check-in", () => {
      const badges = computeRosterAttentionBadges(attentionInput({ hasActiveProgram: false, lastCheckinWeekStart: null }));
      expect(badges.some((b) => b.reason === "no_checkin")).toBe(false);
    });

    it("exactly 7 days since the last check-in is NOT flagged (the boundary is inclusive)", () => {
      const badges = computeRosterAttentionBadges(attentionInput({ hasActiveProgram: true, lastCheckinWeekStart: "2026-10-13" }));
      expect(badges.some((b) => b.reason === "no_checkin")).toBe(false);
    });

    it("exactly 8 days since the last check-in IS flagged", () => {
      const badges = computeRosterAttentionBadges(attentionInput({ hasActiveProgram: true, lastCheckinWeekStart: "2026-10-12" }));
      const badge = badges.find((b) => b.reason === "no_checkin");
      expect(badge?.detail).toBe("No check-in 8d");
    });

    it("an active-program athlete who has never checked in at all is flagged distinctly", () => {
      const badges = computeRosterAttentionBadges(attentionInput({ hasActiveProgram: true, lastCheckinWeekStart: null }));
      const badge = badges.find((b) => b.reason === "no_checkin");
      expect(badge?.detail).toBe("No check-in yet");
    });
  });

  describe("no_activity -- nothing logged in the last 7 days despite scheduled workouts", () => {
    it("flags when something was scheduled in the window but nothing was completed", () => {
      const badges = computeRosterAttentionBadges(attentionInput({ scheduledWorkoutDates: ["2026-10-19"], recentCompletions: [] }));
      expect(badges.some((b) => b.reason === "no_activity")).toBe(true);
    });

    it("does not flag when nothing was scheduled in the window at all -- no workouts, nothing to miss logging", () => {
      const badges = computeRosterAttentionBadges(attentionInput({ scheduledWorkoutDates: [], recentCompletions: [] }));
      expect(badges.some((b) => b.reason === "no_activity")).toBe(false);
    });

    it("does not flag when something was scheduled AND something was completed in the window", () => {
      const badges = computeRosterAttentionBadges(
        attentionInput({
          scheduledWorkoutDates: ["2026-10-19"],
          recentCompletions: [{ completedAt: "2026-10-19T12:00:00Z", plannedRpe: null, plannedRpeMax: null, loggedRpe: 5 }],
        }),
      );
      expect(badges.some((b) => b.reason === "no_activity")).toBe(false);
    });
  });

  it("combines all four flags at once when every condition holds", () => {
    const badges = computeRosterAttentionBadges(
      attentionInput({
        missedWorkoutDates: ["2026-10-13"],
        recentCompletions: [{ completedAt: "2026-10-19T12:00:00Z", plannedRpe: null, plannedRpeMax: null, loggedRpe: 9 }],
        hasActiveProgram: true,
        lastCheckinWeekStart: "2026-10-05",
        scheduledWorkoutDates: ["2026-10-19"],
      }),
    );
    // no_activity doesn't fire here since a completion did land in the window
    expect(badges.map((b) => b.reason)).toEqual(["missed_workout", "rpe_spike", "no_checkin"]);
  });

  describe("intake_incomplete -- driven entirely by the caller's own evaluateIntakeGaps result", () => {
    it("fires when hasIncompleteIntake is true", () => {
      const badges = computeRosterAttentionBadges(
        attentionInput({ hasIncompleteIntake: true, lastCheckinWeekStart: "2026-10-19" }),
      );
      expect(badges).toEqual([{ reason: "intake_incomplete", detail: "Intake incomplete" }]);
    });

    it("does not fire when hasIncompleteIntake is false", () => {
      const badges = computeRosterAttentionBadges(
        attentionInput({ hasIncompleteIntake: false, lastCheckinWeekStart: "2026-10-19" }),
      );
      expect(badges.some((b) => b.reason === "intake_incomplete")).toBe(false);
    });

    it("sits last in priority order alongside every other flag", () => {
      const badges = computeRosterAttentionBadges(
        attentionInput({
          missedWorkoutDates: ["2026-10-13"],
          lastCheckinWeekStart: "2026-10-19",
          hasIncompleteIntake: true,
        }),
      );
      expect(badges.map((b) => b.reason)).toEqual(["missed_workout", "intake_incomplete"]);
    });
  });
});

function rowInput(overrides: Partial<RosterRowInput> = {}): RosterRowInput {
  return {
    athleteId: "athlete-1",
    coachAthleteId: "ca-1",
    displayName: "Jordan",
    avatarUrl: null,
    programName: null,
    phases: [],
    weekStart: "2026-10-19",
    thisWeek: null,
    lastActivityAt: null,
    lastCheckinWeekStart: null,
    nextRace: null,
    attentionBadges: [],
    ...overrides,
  };
}

describe("buildRosterRow", () => {
  it("an athlete with mixed week data shows correct planned/completed distance + count", () => {
    const row = buildRosterRow(
      rowInput({
        thisWeek: { plannedCount: 5, completedCount: 3, plannedDistanceM: 42 * MILE_METERS, completedDistanceM: 28.4 * MILE_METERS },
      }),
    );
    expect(row.thisWeek).toEqual({ plannedCount: 5, completedCount: 3, plannedDistanceM: 42 * MILE_METERS, completedDistanceM: 28.4 * MILE_METERS });
  });

  it("no scheduled workouts this week at all -- thisWeek stays null, never a fabricated 0/0", () => {
    const row = buildRosterRow(rowInput({ thisWeek: null }));
    expect(row.thisWeek).toBeNull();
  });

  it("an athlete with no program at all shows that state plainly", () => {
    const row = buildRosterRow(rowInput({ phases: [] }));
    expect(row.program).toEqual({ kind: "none" });
  });

  it("an athlete with an active program shows program name, phase label, and week position", () => {
    const row = buildRosterRow(
      rowInput({
        programName: "Ridge",
        phases: [phase({ name: "Supportive" })],
        weekStart: "2026-10-19", // the 5th Monday of the 5-week phase (Sep 21 .. Oct 25)
      }),
    );
    expect(row.program).toEqual({ kind: "active", programName: "Ridge", phaseLabel: "Supportive", weekLabel: "Wk 5 of 5" });
  });

  it("falls back to the phase type when the coach never named the phase", () => {
    const row = buildRosterRow(rowInput({ phases: [phase({ name: null, phaseType: "build" })] }));
    expect(row.program).toMatchObject({ kind: "active", phaseLabel: "build" });
  });

  it("a phase with no sourceProgramId shows a null programName, not a fabricated one", () => {
    const row = buildRosterRow(rowInput({ programName: null, phases: [phase()] }));
    expect(row.program).toMatchObject({ kind: "active", programName: null });
  });

  it("placeholders carry through untouched: no activity ever, no check-in ever, no race set", () => {
    const row = buildRosterRow(rowInput({ lastActivityAt: null, lastCheckinWeekStart: null, nextRace: null }));
    expect(row.lastActivityAt).toBeNull();
    expect(row.lastCheckinWeekStart).toBeNull();
    expect(row.nextRace).toBeNull();
  });
});

describe("hasActiveProgramForWeek", () => {
  it("true when a phase covers the given week", () => {
    expect(hasActiveProgramForWeek([phase()], "2026-10-19")).toBe(true);
  });

  it("false with no phases at all", () => {
    expect(hasActiveProgramForWeek([], "2026-10-19")).toBe(false);
  });

  it("false when every phase has already ended or hasn't started yet", () => {
    expect(hasActiveProgramForWeek([phase({ startDate: "2025-01-06", endDate: "2025-02-03" })], "2026-10-19")).toBe(false);
  });
});

function row(overrides: Partial<RosterRow> = {}): RosterRow {
  return {
    athleteId: "a",
    coachAthleteId: "ca",
    displayName: "Z",
    avatarUrl: null,
    program: { kind: "none" },
    thisWeek: null,
    lastActivityAt: null,
    lastCheckinWeekStart: null,
    nextRace: null,
    attentionBadges: [],
    ...overrides,
  };
}

describe("sortRosterRows", () => {
  it("default (attention): most attention flags first", () => {
    const rows = [
      row({ athleteId: "none", attentionBadges: [] }),
      row({ athleteId: "two", attentionBadges: [{ reason: "missed_workout", detail: "Missed Tue" }, { reason: "rpe_spike", detail: "RPE spike" }] }),
      row({ athleteId: "one", attentionBadges: [{ reason: "no_checkin", detail: "No check-in 9d" }] }),
    ];
    const sorted = sortRosterRows(rows, "attention");
    expect(sorted.map((r) => r.athleteId)).toEqual(["two", "one", "none"]);
  });

  it("ties within the same flag count break by most recently active first", () => {
    const rows = [
      row({ athleteId: "older", attentionBadges: [{ reason: "no_checkin", detail: "x" }], lastActivityAt: "2026-10-01T00:00:00Z" }),
      row({ athleteId: "newer", attentionBadges: [{ reason: "no_checkin", detail: "x" }], lastActivityAt: "2026-10-19T00:00:00Z" }),
      row({ athleteId: "never", attentionBadges: [{ reason: "no_checkin", detail: "x" }], lastActivityAt: null }),
    ];
    const sorted = sortRosterRows(rows, "attention");
    expect(sorted.map((r) => r.athleteId)).toEqual(["newer", "older", "never"]);
  });

  it("name sort is alphabetical", () => {
    const rows = [row({ athleteId: "b", displayName: "Zoe" }), row({ athleteId: "a", displayName: "Amir" })];
    const sorted = sortRosterRows(rows, "name");
    expect(sorted.map((r) => r.displayName)).toEqual(["Amir", "Zoe"]);
  });

  it("race sort orders by soonest goal date, with no-race athletes last", () => {
    const rows = [
      row({ athleteId: "none", nextRace: null }),
      row({ athleteId: "later", nextRace: { raceName: "B", goalDate: "2027-06-01" } }),
      row({ athleteId: "soon", nextRace: { raceName: "A", goalDate: "2026-11-01" } }),
    ];
    const sorted = sortRosterRows(rows, "race");
    expect(sorted.map((r) => r.athleteId)).toEqual(["soon", "later", "none"]);
  });

  it("does not mutate the input array", () => {
    const rows = [row({ athleteId: "b", displayName: "Zoe" }), row({ athleteId: "a", displayName: "Amir" })];
    const original = [...rows];
    sortRosterRows(rows, "name");
    expect(rows).toEqual(original);
  });
});
