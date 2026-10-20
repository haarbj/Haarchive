import { describe, expect, it } from "vitest";

import {
  WEEKS_AHEAD_INITIAL,
  WEEKS_BEHIND_INITIAL,
  WEEKS_PER_LOAD,
  weekRangeLabel,
  initialWeekWindow,
  nextWeeksToLoad,
  jumpWindowForDate,
  mergeTimelineWeeks,
  buildTimelineTileFigures,
} from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/timeline-helpers";
import type { CalendarWorkout } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/calendar-types";
import { addDays, shiftWeek } from "@/lib/week";
import { formatDate } from "@/lib/format";

const CENTER_WEEK = "2026-10-19"; // a real Monday

function workout(overrides: Partial<CalendarWorkout> = {}): CalendarWorkout {
  return {
    id: "w-1",
    scheduledDate: "2026-10-19",
    title: "Tempo run",
    workoutType: "tempo",
    dayLabel: "Tempo",
    sessionSlot: null,
    extras: [],
    notesFromCoach: null,
    plannedDistanceM: 8000,
    plannedDistanceMaxM: null,
    plannedDurationS: null,
    plannedDurationMaxS: null,
    plannedPaceSPerMi: 420,
    plannedPaceMaxSPerMi: 440,
    paceReference: null,
    pacePercentBasis: null,
    pacePercentMin: null,
    pacePercentMax: null,
    resolvedPaceMinSPerMi: null,
    resolvedPaceMaxSPerMi: null,
    paceReferenceSourceLabel: null,
    volumePercent: null,
    resolvedDistanceM: null,
    resolvedDistanceMaxM: null,
    resolvedDurationS: null,
    resolvedDurationMaxS: null,
    volumeSourceLabel: null,
    plannedHrBpm: null,
    plannedHrMaxBpm: null,
    plannedRpe: null,
    plannedRpeMax: null,
    steps: [],
    stepPaceReferences: [],
    publishedAt: "2026-10-01T00:00:00Z",
    completion: null,
    status: "scheduled",
    ...overrides,
  };
}

