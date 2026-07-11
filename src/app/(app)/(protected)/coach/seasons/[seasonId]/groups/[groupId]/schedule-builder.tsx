"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  copyWorkoutToGroups,
  deleteGroupPlanWorkout,
  duplicateWeekToGroup,
  publishWeek,
  unpublishWeek,
} from "@/app/(app)/(protected)/coach/group-plans-actions";
import { addDays, diffDays, type WorkoutType } from "@/lib/coaching-engine";
import { formatDate } from "@/lib/format";
import { WorkoutLengthLine, WorkoutMetaLine } from "@/components/workout-summary-line";
import type { GroupDayEntries } from "./all-groups-day-view";
import { WorkoutEntryForm } from "./workout-entry-form";

export type WeekRange = {
  weekIndex: number;
  startDate: string;
  endDate: string;
  theme: string;
  phaseId: string;
  phaseDisplayName: string;
};

export type Workout = {
  id: string;
  group_plan_id: string;
  season_phase_id: string | null;
  scheduled_date: string;
  time_of_day: string | null;
  location: string | null;
  description: string;
  secondary_activity: string | null;
  workout_type: WorkoutType | null;
  duration_min: number | null;
  distance_m: number | null;
  pace_fast_sec_per_mile: number | null;
  pace_slow_sec_per_mile: number | null;
  is_race: boolean;
  notes: string | null;
  published_at: string | null;
  explanation: string | null;
};

