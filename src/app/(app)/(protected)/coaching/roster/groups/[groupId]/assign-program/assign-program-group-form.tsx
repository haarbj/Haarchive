"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  previewProgramAssignmentForGroup,
  assignProgramToGroup,
  type GroupAssignConfig,
  type GroupMemberPreview,
} from "./assign-program-group-actions";
import { loadUsedPaceReferenceBases } from "../../../../athletes/[athleteId]/schedule/assign-program-actions";
import type { ProgramOption, ProgramOptionVariant } from "../../../../athletes/[athleteId]/schedule/assign-program-form";
import type { GeneratePhaseSelection, ResolvedProgramGeneration } from "@/lib/private-coaching/program-generation";
import { PHASE_PROFILES } from "@/lib/private-coaching/race-anchored-planning";
import {
  DEFAULT_STRENGTH_SELECTIONS,
  plyometricsEligibility,
  type AppliedStrengthOption,
  type StrengthSelections,
} from "@/lib/private-coaching/strength-scheduling";
import { PACE_REFERENCE_LABELS, type PaceReferenceKey } from "@/lib/private-coaching/pace-reference";
import { raceDistanceMap } from "@/lib/race-distances";
import { formatDate } from "@/lib/format";
import { mostRecentMonday } from "@/lib/week";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

const WEEKDAY_BOUND_FRAMEWORK_KEYS = new Set(PHASE_PROFILES.map((p) => p.key));

function distanceLabelFor(base: PaceReferenceKey): string {
  return raceDistanceMap.get(base)?.label ?? PACE_REFERENCE_LABELS[base];
}

type PhaseSelectionState = { include: boolean; weeksInput: string };

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

const STRENGTH_OPTION_LABELS: Record<AppliedStrengthOption["key"], string> = {
  foundation: "Foundation",
  "heavy-lifting": "Heavy lifting",
  plyometrics: "Plyometrics",
  "hill-sprints": "Hill sprints",
};

