"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  previewProgramAssignment,
  assignProgramToAthlete,
  loadUsedPaceReferenceBases,
  type AssignProgramInput,
  type OverlappingPhase,
} from "./assign-program-actions";
import type { GeneratePhaseSelection, ResolvedProgramGeneration } from "@/lib/private-coaching/program-generation";
import { PACE_REFERENCE_LABELS, type PaceReferenceKey } from "@/lib/private-coaching/pace-reference";
import { raceDistanceMap } from "@/lib/race-distances";
import { formatDate } from "@/lib/format";
import { mostRecentMonday } from "@/lib/week";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

export type ProgramOptionPhase = {
  id: string;
  label: string;
  isOptional: boolean;
  durationWeeksMin: number;
  durationWeeksMax: number;
};
export type ProgramOptionVariant = { id: string; name: string; phases: ProgramOptionPhase[] };
/**
 * A peak-volume level of one program -- the second, orthogonal variant
 * axis alongside plan length (see the volume-variants migration). This is
 * what supplies every week's goal mileage, so a program that has these
 * cannot be assigned without choosing one.
 */
export type ProgramOptionVolumeVariant = {
  id: string;
  name: string;
  peakMileage: number | null;
  initialMileage: number | null;
};
export type ProgramOption = {
  id: string;
  name: string;
  scalesDistanceWithMileage: boolean;
  scalesDurationWithMileage: boolean;
  variants: ProgramOptionVariant[];
  /** Empty for every hand-authored program, which derives week totals from its own authored day distances instead. */
  volumeVariants: ProgramOptionVolumeVariant[];
};

// "5K"/"Marathon", not "5K Pace"/"Marathon Pace" -- PACE_REFERENCE_LABELS'
// own wording reads naturally as a pace ("50-60% 5K Pace"), but awkwardly
// as a plain distance name in this informational note; raceDistanceMap
// already has the plain name for the 4 race-equivalent keys this note ever
// mentions (a zone key never reaches this form -- see
// loadUsedPaceReferenceBases).
function distanceLabelFor(base: PaceReferenceKey): string {
  return raceDistanceMap.get(base)?.label ?? PACE_REFERENCE_LABELS[base];
}

type PhaseSelectionState = { include: boolean; weeksInput: string };

