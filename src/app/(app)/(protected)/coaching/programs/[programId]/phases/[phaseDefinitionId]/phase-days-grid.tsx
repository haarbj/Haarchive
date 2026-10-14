"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { deleteProgramDay, saveProgramPhaseWeekLabel } from "../../../actions";
import { formatDistanceRange, formatDurationRange, formatPaceRange, formatPacePercentRange } from "@/lib/private-coaching/workout-distance";
import { PACE_REFERENCE_LABELS } from "@/lib/private-coaching/pace-reference";
import { ProgramDayForm, DAY_OF_WEEK_LABELS, type ExistingProgramDay } from "./program-day-form";
import type { ExtraPresetOption } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/actions";
import { fieldClass } from "@/lib/form-styles";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";

const DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6, 7];

type EditTarget = { weekNumber: number; dayOfWeek: number; existing?: ExistingProgramDay };

// The week-by-week, day-of-week authoring grid for one phase definition --
// abstract (week N, day of week), never a real calendar date, since a
// Program is coach-owned template data, not any one athlete's schedule
// (real dates only exist after assign_program_generation runs). Every
// field-level editor is the same DayVocabularyFields/StepsEditor/
// ExtrasEditor combo templates/scheduled workouts already use (see
// program-day-form.tsx); this component's own job is just the grid
// structure and the add/edit/delete/label wiring around it.
export type WeekLabelInfo = { label: string | null; notes: string | null };

