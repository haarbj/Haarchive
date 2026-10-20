"use client";

import { useEffect, useRef, useState } from "react";

import { addDays } from "@/lib/week";
import { getDayTypeAccent, DAY_TYPE_BORDER_CLASSES, abbreviateDayLabel } from "@/lib/private-coaching/day-type-visuals";
import { getWorkoutDisplayLabel } from "@/lib/private-coaching/workout-status";
import { getPhaseForWeek, weekPositionInPhase, type TrainingPhase } from "@/lib/private-coaching/training-phases";
import { useCalendarWorkoutEditor } from "./calendar-workout-editor";
import { loadTimelineWeeks, type TimelineWeek } from "./timeline-actions";
import { weekRangeLabel, nextWeeksToLoad, jumpWindowForDate, mergeTimelineWeeks, buildTimelineTileFigures } from "./timeline-helpers";
import type { CalendarWorkout } from "./calendar-types";
import type { ExtraPresetOption } from "./actions";
import type { TemplateOption } from "./workout-form";

const WEEKDAY_COUNT = 7;

const STATUS_DOT: Record<CalendarWorkout["status"], string> = {
  draft: "bg-accent-warning",
  scheduled: "bg-zinc-400 dark:bg-zinc-500",
  completed: "bg-accent-success",
  missed: "bg-accent-error",
};

