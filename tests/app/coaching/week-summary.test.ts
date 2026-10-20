import { describe, expect, it } from "vitest";

import { createScriptedSupabaseClient } from "../supabase-test-utils";
import { fetchWeekSummary } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/calendar-data";
import { MILE_METERS } from "@/lib/race-distances";

// fetchWeekSummary backs WeekStrip's collapsed adjacent-week summary
// cards. totalDistanceM must sum the exact same workout set `days`
// lists -- it previously filtered to published_at-only while `days`
// listed every row regardless of publish status, so an entirely-draft
// future week (the normal state for a week a coach hasn't published yet)
// showed every day's real distance in its label but a silently-wrong
// "0.0 mi planned" total. See weekly-load.ts's own, earlier fix for the
// scheduled-total/publish-status bug this mirrors.

function scheduledWorkoutRow(overrides: Record<string, unknown> = {}) {
  return {
    scheduled_date: "2026-10-26",
    title: "Easy",
    day_label: "Easy",
    planned_distance_m: 8000,
    planned_distance_max_m: null,
    planned_duration_s: null,
    planned_duration_max_s: null,
    planned_volume_percent: null,
    published_at: null,
    ...overrides,
  };
}

describe("fetchWeekSummary", () => {
  it("a future week that's entirely drafts sums the same total the day list shows -- not 0", async () => {
    const rows = [
      scheduledWorkoutRow({ scheduled_date: "2026-10-26", planned_distance_m: 8 * MILE_METERS, published_at: null }),
      scheduledWorkoutRow({ scheduled_date: "2026-10-27", planned_distance_m: 9 * MILE_METERS, published_at: null }),
    ];
    const { client } = createScriptedSupabaseClient(
      [
        { table: "scheduled_workouts", result: { data: rows, error: null } },
        { table: "training_week_plans", result: { data: [], error: null } },
      ],
      "coach-1",
    );

    const summary = await fetchWeekSummary(client as never, "athlete-1", "coach-1", "2026-10-26", "2026-11-01");

    expect(summary.totalDistanceM).toBe(8 * MILE_METERS + 9 * MILE_METERS);
    // The day list already included these two real, unpublished workouts.
    expect(summary.days.find((d) => d.date === "2026-10-26")?.label).toBe("Easy 8mi");
    expect(summary.days.find((d) => d.date === "2026-10-27")?.label).toBe("Easy 9mi");
  });

  it("a previous (already-published) week is unaffected -- same total as before", async () => {
    const rows = [scheduledWorkoutRow({ scheduled_date: "2026-10-19", planned_distance_m: 6 * MILE_METERS, published_at: "2026-10-01T00:00:00Z" })];
    const { client } = createScriptedSupabaseClient(
      [
        { table: "scheduled_workouts", result: { data: rows, error: null } },
        { table: "training_week_plans", result: { data: [], error: null } },
      ],
      "coach-1",
    );

    const summary = await fetchWeekSummary(client as never, "athlete-1", "coach-1", "2026-10-19", "2026-10-25");

    expect(summary.totalDistanceM).toBe(6 * MILE_METERS);
  });

  it("a day with no scheduled_workouts row at all reads 'Off', contributing nothing to the total", async () => {
    const { client } = createScriptedSupabaseClient(
      [
        { table: "scheduled_workouts", result: { data: [], error: null } },
        { table: "training_week_plans", result: { data: [], error: null } },
      ],
      "coach-1",
    );

    const summary = await fetchWeekSummary(client as never, "athlete-1", "coach-1", "2026-10-26", "2026-11-01");

    expect(summary.totalDistanceM).toBe(0);
    expect(summary.days.every((d) => d.label === "Off")).toBe(true);
  });
});