// The assign-to-athlete flow for a coach-configurable Program (see the
// plan's own §4 spec): pick a program + plan length, choose weeks for each
// phase (required phases can't be excluded, only optional ones), anchor by
// start date or target event date, optionally scale by target peak
// mileage, then preview before writing anything real. Mirrors
// ImportPlanForm's own shape (the older, static-plan equivalent) --
// generate-then-review, real athlete rows only created on explicit
// confirmation, never assumed from a client-side estimate.
export function AssignProgramForm({
  athleteId,
  programs,
  initialProgramId,
  onDone,
  onCancel,
}: {
  athleteId: string;
  programs: ProgramOption[];
  // Deep-linked from the program's own detail page ("Assign to athlete") --
  // preselects that program instead of defaulting to the list's first entry.
  // Falls back silently to programs[0] if the id doesn't match (e.g. the
  // program was deleted between the link being generated and this render).
  initialProgramId?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [programId, setProgramId] = useState(
    (initialProgramId && programs.some((p) => p.id === initialProgramId) ? initialProgramId : programs[0]?.id) ?? "",
  );
  const program = programs.find((p) => p.id === programId) ?? null;
  const [variantId, setVariantId] = useState(program?.variants[0]?.id ?? "");
  const variant = program?.variants.find((v) => v.id === variantId) ?? null;
  // Deliberately NOT pre-selected, even when a program offers only one
  // level: choosing a peak volume is a real coaching judgment about this
  // athlete ("don't start barely hanging on"), not a default worth
  // guessing. buildInput refuses to proceed until it's set.
  const [volumeVariantId, setVolumeVariantId] = useState("");
  const volumeVariants = program?.volumeVariants ?? [];

  const [phaseSelections, setPhaseSelections] = useState<Map<string, PhaseSelectionState>>(() => defaultSelections(variant));
  const [anchorMode, setAnchorMode] = useState<"startDate" | "targetEventDate">("startDate");
  const [startDateInput, setStartDateInput] = useState("");
  const [targetEventDateInput, setTargetEventDateInput] = useState("");
  const [targetPeakMilesInput, setTargetPeakMilesInput] = useState("");
  const [targetPeakDurationInput, setTargetPeakDurationInput] = useState("");
  // Which PaceReferenceKey values this program's variant actually
  // references as a pace-percent basis -- e.g. a Canyon-style program
  // resolves to exactly ["5k", "marathon"]. Purely informational: this
  // platform never lets a coach enter an athlete's own fitness estimate on
  // their behalf (see loadUsedPaceReferenceBases' own comment) -- the note
  // below just tells the coach which distances the athlete needs to set in
  // their own settings for this program's paces to resolve to real numbers.
  const [usedBases, setUsedBases] = useState<PaceReferenceKey[]>([]);

  useEffect(() => {
    // programs.length === 0 renders its own empty state below and never
    // reaches this effect meaningfully; programId/variantId are otherwise
    // always set together (see updateProgram/updateVariant), so there's no
    // real "clear the bases" case to handle here.
    if (!programId || !variantId) return;
    let cancelled = false;
    loadUsedPaceReferenceBases(programId, variantId).then((result) => {
      if (!cancelled) setUsedBases(result.bases ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [programId, variantId]);

  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [preview, setPreview] = useState<ResolvedProgramGeneration | null>(null);
  const [confirmedWarnings, setConfirmedWarnings] = useState(false);
  const [overlappingPhases, setOverlappingPhases] = useState<OverlappingPhase[]>([]);
  const [clearOverlapping, setClearOverlapping] = useState(false);
  const [assignResult, setAssignResult] = useState<{
    phasesCreated?: number;
    workoutsCreated?: number;
    skippedDates?: string[];
    clearedWorkouts?: number;
    clearedWeekPlans?: number;
    clearedPhases?: number;
  } | null>(null);

  function updateProgram(nextProgramId: string) {
    setProgramId(nextProgramId);
    const nextProgram = programs.find((p) => p.id === nextProgramId) ?? null;
    const nextVariant = nextProgram?.variants[0] ?? null;
    setVariantId(nextVariant?.id ?? "");
    setVolumeVariantId("");
    setPhaseSelections(defaultSelections(nextVariant));
    setPreview(null);
    setOverlappingPhases([]);
    setClearOverlapping(false);
    setConfirmedWarnings(false);
  }
  function updateVariant(nextVariantId: string) {
    setVariantId(nextVariantId);
    const nextVariant = program?.variants.find((v) => v.id === nextVariantId) ?? null;
    setPhaseSelections(defaultSelections(nextVariant));
    setPreview(null);
    setOverlappingPhases([]);
    setClearOverlapping(false);
    setConfirmedWarnings(false);
  }
  function updatePhaseSelection(phaseId: string, patch: Partial<PhaseSelectionState>) {
    setPhaseSelections((prev) => {
      const next = new Map(prev);
      const current = next.get(phaseId) ?? { include: false, weeksInput: "" };
      next.set(phaseId, { ...current, ...patch });
      return next;
    });
    setPreview(null);
    setOverlappingPhases([]);
    setClearOverlapping(false);
    setConfirmedWarnings(false);
  }

  function buildInput(): { error: string } | { input: AssignProgramInput } {
    if (!program || !variant) return { error: "Choose a program and plan length." };

    const phaseSelectionInputs: GeneratePhaseSelection[] = [];
    for (const phase of variant.phases) {
      const selection = phaseSelections.get(phase.id);
      const include = !phase.isOptional || (selection?.include ?? false);
      if (!include) continue;
      const weeks = Number(selection?.weeksInput);
      if (!selection?.weeksInput.trim() || !Number.isFinite(weeks)) {
        return { error: `Choose a week count for ${phase.label}.` };
      }
      phaseSelectionInputs.push({ phaseDefinitionId: phase.id, include: true, weeks });
    }

    if (anchorMode === "targetEventDate" && !targetEventDateInput) {
      return { error: "Pick a target event date." };
    }
    if (anchorMode === "startDate" && !startDateInput) {
      return { error: "Pick a start date." };
    }

    const targetPeakWeeklyMiles = program.scalesDistanceWithMileage
      ? targetPeakMilesInput.trim()
        ? Number(targetPeakMilesInput)
        : null
      : null;
    if (program.scalesDistanceWithMileage && (targetPeakWeeklyMiles == null || !Number.isFinite(targetPeakWeeklyMiles) || targetPeakWeeklyMiles <= 0)) {
      return { error: "Enter a target peak weekly mileage greater than zero." };
    }
    const targetPeakWeeklyDurationS = program.scalesDurationWithMileage
      ? targetPeakDurationInput.trim()
        ? Number(targetPeakDurationInput) * 60
        : null
      : null;
    if (
      program.scalesDurationWithMileage &&
      (targetPeakWeeklyDurationS == null || !Number.isFinite(targetPeakWeeklyDurationS) || targetPeakWeeklyDurationS <= 0)
    ) {
      return { error: "Enter a target peak weekly duration greater than zero." };
    }

    if (volumeVariants.length > 0 && !volumeVariantId) {
      return { error: "Choose a peak weekly volume for this program." };
    }

    return {
      input: {
        programId: program.id,
        variantId: variant.id,
        volumeVariantId: volumeVariants.length > 0 ? volumeVariantId : null,
        athleteId,
        phaseSelections: phaseSelectionInputs,
        anchor:
          anchorMode === "targetEventDate"
            ? { kind: "targetEventDate", targetEventDate: targetEventDateInput }
            : { kind: "startDate", startDate: startDateInput, targetEventDate: targetEventDateInput || null },
        targetPeakWeeklyMiles,
        targetPeakWeeklyDurationS,
      },
    };
  }

  async function handlePreview() {
    setError(null);
    const built = buildInput();
    if ("error" in built) return setError(built.error);

    setIsPending(true);
    const result = await previewProgramAssignment(built.input);
    setIsPending(false);
    if (result.error) return setError(result.error);
    setPreview(result.result ?? null);
    setOverlappingPhases(result.overlappingPhases ?? []);
    setClearOverlapping(false);
    setConfirmedWarnings(false);
  }

  async function handleAssign() {
    setError(null);
    const built = buildInput();
    if ("error" in built) return setError(built.error);

    setIsPending(true);
    const result = await assignProgramToAthlete({ ...built.input, confirmedWarnings, clearOverlapping });
    setIsPending(false);
    if (result.error) return setError(result.error);
    setAssignResult(result);
  }

  const hasWarnings = useMemo(() => {
    if (!preview) return false;
    return (
      preview.warnings.emptyPhaseDefinitionIds.length > 0 ||
      preview.warnings.emptyWeeks.length > 0 ||
      preview.warnings.daysAfterEventDate.length > 0 ||
      preview.warnings.outOfRangeDays.length > 0
    );
  }, [preview]);

  if (assignResult) {
    return (
      <div className="space-y-3 rounded-control border border-black/10 p-3 dark:border-white/10">
        <p className="text-sm font-medium text-zinc-900 dark:text-white">
          Assigned {assignResult.workoutsCreated ?? 0} workouts across {assignResult.phasesCreated ?? 0} phases.
        </p>
        {assignResult.clearedPhases ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Cleared {assignResult.clearedPhases} overlapping phase{assignResult.clearedPhases === 1 ? "" : "s"} first (
            {assignResult.clearedWorkouts ?? 0} workout{assignResult.clearedWorkouts === 1 ? "" : "s"},{" "}
            {assignResult.clearedWeekPlans ?? 0} week target{assignResult.clearedWeekPlans === 1 ? "" : "s"}).
          </p>
        ) : null}
        {assignResult.skippedDates && assignResult.skippedDates.length > 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {assignResult.skippedDates.length} {assignResult.skippedDates.length === 1 ? "day" : "days"} already had a
            workout and {assignResult.skippedDates.length === 1 ? "was" : "were"} left as-is.
          </p>
        ) : null}
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onDone();
            router.refresh();
          }}
        >
          Done
        </Button>
      </div>
    );
  }

  if (programs.length === 0) {
    return (
      <div className="space-y-3 rounded-control border border-black/10 p-3 dark:border-white/10">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          You don&rsquo;t have any programs yet -- build one in your Programs library first.
        </p>
        <Button href="/coaching/programs" size="sm">
          Go to Programs
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-control border border-black/10 p-3 dark:border-white/10">
      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Program</span>
          <select value={programId} onChange={(e) => updateProgram(e.target.value)} className={fieldClass}>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Plan length</span>
          <select value={variantId} onChange={(e) => updateVariant(e.target.value)} className={fieldClass}>
            {(program?.variants ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {volumeVariants.length > 0 ? (
        <label className="block">
          <span className={labelClass}>Peak weekly volume</span>
          <select
            value={volumeVariantId}
            onChange={(e) => {
              setVolumeVariantId(e.target.value);
              setPreview(null);
              setOverlappingPhases([]);
              setClearOverlapping(false);
              setConfirmedWarnings(false);
            }}
            className={fieldClass}
          >
            {/* Unselected by default and deliberately kept as a real
                option, so the coach has to make this choice rather than
                inherit whichever level happened to be listed first. */}
            <option value="">Choose a level&hellip;</option>
            {volumeVariants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.initialMileage != null && v.peakMileage != null
                  ? `${v.name} (starts at ${v.initialMileage} mi/week)`
                  : v.name}
              </option>
            ))}
          </select>
          <span className="mt-1.5 block text-xs text-zinc-500 dark:text-zinc-400">
            Sets each week&apos;s goal mileage. Compare it with what this athlete is running now: starting a plan already
            at its limit is harder to recover from than starting a level below it.
          </span>
        </label>
      ) : null}

      {variant ? (
        <div>
          <p className={labelClass}>Phases</p>
          <div className="mt-1.5 space-y-2">
            {variant.phases.map((phase) => {
              const selection = phaseSelections.get(phase.id) ?? { include: false, weeksInput: "" };
              const included = !phase.isOptional || selection.include;
              return (
                <div key={phase.id} className="flex flex-wrap items-center gap-3 rounded-control border border-black/10 p-2 dark:border-white/10">
                  {phase.isOptional ? (
                    <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={selection.include}
                        onChange={(e) => updatePhaseSelection(phase.id, { include: e.target.checked })}
                        className="h-4 w-4"
                      />
                      {phase.label}
                    </label>
                  ) : (
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">{phase.label}</span>
                  )}
                  <label className="ml-auto flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    Weeks
                    <input
                      type="number"
                      min={phase.durationWeeksMin}
                      max={phase.durationWeeksMax}
                      disabled={!included}
                      value={selection.weeksInput}
                      onChange={(e) => updatePhaseSelection(phase.id, { weeksInput: e.target.value })}
                      className={`${fieldClass} w-20 disabled:opacity-50`}
                    />
                  </label>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    ({phase.durationWeeksMin}
                    {phase.durationWeeksMax !== phase.durationWeeksMin ? `–${phase.durationWeeksMax}` : ""})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div>
        <p className={labelClass}>Anchor</p>
        <div className="mt-1.5 flex gap-2">
          <button
            type="button"
            onClick={() => setAnchorMode("startDate")}
            className={`rounded-control border px-3 py-1.5 text-sm font-medium ${
              anchorMode === "startDate"
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                : "border-black/10 text-zinc-600 hover:border-black/20 dark:border-white/10 dark:text-zinc-300 dark:hover:border-white/20"
            }`}
          >
            Start date
          </button>
          <button
            type="button"
            onClick={() => setAnchorMode("targetEventDate")}
            className={`rounded-control border px-3 py-1.5 text-sm font-medium ${
              anchorMode === "targetEventDate"
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                : "border-black/10 text-zinc-600 hover:border-black/20 dark:border-white/10 dark:text-zinc-300 dark:hover:border-white/20"
            }`}
          >
            Target event date
          </button>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-3 xs:grid-cols-2">
          {anchorMode === "startDate" ? (
            <label className="block">
              <span className={labelClass}>Start date</span>
              <input
                type="date"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value ? mostRecentMonday(new Date(`${e.target.value}T00:00:00Z`)) : "")}
                className={fieldClass}
              />
            </label>
          ) : null}
          <label className="block">
            <span className={labelClass}>
              Target event date{anchorMode === "startDate" ? ", optional" : ""}
            </span>
            <input type="date" value={targetEventDateInput} onChange={(e) => setTargetEventDateInput(e.target.value)} className={fieldClass} />
          </label>
        </div>
      </div>

      {program?.scalesDistanceWithMileage || program?.scalesDurationWithMileage ? (
        <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
          {program.scalesDistanceWithMileage ? (
            <label className="block">
              <span className={labelClass}>Target peak weekly mileage</span>
              <input value={targetPeakMilesInput} onChange={(e) => setTargetPeakMilesInput(e.target.value)} className={fieldClass} />
              {preview?.referencePeakWeeklyMiles != null ? (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  This program averages {preview.referencePeakWeeklyMiles.toFixed(1)}mi/wk as authored.
                </p>
              ) : null}
            </label>
          ) : null}
          {program.scalesDurationWithMileage ? (
            <label className="block">
              <span className={labelClass}>Target peak weekly duration (min)</span>
              <input value={targetPeakDurationInput} onChange={(e) => setTargetPeakDurationInput(e.target.value)} className={fieldClass} />
              {preview?.referencePeakWeeklyDurationS != null ? (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  This program averages {Math.round(preview.referencePeakWeeklyDurationS / 60)}min/wk as authored.
                </p>
              ) : null}
            </label>
          ) : null}
        </div>
      ) : null}

      {usedBases.length > 0 ? (
        <p className="border-t border-black/10 pt-3 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          This program prescribes pace as a percent of {usedBases.map(distanceLabelFor).join(" and ")} pace, resolved
          live from whatever the athlete has set as their own current fitness estimate (in their settings) --
          not something you enter here. A day resolves to a real pace automatically once they have, and stays
          prose-only until then.
        </p>
      ) : null}

      {preview ? (
        <div className="space-y-3 rounded-control border border-black/10 p-3 dark:border-white/10">
          <p className="text-sm font-medium text-zinc-900 dark:text-white">
            {preview.totalWeeks} weeks · {formatDate(preview.startDate)} – {formatDate(preview.endDate)}
          </p>
          {preview.raceDayAlignment ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {preview.raceDayAlignment.daysBetween === 0
                ? "Lands exactly on your event."
                : preview.raceDayAlignment.daysBetween > 0
                  ? `Finishes ${preview.raceDayAlignment.daysBetween} day${preview.raceDayAlignment.daysBetween === 1 ? "" : "s"} before your event.`
                  : `Finishes ${Math.abs(preview.raceDayAlignment.daysBetween)} day${Math.abs(preview.raceDayAlignment.daysBetween) === 1 ? "" : "s"} after your event.`}
            </p>
          ) : null}

          {preview.warnings.emptyPhaseDefinitionIds.length > 0 ? (
            <WarningList title="Empty phases -- no workouts authored at all">
              {preview.warnings.emptyPhaseDefinitionIds.map((id) => (
                <li key={id}>{phaseLabel(variant, id)}</li>
              ))}
            </WarningList>
          ) : null}
          {preview.warnings.emptyWeeks.length > 0 ? (
            <WarningList title="Empty weeks">
              {preview.warnings.emptyWeeks.map((w, i) => (
                <li key={i}>
                  {phaseLabel(variant, w.phaseDefinitionId)}, week {w.weekNumber}
                </li>
              ))}
            </WarningList>
          ) : null}
          {preview.warnings.outOfRangeDays.length > 0 ? (
            <WarningList title="Authored content outside the weeks you selected -- won't be included">
              {preview.warnings.outOfRangeDays.map((d, i) => (
                <li key={i}>
                  {phaseLabel(variant, d.phaseDefinitionId)}, week {d.weekNumber}
                </li>
              ))}
            </WarningList>
          ) : null}
          {preview.warnings.daysAfterEventDate.length > 0 ? (
            <WarningList title="Scheduled after your event date -- included as authored, not moved">
              <li>{preview.warnings.daysAfterEventDate.length} day(s)</li>
            </WarningList>
          ) : null}

          {hasWarnings ? (
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={confirmedWarnings} onChange={(e) => setConfirmedWarnings(e.target.checked)} className="h-4 w-4" />
              Assign anyway
            </label>
          ) : null}

          {overlappingPhases.length > 0 ? (
            <div className="space-y-2 border-t border-amber-200 pt-2 dark:border-amber-900">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                Overlaps {overlappingPhases.length} existing phase{overlappingPhases.length === 1 ? "" : "s"} for this athlete
              </p>
              <ul className="list-inside list-disc text-xs text-zinc-600 dark:text-zinc-300">
                {overlappingPhases.map((p) => (
                  <li key={p.id}>
                    {p.phaseType}
                    {p.name ? ` — ${p.name}` : ""} ({formatDate(p.startDate)} – {formatDate(p.endDate)}): {p.workoutCount} workout
                    {p.workoutCount === 1 ? "" : "s"}, {p.weekPlanCount} week target{p.weekPlanCount === 1 ? "" : "s"}
                  </li>
                ))}
              </ul>
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={clearOverlapping}
                  onChange={(e) => setClearOverlapping(e.target.checked)}
                  className="h-4 w-4"
                />
                Clear the overlapping block{overlappingPhases.length === 1 ? "" : "s"} and assign
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Every generated workout lands as an unpublished draft -- review the whole block before publishing any of it.
      </p>

      {error && <FormError>{error}</FormError>}

      <div className="flex flex-wrap items-center gap-3">
        {preview ? (
          <Button
            type="button"
            size="sm"
            disabled={isPending || (hasWarnings && !confirmedWarnings) || (overlappingPhases.length > 0 && !clearOverlapping)}
            onClick={handleAssign}
          >
            {isPending ? "Assigning…" : "Assign program"}
          </Button>
        ) : (
          <Button type="button" size="sm" disabled={isPending} onClick={handlePreview}>
            {isPending ? "Checking…" : "Preview"}
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function defaultSelections(variant: ProgramOptionVariant | null | undefined): Map<string, PhaseSelectionState> {
  const map = new Map<string, PhaseSelectionState>();
  for (const phase of variant?.phases ?? []) {
    map.set(phase.id, { include: !phase.isOptional, weeksInput: String(phase.durationWeeksMin) });
  }
  return map;
}

function phaseLabel(variant: ProgramOptionVariant | null, phaseDefinitionId: string): string {
  return variant?.phases.find((p) => p.id === phaseDefinitionId)?.label ?? "a phase";
}

function WarningList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">{title}</p>
      <ul className="mt-1 list-inside list-disc text-xs text-zinc-600 dark:text-zinc-300">{children}</ul>
    </div>
  );
}
