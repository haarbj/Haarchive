"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { ensureGroupPlan, upsertGroupPlanWorkout, type WorkoutInput } from "@/app/(app)/(protected)/coach/group-plans-actions";
import { addDays } from "@/lib/coaching-engine";
import { formatDate } from "@/lib/format";
import { WorkoutLengthLine, WorkoutMetaLine } from "@/components/workout-summary-line";
import type { GroupDayEntries } from "./all-groups-day-view";
import type { WeekRange, Workout } from "./schedule-builder";
import { WorkoutEntryForm } from "./workout-entry-form";

// Rows = groups, columns = one week's days -- the actual mental model a
// coach uses ("what's everyone doing this week"), as a fast bulk-entry
// surface alongside (not replacing) the per-group week list and full
// WorkoutEntryForm, which stay the place for anything beyond a
// description. Real <table> markup for free screen-reader table semantics,
// wrapped in its own horizontal scroll container so a season with several
// groups doesn't force the whole page to scroll sideways on a phone.

// upsertGroupPlanWorkout writes every one of these columns on every call --
// an inline description-only edit that only sent {description} would wipe
// duration/distance/pace/notes/etc that were set via the full form. This
// mapper is what makes "preserve everything else" mechanical rather than
// something every call site has to remember by hand.
function toWorkoutInput(w: Workout): WorkoutInput {
  return {
    id: w.id,
    groupPlanId: w.group_plan_id,
    seasonPhaseId: w.season_phase_id,
    scheduledDate: w.scheduled_date,
    timeOfDay: w.time_of_day,
    location: w.location,
    description: w.description,
    secondaryActivity: w.secondary_activity,
    workoutType: w.workout_type,
    durationMin: w.duration_min,
    distanceM: w.distance_m,
    paceFastSecPerMile: w.pace_fast_sec_per_mile,
    paceSlowSecPerMile: w.pace_slow_sec_per_mile,
    isRace: w.is_race,
    notes: w.notes,
    explanation: w.explanation,
  };
}