export function PhaseDaysGrid({
  programId,
  phaseDefinitionId,
  durationWeeksMax,
  daysByWeek,
  weekLabels,
  extraPresets,
}: {
  programId: string;
  phaseDefinitionId: string;
  durationWeeksMax: number;
  daysByWeek: Map<number, Map<number, ExistingProgramDay[]>>;
  weekLabels: Map<number, WeekLabelInfo>;
  extraPresets: ExtraPresetOption[];
}) {
  const router = useRouter();
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [labelDrafts, setLabelDrafts] = useState<Map<number, string>>(new Map());
  const [notesDrafts, setNotesDrafts] = useState<Map<number, string>>(new Map());
  const [savingWeek, setSavingWeek] = useState<number | null>(null);

  function labelFor(week: number): string {
    return labelDrafts.has(week) ? labelDrafts.get(week)! : (weekLabels.get(week)?.label ?? "");
  }
  function notesFor(week: number): string {
    return notesDrafts.has(week) ? notesDrafts.get(week)! : (weekLabels.get(week)?.notes ?? "");
  }

  // label and notes upsert together (one row, one natural key) -- always
  // sends BOTH current values on any blur so committing one field never
  // clobbers the other with a stale value.
  async function commitWeek(week: number) {
    setSavingWeek(week);
    await saveProgramPhaseWeekLabel({
      programId,
      phaseDefinitionId,
      weekNumber: week,
      label: labelFor(week) || null,
      notes: notesFor(week) || null,
    });
    setSavingWeek(null);
    router.refresh();
  }

  if (editTarget) {
    return (
      <div className="mt-6">
        <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
          Week {editTarget.weekNumber} · {DAY_OF_WEEK_LABELS[editTarget.dayOfWeek]}
        </p>
        <ProgramDayForm
          programId={programId}
          phaseDefinitionId={phaseDefinitionId}
          weekNumber={editTarget.weekNumber}
          dayOfWeek={editTarget.dayOfWeek}
          existing={editTarget.existing}
          extraPresets={extraPresets}
          onDone={() => {
            setEditTarget(null);
            router.refresh();
          }}
          onCancel={() => setEditTarget(null)}
        />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {Array.from({ length: durationWeeksMax }, (_, i) => i + 1).map((week) => {
        const days = daysByWeek.get(week) ?? new Map<number, ExistingProgramDay[]>();
        const sessionCount = [...days.values()].reduce((n, list) => n + list.length, 0);
        return (
          <Card key={week} padding="md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold text-zinc-900 dark:text-white">
                Week {week}{" "}
                <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  {days.size}/7 day{days.size === 1 ? "" : "s"}
                  {/* Only worth saying when a day holds a double -- otherwise
                      sessions and days are the same number. */}
                  {sessionCount > days.size ? `, ${sessionCount} sessions` : ""}
                </span>
              </p>
              <input
                value={labelFor(week)}
                onChange={(e) => setLabelDrafts((prev) => new Map(prev).set(week, e.target.value))}
                onBlur={() => commitWeek(week)}
                placeholder="Week label, optional"
                disabled={savingWeek === week}
                className={`${fieldClass} max-w-[10rem]`}
              />
            </div>
            <textarea
              value={notesFor(week)}
              onChange={(e) => setNotesDrafts((prev) => new Map(prev).set(week, e.target.value))}
              onBlur={() => commitWeek(week)}
              placeholder="Week notes, optional -- coaching commentary about the purpose/focus of this week, separate from any one day's own prescription"
              disabled={savingWeek === week}
              rows={2}
              className={`${fieldClass} mt-2`}
            />
            <div className="mt-3 grid grid-cols-1 gap-2 xs:grid-cols-2 lg:grid-cols-7">
              {DAYS_OF_WEEK.map((dayOfWeek) => {
                const sessions = days.get(dayOfWeek) ?? [];
                return (
                  <div key={dayOfWeek} className="rounded-control border border-black/10 p-2 dark:border-white/10">
                    <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                      {DAY_OF_WEEK_LABELS[dayOfWeek]}
                    </p>
                    {sessions.map((day, index) => (
                      <div
                        key={day.id}
                        className={
                          index > 0
                            ? "mt-2 border-t border-black/10 pt-2 dark:border-white/10"
                            : undefined
                        }
                      >
                        <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">
                          {/* The slot is the heading for a double, since both
                              halves of the day are real, separate sessions. */}
                          {day.sessionSlot ? (
                            <span className="mr-1.5 rounded-pill bg-black/5 px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                              {day.sessionSlot}
                            </span>
                          ) : null}
                          {day.dayLabel ?? "Workout"}
                          {day.isEventDay ? <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">race day</span> : null}
                          {day.isOptional ? (
                            <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">optional</span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 line-clamp-3 text-xs text-zinc-500 dark:text-zinc-400">{summarizeDay(day)}</p>
                        {/* The framework's own difficulty rating, verbatim --
                            planned_rpe is an integer and cannot show "8.5-9". */}
                        {day.difficultyLabel ? (
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Difficulty {day.difficultyLabel}</p>
                        ) : null}
                        {day.alternativeText ? (
                          <p className="mt-1 text-xs text-zinc-500 italic dark:text-zinc-400">
                            Alternative: {day.alternativeText}
                          </p>
                        ) : null}
                        <div className="mt-2 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setEditTarget({ weekNumber: week, dayOfWeek, existing: day })}
                            className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
                          >
                            Edit
                          </button>
                          <ConfirmButton
                            action={() => deleteProgramDay(day.id, programId, phaseDefinitionId).then(() => router.refresh())}
                            confirmMessage="Delete this session?"
                            label="Delete"
                            pendingLabel="Deleting…"
                            className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
                          />
                        </div>
                      </div>
                    ))}
                    {/* Always available, so a second session can be added to a
                        day that already has one (an AM/PM double). */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-1 !px-0"
                      onClick={() => setEditTarget({ weekNumber: week, dayOfWeek })}
                    >
                      {sessions.length === 0 ? "+ Add" : "+ Add session"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function summarizeDay(day: ExistingProgramDay): string {
  const parts = [
    day.pacePercentBasis
      ? `${formatPacePercentRange(day.pacePercentMin, day.pacePercentMax)} ${PACE_REFERENCE_LABELS[day.pacePercentBasis]}`
      : null,
    formatDistanceRange(day.plannedDistanceM, day.plannedDistanceMaxM),
    formatDurationRange(day.plannedDurationS, day.plannedDurationMaxS),
    day.paceReference ? PACE_REFERENCE_LABELS[day.paceReference] : formatPaceRange(day.plannedPaceSPerMi, day.plannedPaceMaxSPerMi),
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");

  // A seeded framework day has NO structured target at all -- its whole
  // prescription is the authored prose ("2 mi progressive warm-up + 4
  // strides / 10 x 3 min at 90-92% 5k pace with 45 sec jog / 2 mi easy
  // cool-down"), deliberately never parsed into fields (see
  // framework-seed.ts). Falling through to "No target set" here would tell
  // a coach the day was empty while the real prescription sat in notes.
  //
  // First line only: a hand-authored day's notes can carry several
  // paragraphs of coaching commentary below the prescription itself (see
  // scripts/data/canyon-program.ts), and the grid cell wants the
  // prescription, not the essay.
  const firstLine = day.notes?.split("\n").find((line) => line.trim().length > 0)?.trim();
  return firstLine ?? "No target set";
}
