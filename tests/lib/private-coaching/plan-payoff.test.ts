import { describe, expect, it } from "vitest";

import {
  formatRaceCountdown,
  raceCountdown,
  phaseStripPurpose,
  pickFirstAction,
  firstActionLabel,
  PACE_BAND_WHY,
} from "@/lib/private-coaching/plan-payoff";

describe("raceCountdown", () => {
  it("an upcoming race counts the real days away", () => {
    expect(raceCountdown("2026-10-20", "2027-04-19")).toEqual({ kind: "upcoming", days: 181 });
  });

  it("boundary: the race is today", () => {
    expect(raceCountdown("2026-10-20", "2026-10-20")).toEqual({ kind: "today" });
  });

  it("boundary: the race was yesterday -- the first day past, not still upcoming", () => {
    expect(raceCountdown("2026-10-20", "2026-10-19")).toEqual({ kind: "past", daysAgo: 1 });
  });

  it("a race well in the past still resolves sensibly, never a negative count", () => {
    const result = raceCountdown("2026-10-20", "2026-01-01");
    expect(result.kind).toBe("past");
    expect((result as { daysAgo: number }).daysAgo).toBeGreaterThan(0);
  });
});

describe("formatRaceCountdown", () => {
  it("formats each case in plain language, singular vs plural", () => {
    expect(formatRaceCountdown({ kind: "upcoming", days: 181 })).toBe("181 days");
    expect(formatRaceCountdown({ kind: "upcoming", days: 1 })).toBe("1 day");
    expect(formatRaceCountdown({ kind: "today" })).toBe("Today");
    expect(formatRaceCountdown({ kind: "past", daysAgo: 1 })).toBe("1 day ago");
    expect(formatRaceCountdown({ kind: "past", daysAgo: 3 })).toBe("3 days ago");
  });
});

describe("phaseStripPurpose", () => {
  it("resolves the standard three phase keys regardless of case/extra words", () => {
    expect(phaseStripPurpose("General")).toMatch(/aerobic ceiling/);
    expect(phaseStripPurpose("supportive phase")).toMatch(/marathon pace/i);
    expect(phaseStripPurpose("SPECIFIC")).toMatch(/goal marathon pace/);
  });

  it("returns null for a phase type with no standard one-liner, rather than inventing one", () => {
    expect(phaseStripPurpose("Base")).toBeNull();
    expect(phaseStripPurpose("Taper")).toBeNull();
  });
});

describe("pickFirstAction", () => {
  it("today's own workout wins when one exists", () => {
    const action = pickFirstAction({ todayWorkoutId: "w-today", nextUpcomingWorkoutId: "w-next" });
    expect(action).toEqual({ kind: "log_today", workoutId: "w-today", href: "/coaching/workouts/w-today" });
  });

  it("falls back to the next upcoming workout when nothing is scheduled today", () => {
    const action = pickFirstAction({ todayWorkoutId: null, nextUpcomingWorkoutId: "w-next" });
    expect(action).toEqual({ kind: "view_first_workout", workoutId: "w-next", href: "/coaching/workouts/w-next" });
  });

  it("falls back to check-in when nothing is scheduled at all -- never a dead end", () => {
    const action = pickFirstAction({ todayWorkoutId: null, nextUpcomingWorkoutId: null });
    expect(action).toEqual({ kind: "checkin", href: "/coaching/checkin" });
  });
});

describe("firstActionLabel", () => {
  it("every kind has a plain-language label", () => {
    expect(firstActionLabel({ kind: "log_today", workoutId: "w", href: "/x" })).toBe("Log today's workout");
    expect(firstActionLabel({ kind: "view_first_workout", workoutId: "w", href: "/x" })).toBe("View your first workout");
    expect(firstActionLabel({ kind: "checkin", href: "/x" })).toBe("Complete your check-in");
  });
});

describe("PACE_BAND_WHY", () => {
  it("every pace reference key the platform uses has a one-line why", () => {
    const keys: (keyof typeof PACE_BAND_WHY)[] = ["easy", "steady", "tempo", "interval", "5k", "10k", "half", "marathon"];
    for (const key of keys) {
      expect(PACE_BAND_WHY[key].length).toBeGreaterThan(10);
    }
  });
});