// The existing full form, reused verbatim, hosted in a simple overlay --
// grid cells are too narrow for an 11-field form inline. "Also add to
// other groups" is dropped (otherGroups=[]) since a coach already looking
// at the whole grid can just click that group's own cell directly.
function DetailOverlay({
  seasonId,
  groupPlanId,
  date,
  seasonPhaseId,
  existing,
  onDone,
  onCancel,
}: {
  seasonId: string;
  groupPlanId: string;
  date: string;
  seasonPhaseId: string;
  existing?: Workout;
  onDone: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-6" onClick={onCancel}>
      <div
        className="mx-auto mt-16 w-full max-w-xl rounded-2xl bg-stone-50 p-4 shadow-xl dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <WorkoutEntryForm
          groupPlanId={groupPlanId}
          seasonId={seasonId}
          scheduledDate={date}
          seasonPhaseId={seasonPhaseId}
          otherGroups={[]}
          existing={existing}
          onDone={onDone}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
}

function GridCell({
  seasonId,
  groupId,
  groupPlanId,
  date,
  seasonPhaseId,
  entries,
  onChanged,
  onEnsurePlan,
}: {
  seasonId: string;
  groupId: string;
  groupPlanId: string | null;
  date: string;
  seasonPhaseId: string;
  entries: Workout[];
  onChanged: () => void;
  onEnsurePlan: (groupId: string) => Promise<string | null>;
}) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [text, setText] = useState("");
  const [detailEditorFor, setDetailEditorFor] = useState<Workout | "new" | null>(null);
  const [isPending, startTransition] = useTransition();
  const cancelledRef = useRef(false);

  function startEditingExisting(w: Workout) {
    setEditingId(w.id);
    setText(w.description);
  }

  function startEditingNew() {
    setEditingId("new");
    setText("");
  }

  function commitEdit() {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setEditingId(null);
      return;
    }
    const trimmed = text.trim();
    const wasNew = editingId === "new";
    const existing = !wasNew ? entries.find((e) => e.id === editingId) : undefined;
    setEditingId(null);
    if (!trimmed) return; // blank -- discard rather than create/save an empty entry

    startTransition(async () => {
      let planId = groupPlanId;
      if (!planId) {
        planId = await onEnsurePlan(groupId);
        if (!planId) return;
      }
      const input: WorkoutInput = existing
        ? { ...toWorkoutInput(existing), description: trimmed }
        : {
            groupPlanId: planId,
            seasonPhaseId,
            scheduledDate: date,
            timeOfDay: null,
            location: null,
            description: trimmed,
            secondaryActivity: null,
            workoutType: null,
            durationMin: null,
            distanceM: null,
            paceFastSecPerMile: null,
            paceSlowSecPerMile: null,
            isRace: false,
            notes: null,
            explanation: null,
          };
      await upsertGroupPlanWorkout(input);
      onChanged();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") e.currentTarget.blur();
    if (e.key === "Escape") {
      cancelledRef.current = true;
      e.currentTarget.blur();
    }
  }

  const inputClass =
    "w-full rounded border border-black/10 bg-white px-1.5 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";

  return (
    <div className="space-y-1.5">
      {entries.map((w) =>
        editingId === w.id ? (
          <input
            key={w.id}
            autoFocus
            disabled={isPending}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className={inputClass}
          />
        ) : (
          <div key={w.id} className="group/cell rounded-lg bg-black/[0.02] p-2 dark:bg-white/[0.03]">
            <div className="flex items-start justify-between gap-1">
              <WorkoutMetaLine
                workout={w}
                includeDuration
                className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400"
              />
              <button
                type="button"
                onClick={() => setDetailEditorFor(w)}
                title="Edit all fields"
                aria-label="Edit all fields for this session"
                className="shrink-0 text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                ⤢
              </button>
            </div>
            <button
              type="button"
              onClick={() => startEditingExisting(w)}
              className="mt-0.5 block w-full text-left text-sm text-zinc-900 dark:text-white"
            >
              {w.description}
            </button>
            <WorkoutLengthLine workout={w} />
          </div>
        ),
      )}

      {editingId === "new" ? (
        <input
          autoFocus
          disabled={isPending}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          placeholder="Add a session…"
          className={inputClass}
        />
      ) : (
        <button
          type="button"
          onClick={startEditingNew}
          className="w-full py-0.5 text-left text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
        >
          {entries.length === 0 ? "—" : "+ add"}
        </button>
      )}

      {detailEditorFor && groupPlanId && (
        <DetailOverlay
          seasonId={seasonId}
          groupPlanId={groupPlanId}
          date={date}
          seasonPhaseId={seasonPhaseId}
          existing={detailEditorFor === "new" ? undefined : detailEditorFor}
          onDone={() => {
            setDetailEditorFor(null);
            onChanged();
          }}
          onCancel={() => setDetailEditorFor(null)}
        />
      )}
    </div>
  );
}

export function ScheduleGrid({
  seasonId,
  weekRanges,
  allGroupsDayData,
  groupPlanIdByGroupId,
}: {
  seasonId: string;
  weekRanges: WeekRange[];
  allGroupsDayData: { dates: string[]; groups: GroupDayEntries[] };
  groupPlanIdByGroupId: Record<string, string>;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const defaultIndex = Math.max(
    0,
    weekRanges.findIndex((w) => todayStr >= w.startDate && todayStr <= w.endDate),
  );
  const router = useRouter();
  const [weekIndex, setWeekIndex] = useState(defaultIndex);
  const [planIds, setPlanIds] = useState(groupPlanIdByGroupId);
  const week = weekRanges[weekIndex];

  // A soft router.refresh() (same pattern as WeekSection's refresh()
  // elsewhere in this feature) re-fetches the server data without
  // remounting this component, so the currently-selected week survives a
  // save -- a full page reload would snap the coach back to today's week.
  async function ensurePlan(groupId: string): Promise<string | null> {
    const result = await ensureGroupPlan(seasonId, groupId);
    if (!result.groupPlanId) return null;
    setPlanIds((prev) => ({ ...prev, [groupId]: result.groupPlanId! }));
    return result.groupPlanId;
  }

  function refresh() {
    router.refresh();
  }

  if (!week) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-300">No weeks set up for this season yet.</p>;
  }

  const days: string[] = [];
  for (let i = 0; i < 7; i++) days.push(addDays(week.startDate, i));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={weekIndex === 0}
          onClick={() => setWeekIndex((i) => i - 1)}
          className="min-h-12 rounded-full border border-black/10 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-black/5 disabled:opacity-40 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
        >
          ◀ Previous week
        </button>
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          Week {week.weekIndex + 1} · {formatDate(week.startDate)} – {formatDate(week.endDate)}
        </p>
        <button
          type="button"
          disabled={weekIndex === weekRanges.length - 1}
          onClick={() => setWeekIndex((i) => i + 1)}
          className="min-h-12 rounded-full border border-black/10 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-black/5 disabled:opacity-40 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
        >
          Next week ▶
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10">
              <th scope="col" className="p-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                Group
              </th>
              {days.map((d) => (
                <th
                  key={d}
                  scope="col"
                  className="p-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400"
                >
                  {formatDate(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allGroupsDayData.groups.map((g) => (
              <tr key={g.groupId} className="border-b border-black/5 last:border-b-0 dark:border-white/5">
                <th scope="row" className="p-3 align-top text-sm font-semibold text-zinc-900 dark:text-white">
                  {g.groupName}
                </th>
                {days.map((d) => (
                  <td key={d} className="min-w-[160px] max-w-[220px] p-2 align-top">
                    <GridCell
                      seasonId={seasonId}
                      groupId={g.groupId}
                      groupPlanId={planIds[g.groupId] ?? null}
                      date={d}
                      seasonPhaseId={week.phaseId}
                      entries={g.workoutsByDate[d] ?? []}
                      onChanged={refresh}
                      onEnsurePlan={ensurePlan}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