// Timeline View -- a continuous, scrollable presentation of the exact
// same scheduled_workouts data Week/Day/Month/Phase already render (via
// the shared fetchCalendarWorkouts, here called through timeline-
// actions.ts since this component loads more weeks itself as the coach
// scrolls, rather than the server component owning one bounded range up
// front the way every other view does). Click-to-edit reuses
// useCalendarWorkoutEditor -- the exact same hook Week View and Month
// View mount -- so completing/editing a workout from here is the same
// code path, not a parallel one; "works identically to Week View" is
// true by construction, not by re-testing the same logic twice. The
// actual date-window math and tile-figure formatting live in
// timeline-helpers.ts as plain functions, unit-tested there -- this file
// is just the stateful scroll/fetch/DOM wiring around them.
export function TimelineView({
  athleteId,
  initialWeeks,
  centerWeek,
  today,
  templates,
  extraPresets,
  phases,
}: {
  athleteId: string;
  initialWeeks: TimelineWeek[];
  centerWeek: string;
  today: string;
  templates: TemplateOption[];
  extraPresets: ExtraPresetOption[];
  phases: TrainingPhase[];
}) {
  const [weeks, setWeeks] = useState<TimelineWeek[]>(initialWeeks);
  const [loadingTop, setLoadingTop] = useState(false);
  const [loadingBottom, setLoadingBottom] = useState(false);
  const [dateInput, setDateInput] = useState(centerWeek);
  const [pendingScrollTarget, setPendingScrollTarget] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const weekRefs = useRef<Map<string, HTMLElement>>(new Map());

  // The IntersectionObserver below is created once per athleteId (its
  // effect deps are `[athleteId]`, not `[weeks]`, so it doesn't churn on
  // every scroll-triggered load) and holds onto loadMoreAbove/
  // loadMoreBelow from whatever render it mounted on. Reading `weeks`/
  // `loadingTop`/`loadingBottom` as plain closed-over state there means
  // every later sentinel intersection would see that *first* render's
  // values forever -- the actual bug behind the reported duplicate-key
  // warning: a second intersection of the same sentinel re-ran
  // nextWeeksToLoad from the *original* edge week every time, silently
  // re-fetching (and re-appending) a window it had already loaded. Refs
  // are mutable objects whose identity never changes across renders, so
  // keeping weeksRef synced after each commit (the effect just below)
  // lets the original, never-re-subscribed closures still read the
  // current value when they actually run; loadingTopRef/loadingBottomRef
  // are set directly inside loadMoreAbove/loadMoreBelow themselves (an
  // event-handler-like context, not render), which is safe without an
  // effect.
  const weeksRef = useRef(weeks);
  useEffect(() => {
    weeksRef.current = weeks;
  }, [weeks]);
  const loadingTopRef = useRef(false);
  const loadingBottomRef = useRef(false);

  const { openCreate, openEdit, editorModals } = useCalendarWorkoutEditor({ athleteId, templates, extraPresets });

  // A save inside the editor modal calls router.refresh(), which re-runs
  // the server component and hands this component a brand-new
  // initialWeeks array -- collapsing back to that fresh initial window is
  // the correct, honest thing to do here (it reflects the just-saved
  // change immediately), the same way Week View's own re-render after a
  // save just shows whatever the server now returns for that one week.
  // Render-phase state adjustment (React's documented alternative to an
  // effect for "reset state when this other state/prop changes") -- same
  // pattern dashboard/weekly-checkin-card.tsx already uses, avoiding the
  // extra effect-triggered render pass a useEffect version would add.
  const [prevInitialWeeks, setPrevInitialWeeks] = useState(initialWeeks);
  if (initialWeeks !== prevInitialWeeks) {
    setPrevInitialWeeks(initialWeeks);
    setWeeks(initialWeeks);
  }

  async function loadMoreAbove() {
    if (loadingTopRef.current || weeksRef.current.length === 0) return;
    loadingTopRef.current = true;
    setLoadingTop(true);
    const toLoad = nextWeeksToLoad(weeksRef.current[0].weekStart, "before");
    const container = containerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    const prevScrollTop = container?.scrollTop ?? 0;
    const loaded = await loadTimelineWeeks(athleteId, toLoad);
    setWeeks((current) => mergeTimelineWeeks([...loaded, ...current]));
    // Prepending content above the viewport shifts everything below it
    // down by exactly the new content's height -- restore scrollTop by
    // that same delta on the next paint so the coach's own scroll
    // position visually holds still instead of jumping.
    requestAnimationFrame(() => {
      if (!container) return;
      const delta = container.scrollHeight - prevScrollHeight;
      container.scrollTop = prevScrollTop + delta;
    });
    loadingTopRef.current = false;
    setLoadingTop(false);
  }

  async function loadMoreBelow() {
    if (loadingBottomRef.current || weeksRef.current.length === 0) return;
    loadingBottomRef.current = true;
    setLoadingBottom(true);
    const toLoad = nextWeeksToLoad(weeksRef.current[weeksRef.current.length - 1].weekStart, "after");
    const loaded = await loadTimelineWeeks(athleteId, toLoad);
    setWeeks((current) => mergeTimelineWeeks([...current, ...loaded]));
    loadingBottomRef.current = false;
    setLoadingBottom(false);
  }

  useEffect(() => {
    const container = containerRef.current;
    const topSentinel = topSentinelRef.current;
    const bottomSentinel = bottomSentinelRef.current;
    if (!container || !topSentinel || !bottomSentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.target === topSentinel) void loadMoreAbove();
          if (entry.target === bottomSentinel) void loadMoreBelow();
        }
      },
      { root: container, rootMargin: "200px 0px" },
    );
    observer.observe(topSentinel);
    observer.observe(bottomSentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadMoreAbove/loadMoreBelow read the live edge week and loading flags via weeksRef/loadingTopRef/loadingBottomRef (see their declaration above), not closed-over state, so this observer is safe to create once per athleteId instead of re-subscribing (and churning the IntersectionObserver instance) on every scroll-triggered load.
  }, [athleteId]);

  // The date picker's jump target: fetch a fresh window centered on the
  // picked date's own week (the same shape the initial server-rendered
  // window uses, via jumpWindowForDate) and scroll straight to it -- the
  // "jump without paging through months" requirement a date picker
  // exists to solve.
  async function jumpToDate(isoDate: string) {
    const { weekStart, weeks: toLoad } = jumpWindowForDate(isoDate);
    const loaded = await loadTimelineWeeks(athleteId, toLoad);
    setWeeks(mergeTimelineWeeks(loaded));
    setPendingScrollTarget(weekStart);
  }

  useEffect(() => {
    if (!pendingScrollTarget) return;
    const el = weekRefs.current.get(pendingScrollTarget);
    if (el) {
      el.scrollIntoView({ block: "start" });
      setPendingScrollTarget(null);
    }
    // If the target week's section hasn't mounted yet (state update not
    // flushed to the DOM), this effect re-runs on the next render since
    // pendingScrollTarget is still set -- it clears itself the first
    // render where the ref is actually found.
  }, [pendingScrollTarget, weeks]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Scroll to browse training continuously, or jump to a date.</p>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">Jump to</span>
          <input
            type="date"
            value={dateInput}
            onChange={(e) => {
              setDateInput(e.target.value);
              if (e.target.value) void jumpToDate(e.target.value);
            }}
            className="rounded-control border border-black/10 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
            aria-label="Jump to date"
          />
        </label>
      </div>

      <div
        ref={containerRef}
        className="relative mt-3 h-[70vh] min-h-[420px] overflow-y-auto overscroll-contain rounded-control border border-black/10 dark:border-white/10"
      >
        <div ref={topSentinelRef} className="h-px" />
        {loadingTop ? <p className="py-2 text-center text-xs text-zinc-500 dark:text-zinc-400">Loading earlier weeks…</p> : null}

        {weeks.map((week) => {
          const phase = getPhaseForWeek(phases, week.weekStart);
          const position = phase ? weekPositionInPhase(phase, week.weekStart) : null;
          const days = Array.from({ length: WEEKDAY_COUNT }, (_, i) => addDays(week.weekStart, i));

          return (
            <section
              key={week.weekStart}
              ref={(el) => {
                if (el) weekRefs.current.set(week.weekStart, el);
                else weekRefs.current.delete(week.weekStart);
              }}
            >
              {/* Sticky within this section only: as the next section's
                  own sticky header reaches the top of the scroll
                  container, normal document flow pushes this one out
                  (both are `sticky top-0` siblings in the same scroll
                  container) -- the standard "stacking sticky section
                  headers" CSS pattern, no JS required for the handoff
                  itself. */}
              <div className="sticky top-0 z-10 border-b border-black/10 bg-white/95 px-3 py-2 backdrop-blur dark:border-white/10 dark:bg-zinc-950/95">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">{weekRangeLabel(week.weekStart)}</p>
                {phase ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {phase.phaseType}
                    {phase.name ? ` — ${phase.name}` : ""}
                    {position ? ` · Week ${position.week} of ${position.of}` : ""}
                  </p>
                ) : null}
              </div>

              <div className="divide-y divide-black/5 dark:divide-white/5">
                {days.map((date) => {
                  const dayWorkouts = week.workoutsByDate[date] ?? [];
                  const isToday = date === today;
                  return (
                    <div key={date} className={`px-3 py-2 ${isToday ? "bg-accent-tip/5" : ""}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-semibold ${isToday ? "text-accent-tip" : "text-zinc-500 dark:text-zinc-400"}`}>
                          {new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
                          {isToday ? " · Today" : ""}
                        </p>
                        <button
                          type="button"
                          onClick={() => openCreate(date)}
                          className="text-xs font-semibold text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                        >
                          + Add
                        </button>
                      </div>

                      <div className="mt-1.5 space-y-1.5">
                        {dayWorkouts.map((workout) => (
                          <TimelineTile key={workout.id} workout={workout} onOpen={() => openEdit(date, workout)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {loadingBottom ? <p className="py-2 text-center text-xs text-zinc-500 dark:text-zinc-400">Loading more weeks…</p> : null}
        <div ref={bottomSentinelRef} className="h-px" />
      </div>

      {editorModals}
    </div>
  );
}

// Denser than every other view's tile on purpose (this view's whole
// reason to exist): distance, duration, and pace/effort all render
// inline, every time, rather than Month View's "pick whichever single
// figure fits" compact chip or Week/Day's click-to-expand detail. Scoped
// to this file only -- WorkoutCard (Week/Day) and Month View's own inline
// row keep their existing density untouched. The actual figure text comes
// from buildTimelineTileFigures (timeline-helpers.ts) -- this component
// only lays it out.
function TimelineTile({ workout, onOpen }: { workout: CalendarWorkout; onOpen: () => void }) {
  const accent = getDayTypeAccent(workout.dayLabel);
  const { distanceText, durationText, effortText } = buildTimelineTileFigures(workout);
  const label = getWorkoutDisplayLabel(workout.dayLabel, workout.title);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`block w-full rounded-control border-l-2 bg-black/[0.02] px-2 py-1.5 text-left hover:bg-black/5 dark:bg-white/[0.03] dark:hover:bg-white/10 ${DAY_TYPE_BORDER_CLASSES[accent]}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[workout.status]}`} aria-hidden />
        <span className="truncate text-sm font-medium text-zinc-900 dark:text-white">
          {workout.sessionSlot ? `${workout.sessionSlot} ` : ""}
          {abbreviateDayLabel(label)}
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-600 dark:text-zinc-300">
        {distanceText ? <span>{distanceText}</span> : null}
        {durationText ? <span>{durationText}</span> : null}
        {effortText ? <span>{effortText}</span> : null}
        {!distanceText && !durationText && !effortText ? <span className="text-zinc-400 dark:text-zinc-500">No targets set</span> : null}
      </div>
    </button>
  );
}
