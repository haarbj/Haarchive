"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { Flag, Pencil } from "lucide-react";

import type { CalendarWorkout } from "./calendar-types";
import type { ExtraPresetOption } from "./actions";
import type { TemplateOption } from "./workout-form";
import type { AthleteGoalRace } from "@/lib/private-coaching/goal-race";
import { getDayTypeAccent, DAY_TYPE_BORDER_CLASSES, abbreviateDayLabel } from "@/lib/private-coaching/day-type-visuals";
import { getWorkoutDisplayLabel, describeWorkoutDetail, effectiveWorkoutVolume } from "@/lib/private-coaching/workout-status";
import {
  getWorkoutPlannedDistanceM,
  formatDurationRange,
  formatPaceRange,
  formatCompactDistanceRange,
} from "@/lib/private-coaching/workout-distance";
import { useCalendarWorkoutEditor } from "./calendar-workout-editor";
import { WeekCopyPasteControls } from "./week-copy-paste-controls";
import { WeekPlanQuickEditModal, type WeekPlanValues } from "./week-plan-editor";

// Mirrors formatCompactDistanceRange's own terseness, applied to the
// coach's own training_week_plans target -- "35–40mi"/"60min", not
// WeekPlanEditor's spelled-out "35–40 miles" (which has the room for it).
function formatCompactTargetVolume(min: number | null, max: number | null, unit: "miles" | "minutes" | null): string | null {
  if (min == null) return null;
  const abbrev = unit === "minutes" ? "min" : "mi";
  if (max == null || max === min) return `${min}${abbrev}`;
  return `${min}–${max}${abbrev}`;
}

const STATUS_DOT: Record<CalendarWorkout["status"], string> = {
  draft: "bg-accent-warning",
  scheduled: "bg-zinc-400 dark:bg-zinc-500",
  completed: "bg-accent-success",
  missed: "bg-accent-error",
};

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// A day very rarely carries more than 2 sessions (an AM/PM double, or a
// main session plus XT) -- capped so a rare 3rd+ session overflows into
// Day View rather than squeezing every card down to illegibility.
const MAX_VISIBLE_PER_DAY = 2;

const WEEK_COLUMN_BG = "bg-zinc-100/70 dark:bg-zinc-900/70";

// One row's worth of context alongside its 7 day cells -- title/phase,
// the coach's own target volume, and distance-to-goal-race, the same
// three facts a coach otherwise has to open Week View or Phase View to
// see. The volume figure is the coach-set training_week_plans target
// (what WeekPlanEditor's own "Target: 35–40 miles" shows), deliberately
// NOT a sum of scheduled workouts' planned distance -- that's a different,
// still-deferred "weekly load" computation (see calendar-data.ts's own
// guardrail comment on WeekStrip), and conflating the two here would be
// exactly the kind of scope creep that guardrail exists to prevent. Null
// (rendered as nothing, never "0") when no target has been set for that
// week at all.
export type MonthWeekSummary = {
  weekStart: string;
  /** training_week_plans.label if set, else the covering phase's type, else null -- DISPLAY only. */
  title: string | null;
  /** The raw training_week_plans.label, with no phase-type fallback -- what the quick-edit modal's Week title field actually seeds from, so it never shows a phase name as if it had been typed in as the week's own title. */
  rawLabel: string | null;
  /** training_week_plans.notes, for seeding the quick-edit modal's Week notes field -- Month View's own compact row never displays this directly, same "no room for a paragraph here" reasoning as the roadmap's WeekRow. */
  rawNotes: string | null;
  targetVolumeMin: number | null;
  targetVolumeMax: number | null;
  targetVolumeUnit: "miles" | "minutes" | null;
  /** e.g. "14 weeks away", "This is race week", "3 weeks ago", or "" if no goal race. */
  weeksAwayLabel: string;
};

