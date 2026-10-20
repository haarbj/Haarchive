"use server";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { weekDates } from "@/lib/week";
import { fetchCalendarWorkouts } from "./calendar-data";
import type { CalendarWorkout } from "./calendar-types";
import type { TimelineWeekBlock } from "./timeline-helpers";

export type TimelineWeek = TimelineWeekBlock<CalendarWorkout>;

// Timeline View's own data loader -- called from the client as the coach
// scrolls past the server-rendered initial window, or jumps via the date
// picker. Read-only: no assignment/completion logic lives here, it's the
// exact same fetchCalendarWorkouts every other view's own server
// component already calls, just invoked from a client component instead
// of inline in a Server Component (continuous scroll has to fetch more
// data in response to a scroll/intersection event, which a plain Server
// Component render can't do). RLS (scheduled_workouts scoped to
// coach_id = auth.uid()) is the real authorization boundary here, same
// as fetchCalendarWorkouts' other callers; the isPrivateCoach check below
// just keeps a non-coach session from spending the query at all.
export async function loadTimelineWeeks(athleteId: string, weekStarts: string[]): Promise<TimelineWeek[]> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return [];
  if (weekStarts.length === 0) return [];

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const allDates = weekStarts.flatMap((weekStart) => weekDates(weekStart));
  const workoutsByDate = await fetchCalendarWorkouts(supabase, athleteId, session.userId, allDates, today);

  return weekStarts.map((weekStart) => ({
    weekStart,
    itemsByDate: Object.fromEntries(weekDates(weekStart).map((d) => [d, workoutsByDate[d] ?? []])),
  }));
}