// The group-assign counterpart to AssignProgramForm (single-athlete
// version, coaching/athletes/[athleteId]/schedule/assign-program-form.tsx).
// Deliberately scoped down for this first version, per the scoping decision
// behind this feature: no "lay out from race day" auto-propose, no mileage-
// match check, no post-race redemption guardrail, no plan-length guidance --
// those are all athlete-specific advisory checks that would need their own
// per-member review-screen treatment, and weren't asked for here. What's
// covered is the full configuration (program/variant/volume/phases/
// strength/anchor/peak targets) plus a mandatory per-athlete conflict
// review before anything is written, which is the actual ask.
export function AssignProgramGroupForm({
  groupId,
  groupName,
  members,
  programs,
}: {
  groupId: string;
  groupName: string;
  members: { athleteId: string; name: string }[];
  programs: ProgramOption[];
}) {
  const router = useRouter();
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const program = programs.find((p) => p.id === programId) ?? null;
  const [variantId, setVariantId] = useState(program?.variants[0]?.id ?? "");
  const variant = program?.variants.find((v) => v.id === variantId) ?? null;
  const [volumeVariantId, setVolumeVariantId] = useState("");
  const volumeVariants = program?.volumeVariants ?? [];

  const [phaseSelections, setPhaseSelections] = useState<Map<string, PhaseSelectionState>>(() => defaultSelections(variant));
  const [strengthSelections, setStrengthSelections] = useState<StrengthSelections>(DEFAULT_STRENGTH_SELECTIONS);
  const [strengthInjuryProne, setStrengthInjuryProne] = useState(false);
  const [strengthRebounding, setStrengthRebounding] = useState(false);
  const [strengthExperienced, setStrengthExperienced] = useState(false);
  const [anchorMode, setAnchorMode] = useState<"startDate" | "targetEventDate">("startDate");
  const [startDateInput, setStartDateInput] = useState("");
  const [targetEventDateInput, setTargetEventDateInput] = useState("");
  const [targetPeakMilesInput, setTargetPeakMilesInput] = useState("");
  const [targetPeakDurationInput, setTargetPeakDurationInput] = useState("");
  const [usedBases, setUsedBases] = useState<PaceReferenceKey[]>([]);

  useEffect(() => {
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
  const [appliedStrengthOptions, setAppliedStrengthOptions] = useState<AppliedStrengthOption[]>([]);
  const [memberPreviews, setMemberPreviews] = useState<GroupMemberPreview[]>([]);
  // athleteId -> "clear the overlapping block and assign". A conflicting
  // member not present here (or false) is skipped at submit, never cleared
  // by default -- see assignProgramToGroup's own header comment.
  const [clearDecisions, setClearDecisions] = useState<Record<string, boolean>>({});
  const [outcome, setOutcome] = useState<{
    assigned: { athleteId: string; name: string; workoutsCreated: number; phasesCreated: number }[];
    skipped: { athleteId: string; name: string; reason: string }[];
    failed: { athleteId: string; name: string; error: string }[];
  } | null>(null);

  let selectedWeeksTotal = 0;
  for (const phase of variant?.phases ?? []) {
    const selection = phaseSelections.get(phase.id);
    const included = !phase.isOptional || (selection?.include ?? false);
    if (!included) continue;
    const weeks = Number(selection?.weeksInput);
    if (Number.isFinite(weeks) && weeks > 0) selectedWeeksTotal += weeks;
  }

  const plyometricsGate = plyometricsEligibility({
    injuryProne: strengthInjuryProne,
    reboundingFromSetback: strengthRebounding,
    experiencedAthlete: strengthExperienced,
    totalWeeks: selectedWeeksTotal,
  });

  function resetPreviewState() {
    setPreview(null);
    setMemberPreviews([]);
    setClearDecisions({});
    setConfirmedWarnings(false);
  }

  function updateProgram(nextProgramId: string) {
    setProgramId(nextProgramId);
    const nextProgram = programs.find((p) => p.id === nextProgramId) ?? null;
    const nextVariant = nextProgram?.variants[0] ?? null;
    setVariantId(nextVariant?.id ?? "");
    setVolumeVariantId("");
    setPhaseSelections(defaultSelections(nextVariant));
    resetPreviewState();
  }
  function updateVariant(nextVariantId: string) {
    setVariantId(nextVariantId);
    const nextVariant = program?.variants.find((v) => v.id === nextVariantId) ?? null;
    setPhaseSelections(defaultSelections(nextVariant));
    resetPreviewState();
  }
  function updatePhaseSelection(phaseId: string, patch: Partial<PhaseSelectionState>) {
    setPhaseSelections((prev) => {
      const next = new Map(prev);
      const current = next.get(phaseId) ?? { include: false, weeksInput: "" };
      next.set(phaseId, { ...current, ...patch });
      return next;
    });
    resetPreviewState();
  }

  function buildConfig(): { error: string } | { config: GroupAssignConfig } {
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

    if (anchorMode === "targetEventDate" && !targetEventDateInput) return { error: "Pick a target event date." };
    if (anchorMode === "startDate" && !startDateInput) return { error: "Pick a start date." };

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

    if (volumeVariants.length > 0 && !volumeVariantId) return { error: "Choose a peak weekly volume for this program." };

    return {
      config: {
        programId: program.id,
        variantId: variant.id,
        volumeVariantId: volumeVariants.length > 0 ? volumeVariantId : null,
        phaseSelections: phaseSelectionInputs,
        anchor:
          anchorMode === "targetEventDate"
            ? { kind: "targetEventDate", targetEventDate: targetEventDateInput }
            : { kind: "startDate", startDate: startDateInput, targetEventDate: targetEventDateInput || null },
        targetPeakWeeklyMiles,
        targetPeakWeeklyDurationS,
        strengthSelections,
        strengthGating: {
          injuryProne: strengthInjuryProne,
          reboundingFromSetback: strengthRebounding,
          experiencedAthlete: strengthExperienced,
        },
      },
    };
  }

  async function handlePreview() {
    setError(null);
    const built = buildConfig();
    if ("error" in built) return setError(built.error);

    setIsPending(true);
    const result = await previewProgramAssignmentForGroup(groupId, built.config);
    setIsPending(false);
    if (result.error && !result.generation) return setError(result.error);
    setPreview(result.generation ?? null);
    setAppliedStrengthOptions(result.appliedStrengthOptions ?? []);
    setMemberPreviews(result.members ?? []);
    setClearDecisions({});
    setConfirmedWarnings(false);
  }

  async function handleAssign() {
    setError(null);
    const built = buildConfig();
    if ("error" in built) return setError(built.error);

    setIsPending(true);
    const result = await assignProgramToGroup(groupId, built.config, confirmedWarnings, clearDecisions);
    setIsPending(false);
    if (result.error) return setError(result.error);
    setOutcome({ assigned: result.assigned ?? [], skipped: result.skipped ?? [], failed: result.failed ?? [] });
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

  const readyCount = memberPreviews.filter((m) => !m.error && m.overlappingPhases.length === 0).length;
  const willAssignCount =
    readyCount + memberPreviews.filter((m) => !m.error && m.overlappingPhases.length > 0 && clearDecisions[m.athleteId]).length;

  if (outcome) {
    return (
      <div className="space-y-4 rounded-control border border-black/10 p-4 dark:border-white/10">
        <p className="text-sm font-medium text-zinc-900 dark:text-white">
          Assigned to {outcome.assigned.length} athlete{outcome.assigned.length === 1 ? "" : "s"} in {groupName}.
        </p>
        {outcome.assigned.length > 0 ? (
          <ul className="list-inside list-disc text-sm text-zinc-600 dark:text-zinc-300">
            {outcome.assigned.map((a) => (
              <li key={a.athleteId}>
                {a.name}: {a.workoutsCreated} workouts across {a.phasesCreated} phases
              </li>
            ))}
          </ul>
        ) : null}
        {outcome.skipped.length > 0 ? (
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-amber-600 uppercase dark:text-amber-400">Skipped</p>
            <ul className="mt-1.5 list-inside list-disc text-sm text-zinc-600 dark:text-zinc-300">
              {outcome.skipped.map((s) => (
                <li key={s.athleteId}>
                  {s.name}: {s.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {outcome.failed.length > 0 ? (
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-red-600 uppercase dark:text-red-400">Failed</p>
            <ul className="mt-1.5 list-inside list-disc text-sm text-zinc-600 dark:text-zinc-300">
              {outcome.failed.map((f) => (
                <li key={f.athleteId}>
                  {f.name}: {f.error}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <Button type="button" size="sm" onClick={() => router.push("/coaching/roster")}>
          Back to roster
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
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Applies to {members.length} athlete{members.length === 1 ? "" : "s"} in {groupName}.
      </p>

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
              resetPreviewState();
            }}
            className={fieldClass}
          >
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
            Sets each week&apos;s goal mileage for every athlete in the group. If members are meaningfully different
            fitness levels, consider a narrower group instead of one shared level.
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
        <p className={labelClass}>Strength training</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Applied the same way to every athlete in the group. The foundation is on by default; add a performance
          option only when there&rsquo;s a reason it fits the whole group.
        </p>
        <div className="mt-2 space-y-2">
          <label className="flex items-start gap-2 rounded-control border border-black/10 p-2 text-sm text-zinc-700 dark:border-white/10 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={strengthSelections.foundation}
              onChange={(e) => {
                setStrengthSelections((prev) => ({ ...prev, foundation: e.target.checked }));
                resetPreviewState();
              }}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium text-zinc-900 dark:text-white">Foundation</span> -- modified pedestal + hip
              stability, on every easy day.
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-control border border-black/10 p-2 text-sm text-zinc-700 dark:border-white/10 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={strengthSelections.heavyLifting}
              onChange={(e) => {
                setStrengthSelections((prev) => ({ ...prev, heavyLifting: e.target.checked }));
                resetPreviewState();
              }}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium text-zinc-900 dark:text-white">Heavy lifting</span> -- twice weekly after an
              easy run.
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-control border border-black/10 p-2 text-sm text-zinc-700 dark:border-white/10 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={strengthSelections.hillSprints}
              onChange={(e) => {
                setStrengthSelections((prev) => ({ ...prev, hillSprints: e.target.checked }));
                resetPreviewState();
              }}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium text-zinc-900 dark:text-white">Hill sprints</span> -- appended after easy
              runs, year-round.
            </span>
          </label>
          <div className="rounded-control border border-black/10 p-2 dark:border-white/10">
            <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={strengthSelections.plyometrics}
                onChange={(e) => {
                  setStrengthSelections((prev) => ({ ...prev, plyometrics: e.target.checked }));
                  resetPreviewState();
                }}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="font-medium text-zinc-900 dark:text-white">Plyometrics</span> -- once weekly after an
                easy run. The highest injury risk of the three performance options.
              </span>
            </label>
            {strengthSelections.plyometrics ? (
              <div className="mt-2 space-y-1.5 border-t border-black/10 pt-2 dark:border-white/10">
                <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Eligibility</p>
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input type="checkbox" checked={strengthExperienced} onChange={(e) => setStrengthExperienced(e.target.checked)} />
                  Whole group is healthy and experienced
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input type="checkbox" checked={strengthInjuryProne} onChange={(e) => setStrengthInjuryProne(e.target.checked)} />
                  Group includes injury-prone athletes
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input type="checkbox" checked={strengthRebounding} onChange={(e) => setStrengthRebounding(e.target.checked)} />
                  Group includes athletes rebounding from a recent setback
                </label>
                {!plyometricsGate.eligible ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">Will be withheld: {plyometricsGate.reasons.join(" ")}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

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
                onChange={(e) => {
                  if (!e.target.value) return setStartDateInput("");
                  const isWeekdayBound = program?.frameworkKey != null && WEEKDAY_BOUND_FRAMEWORK_KEYS.has(program.frameworkKey);
                  setStartDateInput(isWeekdayBound ? mostRecentMonday(new Date(`${e.target.value}T00:00:00Z`)) : e.target.value);
                  resetPreviewState();
                }}
                className={fieldClass}
              />
            </label>
          ) : null}
          <label className="block">
            <span className={labelClass}>Target event date{anchorMode === "startDate" ? ", optional" : ""}</span>
            <input
              type="date"
              value={targetEventDateInput}
              onChange={(e) => {
                setTargetEventDateInput(e.target.value);
                resetPreviewState();
              }}
              className={fieldClass}
            />
          </label>
        </div>
      </div>

      {program?.scalesDistanceWithMileage || program?.scalesDurationWithMileage ? (
        <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
          {program.scalesDistanceWithMileage ? (
            <label className="block">
              <span className={labelClass}>Target peak weekly mileage</span>
              <input
                value={targetPeakMilesInput}
                onChange={(e) => {
                  setTargetPeakMilesInput(e.target.value);
                  resetPreviewState();
                }}
                className={fieldClass}
              />
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
              <input
                value={targetPeakDurationInput}
                onChange={(e) => {
                  setTargetPeakDurationInput(e.target.value);
                  resetPreviewState();
                }}
                className={fieldClass}
              />
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
          live from whatever each athlete has set as their own current fitness estimate -- not something you enter
          here.
        </p>
      ) : null}

      {preview ? (
        <div className="space-y-3 rounded-control border border-black/10 p-3 dark:border-white/10">
          <p className="text-sm font-medium text-zinc-900 dark:text-white">
            {preview.totalWeeks} weeks · {formatDate(preview.startDate)} – {formatDate(preview.endDate)}
          </p>

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

          {appliedStrengthOptions.length > 0 ? <StrengthOptionsSummary options={appliedStrengthOptions} /> : null}

          {hasWarnings ? (
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={confirmedWarnings} onChange={(e) => setConfirmedWarnings(e.target.checked)} className="h-4 w-4" />
              Assign anyway, for the whole group
            </label>
          ) : null}

          <div className="space-y-2 border-t border-black/10 pt-3 dark:border-white/10">
            <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
              {groupName} -- {willAssignCount} of {memberPreviews.length} will be assigned
            </p>
            {memberPreviews.map((member) => {
              if (member.error) {
                return (
                  <div key={member.athleteId} className="rounded-control border border-black/10 p-2 text-sm dark:border-white/10">
                    <span className="font-medium text-zinc-900 dark:text-white">{member.name}</span>{" "}
                    <span className="text-zinc-500 dark:text-zinc-400">-- {member.error} (skipped)</span>
                  </div>
                );
              }
              const hasOverlap = member.overlappingPhases.length > 0;
              return (
                <div key={member.athleteId} className="rounded-control border border-black/10 p-2 dark:border-white/10">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">{member.name}</span>
                    <span className={`text-xs font-semibold ${hasOverlap ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {hasOverlap ? "Conflict" : "Ready"}
                    </span>
                  </div>
                  {hasOverlap ? (
                    <div className="mt-2 space-y-2">
                      <ul className="list-inside list-disc text-xs text-zinc-600 dark:text-zinc-300">
                        {member.overlappingPhases.map((p) => (
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
                          checked={clearDecisions[member.athleteId] ?? false}
                          onChange={(e) => setClearDecisions((prev) => ({ ...prev, [member.athleteId]: e.target.checked }))}
                          className="h-4 w-4"
                        />
                        Clear the overlapping block and assign
                      </label>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Left unchecked, this athlete is skipped.</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
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
            disabled={isPending || (hasWarnings && !confirmedWarnings) || willAssignCount === 0}
            onClick={handleAssign}
          >
            {isPending ? "Assigning…" : `Assign to ${willAssignCount} athlete${willAssignCount === 1 ? "" : "s"}`}
          </Button>
        ) : (
          <Button type="button" size="sm" disabled={isPending} onClick={handlePreview}>
            {isPending ? "Checking…" : "Preview"}
          </Button>
        )}
      </div>
    </div>
  );
}

function StrengthOptionsSummary({ options }: { options: AppliedStrengthOption[] }) {
  return (
    <div className="border-t border-black/10 pt-3 dark:border-white/10">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Strength training</p>
      <ul className="mt-1.5 space-y-1.5">
        {options.map((option) => (
          <li key={option.key} className="text-sm text-zinc-600 dark:text-zinc-300">
            <span className={`font-medium ${option.included ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"}`}>
              {STRENGTH_OPTION_LABELS[option.key]}
              {option.included ? " — included" : " — not included"}:
            </span>{" "}
            {option.rationale}
          </li>
        ))}
      </ul>
    </div>
  );
}

function WarningList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">{title}</p>
      <ul className="mt-1 list-inside list-disc text-xs text-zinc-600 dark:text-zinc-300">{children}</ul>
    </div>
  );
}