function WorkoutRow({
  workout,
  seasonId,
  otherGroups,
  onEdit,
  onDeleted,
}: {
  workout: Workout;
  seasonId: string;
  otherGroups: { id: string; name: string }[];
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<Set<string>>(new Set());

  function toggleCopyTarget(id: string) {
    setCopyTargets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <WorkoutMetaLine workout={workout} />
          <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-white">{workout.description}</p>
          {workout.secondary_activity && (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{workout.secondary_activity}</p>
          )}
          <WorkoutLengthLine workout={workout} />
          {workout.notes && <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{workout.notes}</p>}
          {!workout.published_at && (
            <p className="mt-0.5 text-xs font-medium text-zinc-400 dark:text-zinc-500">Not published</p>
          )}
        </div>
        <div aria-live="polite" className="-mr-2 -my-2 flex shrink-0 items-center gap-1 text-xs font-semibold">
          <button type="button" onClick={onEdit} className="inline-flex min-h-12 items-center rounded-lg px-2 text-zinc-700 dark:text-zinc-200">
            Edit
          </button>
          {otherGroups.length > 0 && (
            <button type="button" onClick={() => setCopyOpen((v) => !v)} className="inline-flex min-h-12 items-center rounded-lg px-2 text-zinc-700 dark:text-zinc-200">
              Copy to groups
            </button>
          )}
          {!confirmingDelete ? (
            <button type="button" onClick={() => setConfirmingDelete(true)} className="inline-flex min-h-12 items-center rounded-lg px-2 text-red-700 dark:text-red-400">
              Delete
            </button>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(async () => { await deleteGroupPlanWorkout(workout.id); onDeleted(); })}
              className="inline-flex min-h-12 items-center rounded-lg px-2 text-red-700 dark:text-red-400"
            >
              Confirm?
            </button>
          )}
        </div>
      </div>

      {copyOpen && (
        <div className="mt-2 rounded-lg border border-black/10 p-2 dark:border-white/10">
          <div className="flex flex-wrap gap-2">
            {otherGroups.map((g) => (
              <label key={g.id} className="flex items-center gap-1 text-xs text-zinc-700 dark:text-zinc-200">
                <input type="checkbox" checked={copyTargets.has(g.id)} onChange={() => toggleCopyTarget(g.id)} />
                {g.name}
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={isPending || copyTargets.size === 0}
            onClick={() =>
              startTransition(async () => {
                await copyWorkoutToGroups(workout.id, seasonId, Array.from(copyTargets));
                setCopyOpen(false);
                setCopyTargets(new Set());
              })
            }
            className="mt-2 rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
          >
            {isPending ? "Copying…" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}

function WeekSection({
  week,
  weekRanges,
  workouts,
  groupPlanId,
  seasonId,
  otherGroups,
  otherGroupsData,
}: {
  week: WeekRange;
  weekRanges: WeekRange[];
  workouts: Workout[];
  groupPlanId: string;
  seasonId: string;
  otherGroups: { id: string; name: string }[];
  otherGroupsData: GroupDayEntries[];
}) {
  // Later weeks in this same phase -- the leverage for "repeat this
  // session weekly," since a phase (not the whole season) is the coach's
  // natural unit of "this pattern holds for now."
  const laterWeeksSamePhase = weekRanges.filter((w) => w.phaseId === week.phaseId && w.weekIndex > week.weekIndex);
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [duplicateTarget, setDuplicateTarget] = useState("");
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const router = useRouter();

  // Other groups' entries for this same date range -- what a coach
  // building JV/Frosh after Varsity would otherwise have to go check
  // manually ("add a certain amount of minutes" to what the other group's
  // week already has).
  const otherGroupsThisWeek = otherGroupsData
    .map((g) => ({
      groupName: g.groupName,
      entries: Object.entries(g.workoutsByDate)
        .filter(([date]) => date >= week.startDate && date <= week.endDate)
        .flatMap(([, entries]) => entries)
        .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)),
    }))
    .filter((g) => g.entries.length > 0);

  const workoutsByDate = new Map<string, Workout[]>();
  for (const w of workouts) {
    const list = workoutsByDate.get(w.scheduled_date) ?? [];
    list.push(w);
    workoutsByDate.set(w.scheduled_date, list);
  }

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(`${week.startDate}T00:00:00`);
    d.setDate(d.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }

  function refresh() {
    setAddingDate(null);
    setEditingId(null);
    router.refresh();
  }

  const publishedCount = workouts.filter((w) => w.published_at).length;
  const publishState: "none" | "some" | "all" =
    workouts.length === 0 || publishedCount === 0 ? "none" : publishedCount === workouts.length ? "all" : "some";

  return (
    <div
      id={`week-${week.weekIndex}`}
      className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
            Week {week.weekIndex + 1} · {week.phaseDisplayName}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {formatDate(week.startDate)} – {formatDate(week.endDate)} · {week.theme}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {workouts.length > 0 && (
            <>
              <span
                className={`text-xs font-semibold ${
                  publishState === "all"
                    ? "text-emerald-700 dark:text-emerald-400"
                    : publishState === "some"
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {publishState === "all" ? "Published" : publishState === "some" ? "Partially published" : "Not published"}
              </span>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    if (publishState === "all") await unpublishWeek(seasonId, week.startDate, week.endDate);
                    else await publishWeek(seasonId, week.startDate, week.endDate);
                    refresh();
                  })
                }
                className="text-xs font-semibold text-zinc-700 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-60 dark:text-zinc-200 dark:decoration-white/20 dark:hover:decoration-white"
              >
                {publishState === "all"
                  ? "Unpublish this week"
                  : otherGroups.length > 0
                    ? "Publish this week for all groups"
                    : "Publish this week"}
              </button>
            </>
          )}
          {otherGroups.length > 0 && (
            <button type="button" onClick={() => setDuplicateOpen((v) => !v)} className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              Duplicate week to another group
            </button>
          )}
          {otherGroupsThisWeek.length > 0 && (
            <button type="button" onClick={() => setCompareOpen((v) => !v)} className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              {compareOpen ? "Hide" : "Compare"} other groups this week
            </button>
          )}
        </div>
      </div>

      {compareOpen && otherGroupsThisWeek.length > 0 && (
        <div className="mt-3 grid gap-3 rounded-lg border border-black/10 p-3 sm:grid-cols-2 dark:border-white/10">
          {otherGroupsThisWeek.map((g) => (
            <div key={g.groupName}>
              <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                {g.groupName}
              </p>
              <div className="mt-1.5 space-y-1.5">
                {g.entries.map((w) => (
                  <div key={w.id}>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDate(w.scheduled_date)}
                      {(w.time_of_day || w.location) && ` · ${[w.time_of_day, w.location].filter(Boolean).join(" · ")}`}
                      {w.duration_min && ` · ${w.duration_min} min`}
                    </p>
                    <p className="text-sm text-zinc-900 dark:text-white">{w.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {duplicateOpen && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-black/10 p-2 dark:border-white/10">
          <select value={duplicateTarget} onChange={(e) => setDuplicateTarget(e.target.value)} className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-zinc-900">
            <option value="">Choose a group…</option>
            {otherGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={isPending || !duplicateTarget}
            onClick={() =>
              startTransition(async () => {
                await duplicateWeekToGroup(groupPlanId, week.startDate, week.endDate, seasonId, duplicateTarget);
                setDuplicateOpen(false);
                refresh();
              })
            }
            className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
          >
            {isPending ? "Duplicating…" : "Duplicate"}
          </button>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {days.map((date) => (
          <div key={date}>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{formatDate(date)}</p>
            <div className="mt-1 space-y-2">
              {(workoutsByDate.get(date) ?? []).map((workout) =>
                editingId === workout.id ? (
                  <WorkoutEntryForm
                    key={workout.id}
                    groupPlanId={groupPlanId}
                    seasonId={seasonId}
                    scheduledDate={date}
                    seasonPhaseId={week.phaseId}
                    otherGroups={otherGroups}
                    existing={workout}
                    onDone={refresh}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <WorkoutRow
                    key={workout.id}
                    workout={workout}
                    seasonId={seasonId}
                    otherGroups={otherGroups}
                    onEdit={() => setEditingId(workout.id)}
                    onDeleted={refresh}
                  />
                ),
              )}
              {addingDate === date ? (
                <WorkoutEntryForm
                  groupPlanId={groupPlanId}
                  seasonId={seasonId}
                  scheduledDate={date}
                  seasonPhaseId={week.phaseId}
                  otherGroups={otherGroups}
                  repeatCandidateDates={laterWeeksSamePhase.map((w) => addDays(w.startDate, diffDays(week.startDate, date)))}
                  onDone={refresh}
                  onCancel={() => setAddingDate(null)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingDate(date)}
                  className="text-xs font-semibold text-zinc-500 underline decoration-black/10 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/10 dark:hover:decoration-white"
                >
                  + Add entry
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScheduleBuilder({
  seasonId,
  groupPlanId,
  weekRanges,
  workouts,
  otherGroups,
  otherGroupsData,
}: {
  seasonId: string;
  groupPlanId: string;
  weekRanges: WeekRange[];
  workouts: Workout[];
  otherGroups: { id: string; name: string }[];
  otherGroupsData: GroupDayEntries[];
}) {
  const searchParams = useSearchParams();
  const targetDate = searchParams.get("date");

  useEffect(() => {
    if (!targetDate) return;
    const week = weekRanges.find((w) => targetDate >= w.startDate && targetDate <= w.endDate);
    if (!week) return;
    document.getElementById(`week-${week.weekIndex}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Deep-linking from "all groups, by day" is a one-time landing action,
    // not something that should re-fire on every re-render this page does
    // (e.g. after publishing/editing).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate]);

  return (
    <div className="space-y-6">
      {weekRanges.map((week) => (
        <WeekSection
          key={week.weekIndex}
          week={week}
          weekRanges={weekRanges}
          workouts={workouts.filter((w) => w.scheduled_date >= week.startDate && w.scheduled_date <= week.endDate)}
          groupPlanId={groupPlanId}
          seasonId={seasonId}
          otherGroups={otherGroups}
          otherGroupsData={otherGroupsData}
        />
      ))}
    </div>
  );
}