describe("initialWeekWindow (Timeline's initial continuous-scroll window)", () => {
  it("spans WEEKS_BEHIND_INITIAL weeks before, the center week, and WEEKS_AHEAD_INITIAL weeks after, in chronological order", () => {
    const weeks = initialWeekWindow(CENTER_WEEK);
    expect(weeks).toHaveLength(WEEKS_BEHIND_INITIAL + 1 + WEEKS_AHEAD_INITIAL);
    expect(weeks).toEqual([...weeks].sort());
    expect(weeks).toContain(CENTER_WEEK);
    expect(weeks[WEEKS_BEHIND_INITIAL]).toBe(CENTER_WEEK);
    expect(weeks[0]).toBe(shiftWeek(CENTER_WEEK, -WEEKS_BEHIND_INITIAL));
    expect(weeks[weeks.length - 1]).toBe(shiftWeek(CENTER_WEEK, WEEKS_AHEAD_INITIAL));
  });

  it("~2 weeks behind, ~4 weeks ahead matches the task's own stated defaults", () => {
    expect(WEEKS_BEHIND_INITIAL).toBe(2);
    expect(WEEKS_AHEAD_INITIAL).toBe(4);
  });

  it("is a plain continuous array -- no pagination markers, just week-start strings", () => {
    const weeks = initialWeekWindow(CENTER_WEEK);
    for (const w of weeks) {
      expect(typeof w).toBe("string");
      expect(w).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("nextWeeksToLoad (infinite scroll's load-more step)", () => {
  it("extends backward from the earliest loaded week when scrolling up", () => {
    const more = nextWeeksToLoad(CENTER_WEEK, "before");
    expect(more).toHaveLength(WEEKS_PER_LOAD);
    expect(more[more.length - 1]).toBe(shiftWeek(CENTER_WEEK, -1));
    expect(more[0]).toBe(shiftWeek(CENTER_WEEK, -WEEKS_PER_LOAD));
    expect(more).toEqual([...more].sort());
  });

  it("extends forward from the latest loaded week when scrolling down", () => {
    const more = nextWeeksToLoad(CENTER_WEEK, "after");
    expect(more).toHaveLength(WEEKS_PER_LOAD);
    expect(more[0]).toBe(shiftWeek(CENTER_WEEK, 1));
    expect(more[more.length - 1]).toBe(shiftWeek(CENTER_WEEK, WEEKS_PER_LOAD));
  });
});

describe("mergeTimelineWeeks (the one place week lists get merged, before they become `weeks` state)", () => {
  const block = (weekStart: string) => ({ weekStart });

  it("drops a duplicate weekStart, keeping only its first occurrence", () => {
    const merged = mergeTimelineWeeks([block("2026-09-14"), block("2026-09-21"), block("2026-09-14")]);
    expect(merged.map((w) => w.weekStart)).toEqual(["2026-09-14", "2026-09-21"]);
  });

  it("is a no-op when every weekStart is already unique", () => {
    const weeks = [block("2026-09-07"), block("2026-09-14"), block("2026-09-21")];
    expect(mergeTimelineWeeks(weeks)).toEqual(weeks);
  });

  it("prefers the first-listed occurrence's own object -- a prepend ([...loaded, ...current]) keeps the freshly-fetched week over a stale duplicate already in state", () => {
    const stale = { weekStart: "2026-09-14", tag: "stale" };
    const fresh = { weekStart: "2026-09-14", tag: "fresh" };
    const merged = mergeTimelineWeeks([fresh, stale]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toBe(fresh);
  });

  it("repeated prepend steps starting from a stale (already-loaded) edge never reintroduce a week twice -- the regression this fix guards against", () => {
    // Simulates the actual bug: loadMoreAbove computed from a stale,
    // never-updated edge week (weeksRef not yet wired) would keep
    // re-fetching and re-prepending the exact same nextWeeksToLoad()
    // window every time a sentinel re-intersected. mergeTimelineWeeks is
    // the safety net that makes that scenario harmless even if some
    // future load path reintroduces a stale edge.
    let weeks = initialWeekWindow("2026-09-28").map(block); // includes 2026-09-14 (2 weeks behind)
    const staleEdge = weeks[0].weekStart; // the edge nextWeeksToLoad was (bug-era) always computed from
    for (let i = 0; i < 4; i++) {
      const more = nextWeeksToLoad(staleEdge, "before").map(block);
      weeks = mergeTimelineWeeks([...more, ...weeks]);
    }
    const weekStarts = weeks.map((w) => w.weekStart);
    expect(weekStarts).toHaveLength(new Set(weekStarts).size);
    expect(weekStarts.filter((d) => d === "2026-09-14")).toHaveLength(1);
  });

  it("repeated append steps from the live edge stay unique across many loads", () => {
    let weeks = initialWeekWindow("2026-09-28").map(block);
    for (let i = 0; i < 5; i++) {
      const edge = weeks[weeks.length - 1].weekStart;
      const more = nextWeeksToLoad(edge, "after").map(block);
      weeks = mergeTimelineWeeks([...weeks, ...more]);
    }
    const weekStarts = weeks.map((w) => w.weekStart);
    expect(weekStarts).toHaveLength(new Set(weekStarts).size);
  });

  it("a date-picker jump followed by scroll-triggered loads in both directions never duplicates a weekStart, including 2026-09-14 specifically", () => {
    const { weekStart: jumpWeekStart, weeks: jumpWeeks } = jumpWindowForDate("2026-09-16"); // lands the jump window on 2026-09-14's week
    expect(jumpWeekStart).toBe("2026-09-14");
    let weeks = mergeTimelineWeeks(jumpWeeks.map(block));

    for (let i = 0; i < 3; i++) {
      const topEdge = weeks[0].weekStart;
      const above = nextWeeksToLoad(topEdge, "before").map(block);
      weeks = mergeTimelineWeeks([...above, ...weeks]);

      const bottomEdge = weeks[weeks.length - 1].weekStart;
      const below = nextWeeksToLoad(bottomEdge, "after").map(block);
      weeks = mergeTimelineWeeks([...weeks, ...below]);
    }

    const weekStarts = weeks.map((w) => w.weekStart);
    expect(weekStarts).toHaveLength(new Set(weekStarts).size);
    expect(weekStarts.filter((d) => d === "2026-09-14")).toHaveLength(1);
  });

  it("no sequence of loads produces any date twice -- a general scan across many random-ish jump + scroll sequences", () => {
    const centers = ["2026-01-05", "2026-04-20", "2026-09-14", "2026-12-28"];
    for (const center of centers) {
      let weeks = mergeTimelineWeeks(initialWeekWindow(center).map(block));
      for (let i = 0; i < 6; i++) {
        const direction = i % 2 === 0 ? "before" : "after";
        const edge = direction === "before" ? weeks[0].weekStart : weeks[weeks.length - 1].weekStart;
        const more = nextWeeksToLoad(edge, direction).map(block);
        weeks = direction === "before" ? mergeTimelineWeeks([...more, ...weeks]) : mergeTimelineWeeks([...weeks, ...more]);
      }
      const weekStarts = weeks.map((w) => w.weekStart);
      expect(weekStarts).toHaveLength(new Set(weekStarts).size);
    }
  });
});

describe("weekRangeLabel (sticky header text)", () => {
  it("reads 'Week of <start> – <end>' with the real 7-day span for that week", () => {
    const label = weekRangeLabel(CENTER_WEEK);
    expect(label).toBe(`Week of ${formatDate(CENTER_WEEK)} – ${formatDate(addDays(CENTER_WEEK, 6))}`);
  });

  it("produces a different, correct label for a different week block", () => {
    const nextWeek = shiftWeek(CENTER_WEEK, 1);
    const label = weekRangeLabel(nextWeek);
    expect(label).toBe(`Week of ${formatDate(nextWeek)} – ${formatDate(addDays(nextWeek, 6))}`);
    expect(label).not.toBe(weekRangeLabel(CENTER_WEEK));
  });
});

describe("jumpWindowForDate (date picker's far jump)", () => {
  it("resolves a far-future date to its own Monday-start week, with the same window shape as the initial render", () => {
    const farDate = "2027-03-17"; // months away from CENTER_WEEK
    const { weekStart, weeks } = jumpWindowForDate(farDate);
    expect(weekStart).toBe("2027-03-15"); // the Monday containing 2027-03-17
    expect(weeks).toEqual(initialWeekWindow(weekStart));
    expect(weeks).toContain(weekStart);
  });

  it("resolves a date that already falls on a Monday to that same date", () => {
    const { weekStart } = jumpWindowForDate(CENTER_WEEK);
    expect(weekStart).toBe(CENTER_WEEK);
  });
});

describe("buildTimelineTileFigures (denser tile content)", () => {
  it("shows distance, duration, and pace all inline when a workout has all three set", () => {
    const w = workout({ plannedDistanceM: 8000, plannedDurationS: 2400, plannedPaceSPerMi: 420, plannedPaceMaxSPerMi: 440 });
    const figures = buildTimelineTileFigures(w);
    expect(figures.distanceText).not.toBeNull();
    expect(figures.durationText).not.toBeNull();
    expect(figures.effortText).not.toBeNull();
  });

  it("falls back to RPE as the effort figure only when no pace is set at all", () => {
    const withPace = workout({ plannedPaceSPerMi: 420, plannedPaceMaxSPerMi: null, plannedRpe: 7 });
    expect(buildTimelineTileFigures(withPace).effortText).not.toMatch(/^RPE/);

    const withoutPace = workout({ plannedPaceSPerMi: null, plannedPaceMaxSPerMi: null, plannedRpe: 7, plannedRpeMax: 8 });
    expect(buildTimelineTileFigures(withoutPace).effortText).toBe("RPE 7–8");
  });

  it("resolves a paceReference workout's pace from the resolved fields, not the (null) raw ones", () => {
    const w = workout({
      plannedPaceSPerMi: null,
      plannedPaceMaxSPerMi: null,
      paceReference: "tempo",
      resolvedPaceMinSPerMi: 390,
      resolvedPaceMaxSPerMi: 400,
    });
    expect(buildTimelineTileFigures(w).effortText).not.toBeNull();
  });

  it("gives identical results for a coach-assigned workout and a self-coached one -- same CalendarWorkout shape, same figures, no separate code path", () => {
    const assigned = workout({ id: "assigned-1" });
    const selfCoached = workout({ id: "self-1" }); // coach_id === athlete_id on the DB row -- structurally identical here
    const a = buildTimelineTileFigures(assigned);
    const b = buildTimelineTileFigures(selfCoached);
    expect(a).toEqual(b);
  });

  it("shows nothing fabricated when distance/duration/pace/RPE are all unset", () => {
    const empty = workout({
      plannedDistanceM: null,
      plannedDurationS: null,
      plannedPaceSPerMi: null,
      plannedPaceMaxSPerMi: null,
      plannedRpe: null,
    });
    const figures = buildTimelineTileFigures(empty);
    expect(figures.distanceText).toBeNull();
    expect(figures.durationText).toBeNull();
    expect(figures.effortText).toBeNull();
  });

  // Completion fixture helper -- rpe/hasNotes/effortLevel default to
  // "nothing logged," same as a Strava-only match would leave them.
  function completionOf(overrides: Partial<NonNullable<CalendarWorkout["completion"]>> = {}): NonNullable<CalendarWorkout["completion"]> {
    return {
      actualDistanceM: null,
      actualDurationS: null,
      stravaActivityId: null,
      rpe: null,
      hasNotes: false,
      effortLevel: null,
      ...overrides,
    };
  }

  // Planned-vs-completed (completion-comparison.ts) -- once a tile's own
  // workout is completed, distance/duration switch from planned figures
  // to the comparison; effortText always stays the planned pace/RPE
  // target (CalendarWorkout.completion never carries an actual pace).
  describe("completed-workout figures", () => {
    it("upcoming (status: scheduled) keeps showing planned figures, unaffected by this -- the baseline this whole describe block compares against", () => {
      const w = workout({ status: "scheduled", plannedDistanceM: 8000 });
      expect(buildTimelineTileFigures(w).distanceText).toBe("5mi");
    });

    it("missed keeps showing planned figures too -- a missed workout never had actuals to switch to", () => {
      const w = workout({ status: "missed", plannedDistanceM: 8000, completion: null });
      expect(buildTimelineTileFigures(w).distanceText).toBe("5mi");
    });

    it("completed as planned: one clean actual-only distance figure, within ~10% of the planned 5mi", () => {
      const w = workout({
        status: "completed",
        plannedDistanceM: 8000, // ~4.97mi
        plannedDurationS: null,
        completion: completionOf({ actualDistanceM: 8100 }),
      });
      const figures = buildTimelineTileFigures(w);
      expect(figures.distanceText).not.toContain("→");
      expect(figures.distanceText).toMatch(/mi$/);
    });

    it("completed off-plan, over: shows the delta, planned then actual", () => {
      const w = workout({
        status: "completed",
        plannedDistanceM: 8000,
        plannedDurationS: null,
        completion: completionOf({ actualDistanceM: 16000 }), // roughly double
      });
      expect(buildTimelineTileFigures(w).distanceText).toContain("→");
    });

    it("completed off-plan, under: shows the delta too, not just the over direction", () => {
      const w = workout({
        status: "completed",
        plannedDistanceM: 16000,
        plannedDurationS: null,
        completion: completionOf({ actualDistanceM: 8000 }),
      });
      expect(buildTimelineTileFigures(w).distanceText).toContain("→");
    });

    it("no targets set, completed: shows the actual alone, never a delta arrow, since nothing was ever planned", () => {
      const w = workout({
        status: "completed",
        plannedDistanceM: null,
        plannedDurationS: null,
        completion: completionOf({ actualDistanceM: 8000, actualDurationS: 2400 }),
      });
      const figures = buildTimelineTileFigures(w);
      expect(figures.distanceText).not.toContain("→");
      expect(figures.durationText).not.toContain("→");
    });

    it("no targets set, completed, nothing logged either: both figures null, same as the never-set-anything case above", () => {
      const w = workout({
        status: "completed",
        plannedDistanceM: null,
        plannedDurationS: null,
        plannedPaceSPerMi: null,
        plannedPaceMaxSPerMi: null,
        plannedRpe: null,
        completion: completionOf(),
      });
      const figures = buildTimelineTileFigures(w);
      expect(figures.distanceText).toBeNull();
      expect(figures.durationText).toBeNull();
      expect(figures.effortText).toBeNull();
      expect(figures.feedbackText).toBeNull();
      expect(figures.hasNotes).toBe(false);
      expect(figures.emphasize).toBe(false);
    });

    it("a Strava-matched completion produces identical figures to a manually-logged one with the same actual numbers", () => {
      const manual = workout({
        status: "completed",
        plannedDistanceM: 8000,
        completion: completionOf({ actualDistanceM: 16000 }),
      });
      const strava = workout({
        status: "completed",
        plannedDistanceM: 8000,
        completion: completionOf({ actualDistanceM: 16000, stravaActivityId: 123456 }),
      });
      expect(buildTimelineTileFigures(strava)).toEqual(buildTimelineTileFigures(manual));
    });

    it("a Strava-matched completion with no RPE/notes at all shows no feedback indicators -- Strava doesn't supply them", () => {
      const w = workout({
        status: "completed",
        plannedDistanceM: 8000,
        plannedRpe: 6,
        completion: completionOf({ actualDistanceM: 8100, stravaActivityId: 123456 }),
      });
      const figures = buildTimelineTileFigures(w);
      expect(figures.feedbackText).toBeNull();
      expect(figures.hasNotes).toBe(false);
      expect(figures.emphasize).toBe(false);
    });

    it("effortText always stays the planned pace/RPE target regardless of completion -- no actual pace is ever fabricated", () => {
      const w = workout({
        status: "completed",
        plannedDistanceM: 8000,
        plannedPaceSPerMi: 420,
        plannedPaceMaxSPerMi: 440,
        completion: completionOf({ actualDistanceM: 16000 }),
      });
      expect(buildTimelineTileFigures(w).effortText).not.toBeNull();
    });
  });

  // RPE/notes feedback indicators -- the tile's own view of
  // completion-comparison.ts's describeRpe/isRpeNoteworthy.
  describe("RPE and notes feedback", () => {
    it("shows nothing when no RPE was logged, even on a completed workout", () => {
      const w = workout({ status: "completed", plannedRpe: 6, completion: completionOf({ actualDistanceM: 8000 }) });
      expect(buildTimelineTileFigures(w).feedbackText).toBeNull();
    });

    it("shows the logged RPE alone when no prescribed RPE exists at all", () => {
      const w = workout({ status: "completed", plannedRpe: null, completion: completionOf({ actualDistanceM: 8000, rpe: 9 }) });
      expect(buildTimelineTileFigures(w).feedbackText).toBe("RPE 9");
    });

    it("pairing boundary: a 1-point difference from prescribed stays logged-only", () => {
      const w = workout({ status: "completed", plannedRpe: 6, completion: completionOf({ actualDistanceM: 8000, rpe: 7 }) });
      expect(buildTimelineTileFigures(w).feedbackText).toBe("RPE 7");
    });

    it("pairing boundary: exactly a 2-point difference shows the pair", () => {
      const w = workout({ status: "completed", plannedRpe: 6, completion: completionOf({ actualDistanceM: 8000, rpe: 8 }) });
      expect(buildTimelineTileFigures(w).feedbackText).toBe("RPE 6 → 8");
    });

    it("emphasis boundary: exactly a 2-point difference above prescribed is not yet noteworthy", () => {
      const w = workout({ status: "completed", plannedRpe: 6, completion: completionOf({ actualDistanceM: 8000, rpe: 8 }) });
      expect(buildTimelineTileFigures(w).emphasize).toBe(false);
    });

    it("emphasis boundary: exactly a 3-point difference above prescribed is noteworthy", () => {
      const w = workout({ status: "completed", plannedRpe: 6, completion: completionOf({ actualDistanceM: 8000, rpe: 9 }) });
      expect(buildTimelineTileFigures(w).emphasize).toBe(true);
    });

    it("emphasis boundary, unprescribed: RPE 8 with nothing prescribed is not noteworthy", () => {
      const w = workout({ status: "completed", plannedRpe: null, completion: completionOf({ actualDistanceM: 8000, rpe: 8 }) });
      expect(buildTimelineTileFigures(w).emphasize).toBe(false);
    });

    it("emphasis boundary, unprescribed: RPE 9 with nothing prescribed is noteworthy", () => {
      const w = workout({ status: "completed", plannedRpe: null, completion: completionOf({ actualDistanceM: 8000, rpe: 9 }) });
      expect(buildTimelineTileFigures(w).emphasize).toBe(true);
    });

    it("hasNotes mirrors the completion's own hasNotes flag exactly", () => {
      const withNote = workout({ status: "completed", completion: completionOf({ actualDistanceM: 8000, hasNotes: true }) });
      const withoutNote = workout({ status: "completed", completion: completionOf({ actualDistanceM: 8000, hasNotes: false }) });
      expect(buildTimelineTileFigures(withNote).hasNotes).toBe(true);
      expect(buildTimelineTileFigures(withoutNote).hasNotes).toBe(false);
    });

    it("an upcoming or missed workout never shows feedback indicators -- nothing has been logged yet", () => {
      const upcoming = workout({ status: "scheduled", plannedRpe: 6 });
      const missed = workout({ status: "missed", plannedRpe: 6, completion: null });
      expect(buildTimelineTileFigures(upcoming).feedbackText).toBeNull();
      expect(buildTimelineTileFigures(upcoming).hasNotes).toBe(false);
      expect(buildTimelineTileFigures(upcoming).emphasize).toBe(false);
      expect(buildTimelineTileFigures(missed).feedbackText).toBeNull();
    });

    it("tiles without any subjective data render byte-identical to the pre-feedback planned-vs-completed output -- feedbackText null, hasNotes false, emphasize false, same distance/duration/effort as before", () => {
      const w = workout({
        status: "completed",
        plannedDistanceM: 8000,
        plannedDurationS: null,
        completion: completionOf({ actualDistanceM: 8100 }),
      });
      const figures = buildTimelineTileFigures(w);
      expect(figures).toEqual({
        distanceText: figures.distanceText,
        durationText: figures.durationText,
        effortText: figures.effortText,
        feedbackText: null,
        hasNotes: false,
        emphasize: false,
      });
    });
  });
});