// A dense overview, not a scrollable one: the whole grid stays inside the
// page's own content width (no forced min-width/horizontal scroll). Each
// workout is "AM 4-6mi Easy" -- slot, then range/steps, then day label,
// the coaching shorthand order -- with extras (if any) on their own
// second line, and a compact number format ("4-6mi", no trailing ".0")
// distinct from WorkoutCard's own label-first heading and one-decimal
// formatDistanceRange, which have room to spare and don't need either.
// Click-to-edit and +Add reuse the
// same useCalendarWorkoutEditor hook Week/Day views use. An explicit
// per-week summary column (title/phase, mileage, weeks to the goal race)
// and a visually distinct cell for the goal race date round out "can a
// coach understand a month at a glance" without opening Week or Phase
// View first.
export function MonthView({
  athleteId,
  monthIso,
  gridDates,
  workoutsByDate,
  today,
  templates,
  extraPresets,
  goalRace,
  weekSummaries,
  copiedWeek,
}: {
  athleteId: string;
  monthIso: string;
  gridDates: string[];
  workoutsByDate: Record<string, CalendarWorkout[]>;
  today: string;
  templates: TemplateOption[];
  extraPresets: ExtraPresetOption[];
  goalRace: AthleteGoalRace | null;
  weekSummaries: Record<string, MonthWeekSummary>;
  // Copy/Paste's currently-copied week (see week-copy-paste-controls.tsx)
  // -- carried as the `?copiedWeek=` param on this same `view=month` page,
  // so a coach can Copy one week's row and Paste onto any other visible
  // week without leaving Month View or remembering/retyping a date.
  copiedWeek: string | null;
}) {
  const { openCreate, openEdit, editorModals } = useCalendarWorkoutEditor({ athleteId, templates, extraPresets });
  // Which week's plan (title/target volume) is being quick-edited, if any
  // -- mirrors useCalendarWorkoutEditor's own single-target-at-a-time
  // state shape, just scoped to week plans instead of workouts.
  const [weekPlanTarget, setWeekPlanTarget] = useState<string | null>(null);

  const weeks: string[][] = [];
  for (let i = 0; i < gridDates.length; i += 7) weeks.push(gridDates.slice(i, i + 7));

  return (
    <div>
      <div className="overflow-hidden rounded-control border border-black/10 dark:border-white/10">
        <div className="grid grid-cols-8 gap-px bg-black/10 dark:bg-white/10">
          {WEEKDAY_HEADERS.map((d) => (
            <div key={d} className="bg-white p-2 text-center text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:bg-zinc-950 dark:text-zinc-400">
              {d}
            </div>
          ))}
          <div className={`p-2 text-center text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400 ${WEEK_COLUMN_BG}`}>
            Week
          </div>

          {/* Every week's 8 cells render into THIS SAME grid (via a
              keyed Fragment, not a wrapping div) rather than each week
              being its own separate grid -- a separate grid per week
              means gap-px only ever separates cells within one row, never
              between one week and the next, which is exactly what made
              e.g. every Saturday down the month read as one unbroken
              column. A single grid's automatic row-wrapping (8 cells per
              row) gives every row, including between weeks, the same
              hairline gap. */}
          {weeks.map((weekDates) => {
            const weekStart = weekDates[0];
            const summary = weekSummaries[weekStart];
            return (
              <Fragment key={weekStart}>
                {weekDates.map((date) => {
                  const inMonth = date.slice(0, 7) === monthIso;
                  const workouts = workoutsByDate[date] ?? [];
                  const isToday = date === today;
                  const isRaceDay = goalRace?.goalDate === date;
                  const cellBg = isRaceDay ? "bg-accent-navy/5" : "bg-white dark:bg-zinc-950";
                  return (
                    <div
                      key={date}
                      className={`min-h-[132px] p-1.5 ${cellBg} ${inMonth ? "" : "opacity-40"} ${
                        isRaceDay ? "ring-1 ring-inset ring-accent-navy" : isToday ? "ring-1 ring-inset ring-accent-tip" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Link
                          href={`?view=day&date=${date}`}
                          className={`text-xs hover:underline ${
                            isToday ? "font-semibold text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"
                          }`}
                        >
                          {Number(date.slice(8, 10))}
                        </Link>
                        {isRaceDay ? <Flag className="h-3 w-3 shrink-0 text-accent-navy" aria-label="Goal race" /> : null}
                      </div>

                      <div className="mt-1 space-y-0.5">
                        {workouts.slice(0, MAX_VISIBLE_PER_DAY).map((w) => {
                          const accent = getDayTypeAccent(w.dayLabel);
                          // Month View stays compact: a resolved reference
                          // shows its plain number here (via the exact same
                          // formatPaceRange every other numeric pace uses),
                          // never the "(Threshold Pace)" / source-race
                          // detail WorkoutCard shows -- that's the
                          // deliberate scope cut already established for
                          // this view (see its own file-level comment).
                          // w.plannedPaceSPerMi/MaxSPerMi are the raw,
                          // untouched DB fields and stay null whenever a
                          // reference is active -- resolvedPace* are the
                          // ones to read in that case.
                          const { stepsSummary, extrasText } = describeWorkoutDetail(w, {
                            workoutPace:
                              w.paceReference && w.resolvedPaceMinSPerMi != null
                                ? { minSPerMi: w.resolvedPaceMinSPerMi, maxSPerMi: w.resolvedPaceMaxSPerMi, sourceLabel: w.paceReferenceSourceLabel ?? "" }
                                : null,
                            stepPaces: w.stepPaceReferences,
                          });
                          const label = abbreviateDayLabel(getWorkoutDisplayLabel(w.dayLabel, w.title));
                          // A volume-percent day resolves to its real
                          // figure here too, same as pace below -- Month
                          // View's own compact chip never shows the raw
                          // percent or a "no target set" fallback (no room
                          // for it at this density); it just shows nothing
                          // when unresolved, same as any other workout with
                          // no distance/duration set at all.
                          const effectiveVolume = effectiveWorkoutVolume(w);
                          const distanceText = formatCompactDistanceRange(
                            getWorkoutPlannedDistanceM(effectiveVolume.distanceM),
                            effectiveVolume.distanceMaxM,
                          );
                          const durationText = formatDurationRange(effectiveVolume.durationS, effectiveVolume.durationMaxS);
                          const paceText = w.paceReference
                            ? formatPaceRange(w.resolvedPaceMinSPerMi, w.resolvedPaceMaxSPerMi)
                            : formatPaceRange(w.plannedPaceSPerMi, w.plannedPaceMaxSPerMi);
                          const rangeText = [distanceText, durationText, paceText].filter(Boolean).join(" · ") || null;
                          const detail = rangeText ?? stepsSummary;
                          // "AM 4-6mi Easy" -- slot, then the number, then
                          // what kind of day it is, the coaching shorthand
                          // order -- not WorkoutCard's own label-first
                          // heading, which has room to spare and doesn't
                          // need it. Extras (if any) get their own line.
                          const line1 = [w.sessionSlot, detail, label].filter(Boolean).join(" ");
                          return (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => openEdit(date, w)}
                              title={extrasText ? `${line1} w/ ${extrasText}` : line1}
                              className={`block w-full border-l-2 pl-1 text-left text-[11px] leading-tight text-zinc-700 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5 ${DAY_TYPE_BORDER_CLASSES[accent]}`}
                            >
                              <span className="flex items-center gap-1">
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[w.status]}`} aria-hidden />
                                <span className="truncate font-medium">{line1}</span>
                              </span>
                              {extrasText ? <span className="block truncate text-zinc-500 dark:text-zinc-400">w/ {extrasText}</span> : null}
                            </button>
                          );
                        })}
                        {workouts.length > MAX_VISIBLE_PER_DAY ? (
                          <Link href={`?view=day&date=${date}`} className="block text-[10px] text-zinc-400 hover:underline dark:text-zinc-500">
                            +{workouts.length - MAX_VISIBLE_PER_DAY} more
                          </Link>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => openCreate(date)}
                        className="mt-0.5 w-full rounded-control border border-dashed border-black/10 py-0.5 text-[10px] font-semibold text-zinc-400 hover:border-black/25 hover:text-zinc-600 dark:border-white/10 dark:text-zinc-500 dark:hover:border-white/25 dark:hover:text-zinc-300"
                      >
                        + Add
                      </button>
                    </div>
                  );
                })}

                <div className={`min-h-[132px] p-1.5 ${WEEK_COLUMN_BG}`}>
                  <Link href={`?view=week&week=${weekStart}`} className="block hover:underline">
                    <p className="truncate text-xs font-semibold text-zinc-900 dark:text-white">{summary?.title ?? "—"}</p>
                    {summary ? (
                      <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                        {formatCompactTargetVolume(summary.targetVolumeMin, summary.targetVolumeMax, summary.targetVolumeUnit) ?? "No target set"}
                      </p>
                    ) : null}
                    {summary?.weeksAwayLabel ? (
                      <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">{summary.weeksAwayLabel}</p>
                    ) : null}
                  </Link>
                  {/* Copy/Paste this week's workouts -- reuses the exact
                      same copyWeek action Week View's own controls use, see
                      week-copy-paste-controls.tsx. `compact` shortens the
                      Paste label since this column has far less room. */}
                  <div className="mt-1 flex items-center gap-1.5">
                    <WeekCopyPasteControls
                      athleteId={athleteId}
                      baseParams={{ view: "month", month: monthIso }}
                      week={weekStart}
                      copiedWeek={copiedWeek}
                      compact
                    />
                    {/* Quick-edit this week's title/target volume without
                        leaving Month View -- the same "edit in an overlay,
                        not by navigating away" pattern individual day cells
                        already get via useCalendarWorkoutEditor. The
                        title/target text above is still a real Link to
                        full Week View for anyone who wants that instead. */}
                    <button
                      type="button"
                      onClick={() => setWeekPlanTarget(weekStart)}
                      aria-label="Edit week plan"
                      title="Edit week plan"
                      className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      {editorModals}

      {weekPlanTarget ? (
        <WeekPlanQuickEditModal
          athleteId={athleteId}
          weekStart={weekPlanTarget}
          initial={weekPlanValuesFor(weekSummaries[weekPlanTarget])}
          onClose={() => setWeekPlanTarget(null)}
        />
      ) : null}
    </div>
  );
}

// weekSummaries[weekStart] is only ever undefined for a week genuinely
// outside the fetched range (shouldn't happen for a week visible in this
// same grid) -- falls back to "no plan yet" rather than throwing, so a
// coach can still set one from scratch via the modal either way.
function weekPlanValuesFor(summary: MonthWeekSummary | undefined): WeekPlanValues {
  return {
    label: summary?.rawLabel ?? null,
    targetVolumeMin: summary?.targetVolumeMin ?? null,
    targetVolumeMax: summary?.targetVolumeMax ?? null,
    targetVolumeUnit: summary?.targetVolumeUnit ?? null,
    notes: summary?.rawNotes ?? null,
  };
}
