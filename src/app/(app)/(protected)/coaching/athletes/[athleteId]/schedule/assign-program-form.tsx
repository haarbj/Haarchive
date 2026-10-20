"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  previewProgramAssignment,
  assignProgramToAthlete,
  loadUsedPaceReferenceBases,
  proposePhaseLayoutFromRaceDay,
  type AssignProgramInput,
  type OverlappingPhase,
} from "./assign-program-actions";
import type { GeneratePhaseSelection, ResolvedProgramGeneration } from "@/lib/private-coaching/program-generation";
import { PHASE_PROFILES, type PhaseLayoutProposal, weeksAvailableBetween } from "@/lib/private-coaching/race-anchored-planning";
import {
  DEFAULT_STRENGTH_SELECTIONS,
  plyometricsEligibility,
  type AppliedStrengthOption,
  type StrengthSelections,
} from "@/lib/private-coaching/strength-scheduling";
import { checkRedemptionRaceGuardrail } from "./post-race-actions";
import type { RedemptionGuardrail } from "@/lib/private-coaching/post-race";
import { checkMileageMatch } from "./onboarding-actions";
import type { MileageMatchResult } from "@/lib/private-coaching/onboarding";
import { durationSelectionGuidance, type DurationGuidance } from "@/lib/private-coaching/plan-selection-guidance";
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
  /** The seeded framework this program is ("canyon"/"mesa"/"ridge"/"peak"/"summit"), or null for every other program (recovery, race lead-in, crash course, hand-authored). Only the five frameworks are weekday-bound (Monday-first authored weeks, Sunday long runs) -- see the start-date input's own Monday-snap below. */
  frameworkKey: string | null;
  variants: ProgramOptionVariant[];
  /** Empty for every hand-authored program, which derives week totals from its own authored day distances instead. */
  volumeVariants: ProgramOptionVolumeVariant[];
};

/** Derived from PHASE_PROFILES, not a separately hand-maintained list -- the five seeded frameworks whose authored weeks are Monday-first and need the start-date input snapped to a Monday. Every other program (recovery, race lead-in, crash course, hand-authored) is day-sequenced, not weekday-bound, and accepts any start date as-is. */
const WEEKDAY_BOUND_FRAMEWORK_KEYS = new Set(PHASE_PROFILES.map((p) => p.key));

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
  // Item 30's foundation + three performance options. Foundation defaults
  // on for every athlete ("when in doubt, stability work only" --
  // strengthTrainingGuidance); the three performance options default off,
  // since each is a real coaching judgment about this specific athlete,
  // not something to guess at. The three gating facts below are the same
  // coach-asserted, never-persisted inputs specialBlockEligibility's own
  // UI (advanced-techniques-panel.tsx) already uses -- this module makes
  // no diagnosis and reads none; an injury or setback case routes to the
  // existing injury paradigms and a professional, same as everywhere else.
  const [strengthSelections, setStrengthSelections] = useState<StrengthSelections>(DEFAULT_STRENGTH_SELECTIONS);
  const [strengthInjuryProne, setStrengthInjuryProne] = useState(false);
  const [strengthRebounding, setStrengthRebounding] = useState(false);
  const [strengthExperienced, setStrengthExperienced] = useState(false);
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
  // The most recent "lay out from race day" proposal, kept so its reasoning
  // stays on screen next to the week inputs it filled. Cleared whenever the
  // coach changes any of those inputs by hand, because the notes would then
  // be describing numbers that are no longer there.
  const [layout, setLayout] = useState<{ proposal: PhaseLayoutProposal; weeksAvailable: number; spareDays: number } | null>(null);
  // Part H item 20. Advisory and never blocking: it tells the coach this
  // buildup starts too soon after a marathon, and they assign anyway if
  // they judge that right.
  const [redemption, setRedemption] = useState<RedemptionGuardrail | null>(null);
  // Part D item 8 / Part K item 31: whether this plan's starting mileage
  // is a real stretch from the athlete's current running.
  const [mileageMatch, setMileageMatch] = useState<MileageMatchResult | null>(null);
  // Part D item 9: whether the weeks until race day match a standard
  // layout, and if not, what to do about it. Pure and DB-free, so computed
  // straight from the preview's own start date rather than a server action.
  const [durationGuidance, setDurationGuidance] = useState<DurationGuidance | null>(null);

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
  const [appliedStrengthOptions, setAppliedStrengthOptions] = useState<AppliedStrengthOption[]>([]);
  const [assignResult, setAssignResult] = useState<{
    phasesCreated?: number;
    workoutsCreated?: number;
    skippedDates?: string[];
    clearedWorkouts?: number;
    clearedWeekPlans?: number;
    clearedPhases?: number;
    appliedStrengthOptions?: AppliedStrengthOption[];
  } | null>(null);

  // How many weeks this assignment currently selects, in total -- plyometrics'
  // eight-week floor (plyometricsEligibility) is checked against this live,
  // before the coach ever previews, so an ineligible choice shows its
  // rationale immediately rather than only after a round trip. Cheap
  // enough to recompute every render; not memoized because `variant` is
  // itself a plain derived value, not a stable reference to depend on.
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

  function updateProgram(nextProgramId: string) {
    setProgramId(nextProgramId);
    const nextProgram = programs.find((p) => p.id === nextProgramId) ?? null;
    const nextVariant = nextProgram?.variants[0] ?? null;
    setLayout(null);
    setVariantId(nextVariant?.id ?? "");
    setVolumeVariantId("");
    setPhaseSelections(defaultSelections(nextVariant));
    setPreview(null);
    setOverlappingPhases([]);
    setClearOverlapping(false);
    setConfirmedWarnings(false);
  }
  function updateVariant(nextVariantId: string) {
    setLayout(null);
    setVariantId(nextVariantId);
    const nextVariant = program?.variants.find((v) => v.id === nextVariantId) ?? null;
    setPhaseSelections(defaultSelections(nextVariant));
    setPreview(null);
    setOverlappingPhases([]);
    setClearOverlapping(false);
    setConfirmedWarnings(false);
  }
  function updatePhaseSelection(phaseId: string, patch: Partial<PhaseSelectionState>) {
    setLayout(null);
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
        strengthSelections,
        strengthGating: {
          injuryProne: strengthInjuryProne,
          reboundingFromSetback: strengthRebounding,
          experiencedAthlete: strengthExperienced,
        },
      },
    };
  }


  // Part A item 1. Fills the same per-phase week inputs the coach would
  // otherwise type, then leaves them alone: this proposes, it never
  // assigns, and the coach can overwrite any of it before previewing.
  async function handleLayOutFromRaceDay() {
    setError(null);
    if (!program || !variant) return setError("Choose a program and plan length.");
    if (!targetEventDateInput) return setError("Pick a target race date to lay phases out from.");

    const chosenVolume = volumeVariants.find((v) => v.id === volumeVariantId) ?? null;
    const typedPeak = targetPeakMilesInput.trim() ? Number(targetPeakMilesInput) : null;
    const peakMileage =
      chosenVolume?.peakMileage ?? (typedPeak != null && Number.isFinite(typedPeak) && typedPeak > 0 ? typedPeak : null);

    setIsPending(true);
    const result = await proposePhaseLayoutFromRaceDay({
      programId: program.id,
      variantId: variant.id,
      athleteId,
      raceDate: targetEventDateInput,
      startDate: anchorMode === "startDate" && startDateInput ? startDateInput : null,
      peakMileage,
    });
    setIsPending(false);
    if (result.error || !result.proposal) return setError(result.error ?? "Couldn't lay this plan out.");

    setPhaseSelections((prev) => {
      const next = new Map(prev);
      for (const proposed of result.proposal!.phases) {
        const current = next.get(proposed.phaseDefinitionId) ?? { include: false, weeksInput: "" };
        next.set(proposed.phaseDefinitionId, { ...current, include: proposed.include, weeksInput: String(proposed.weeks) });
      }
      return next;
    });
    setLayout({ proposal: result.proposal, weeksAvailable: result.weeksAvailable ?? 0, spareDays: result.spareDays ?? 0 });
    setPreview(null);
    setOverlappingPhases([]);
    setClearOverlapping(false);
    setConfirmedWarnings(false);
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
    setAppliedStrengthOptions(result.appliedStrengthOptions ?? []);
    setClearOverlapping(false);

    // Checked against the plan's own first day, which is what the preview
    // just worked out, rather than against whatever the coach typed.
    if (result.result?.startDate && program) {
      const guardrail = await checkRedemptionRaceGuardrail({
        athleteId,
        programId: program.id,
        startDate: result.result.startDate,
      });
      setRedemption(guardrail.guardrail?.flagged ? guardrail.guardrail : null);

      const mileage = await checkMileageMatch({
        athleteId,
        programId: program.id,
        volumeVariantId: volumeVariantId || null,
      });
      setMileageMatch(mileage.result?.isStretch ? mileage.result : null);

      if (targetEventDateInput) {
        const { weeks } = weeksAvailableBetween(result.result.startDate, targetEventDateInput);
        const guidance = durationSelectionGuidance(weeks);
        setDurationGuidance(guidance.flagged ? guidance : null);
      } else {
        setDurationGuidance(null);
      }
    } else {
      setDurationGuidance(null);
    }
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
        {assignResult.appliedStrengthOptions && assignResult.appliedStrengthOptions.length > 0 ? (
          <StrengthOptionsSummary options={assignResult.appliedStrengthOptions} />
        ) : null}
        <div className="flex flex-wrap gap-3">
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
          {/* Same component the athlete's own "Your Plan" payoff renders
              (coaching/your-plan) -- read-only here, see that route's own
              header comment on why there's no sample data to label. */}
          <Button href={`/coaching/athletes/${athleteId}/your-plan-preview`} size="sm" variant="outline">
            Preview their &ldquo;Your Plan&rdquo;
          </Button>
        </div>
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

      {mileageMatch ? (
        <div className="rounded-card border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
            Mileage check
          </p>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300">{mileageMatch.detail}</p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">This does not stop you assigning the plan.</p>
        </div>
      ) : null}

      {durationGuidance ? (
        <div className="rounded-card border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
            Plan length
          </p>
          <p className="mt-1.5 text-sm font-semibold text-zinc-900 dark:text-white">{durationGuidance.title}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{durationGuidance.detail}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {durationGuidance.actions.map((action) => (
              <li key={action} className="text-sm text-zinc-600 dark:text-zinc-300">
                {action}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">This does not stop you assigning the plan.</p>
        </div>
      ) : null}

      {redemption ? (
        <div className="rounded-card border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
            Worth a second look
          </p>
          <p className="mt-1.5 text-sm font-semibold text-zinc-900 dark:text-white">{redemption.title}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{redemption.detail}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {redemption.actions.map((action) => (
              <li key={action} className="text-sm text-zinc-600 dark:text-zinc-300">
                {action}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            This does not stop you assigning the plan.
          </p>
        </div>
      ) : null}

      {variant ? (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={labelClass}>Phases</p>
            <Button type="button" variant="ghost" size="sm" onClick={handleLayOutFromRaceDay} disabled={isPending}>
              Lay out phases from race day
            </Button>
          </div>
          {layout ? (
            <div className="mt-1.5 rounded-control border border-black/10 p-3 dark:border-white/10">
              <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
                Suggested layout
              </p>
              <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                {layout.weeksAvailable} week{layout.weeksAvailable === 1 ? "" : "s"}
                {layout.spareDays > 0 ? ` and ${layout.spareDays} day${layout.spareDays === 1 ? "" : "s"}` : ""} until race
                day. These are suggestions. Adjust anything below before previewing.
              </p>
              <ul className="mt-2 space-y-1">
                {layout.proposal.notes.map((note) => (
                  <li key={note} className="text-sm text-zinc-500 dark:text-zinc-400">
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
          The foundation is on by default for every athlete -- when in doubt, stability work only. Add a performance
          option only when there&rsquo;s a specific reason to.
        </p>
        <div className="mt-2 space-y-2">
          <label className="flex items-start gap-2 rounded-control border border-black/10 p-2 text-sm text-zinc-700 dark:border-white/10 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={strengthSelections.foundation}
              onChange={(e) => {
                setStrengthSelections((prev) => ({ ...prev, foundation: e.target.checked }));
                setPreview(null);
              }}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium text-zinc-900 dark:text-white">Foundation</span> -- modified pedestal + hip
              stability, on every easy day. No equipment, minimal time, never impairs the next day&rsquo;s run.
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-control border border-black/10 p-2 text-sm text-zinc-700 dark:border-white/10 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={strengthSelections.heavyLifting}
              onChange={(e) => {
                setStrengthSelections((prev) => ({ ...prev, heavyLifting: e.target.checked }));
                setPreview(null);
              }}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium text-zinc-900 dark:text-white">Heavy lifting</span> -- twice weekly after an
              easy run, never before it. Full volume in the general phase, 60-70% maintenance in supportive/specific.
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-control border border-black/10 p-2 text-sm text-zinc-700 dark:border-white/10 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={strengthSelections.hillSprints}
              onChange={(e) => {
                setStrengthSelections((prev) => ({ ...prev, hillSprints: e.target.checked }));
                setPreview(null);
              }}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium text-zinc-900 dark:text-white">Hill sprints</span> -- appended after easy
              runs, year-round. The most running-specific option, minimal soreness.
            </span>
          </label>
          <div className="rounded-control border border-black/10 p-2 dark:border-white/10">
            <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={strengthSelections.plyometrics}
                onChange={(e) => {
                  setStrengthSelections((prev) => ({ ...prev, plyometrics: e.target.checked }));
                  setPreview(null);
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
                <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                  Eligibility
                </p>
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={strengthExperienced}
                    onChange={(e) => setStrengthExperienced(e.target.checked)}
                  />
                  Healthy, experienced athlete
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={strengthInjuryProne}
                    onChange={(e) => setStrengthInjuryProne(e.target.checked)}
                  />
                  Injury-prone
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={strengthRebounding}
                    onChange={(e) => setStrengthRebounding(e.target.checked)}
                  />
                  Rebounding from a recent setback
                </label>
                {!plyometricsGate.eligible ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Will be withheld: {plyometricsGate.reasons.join(" ")}
                  </p>
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
                  // Only the five seeded frameworks are weekday-bound
                  // (Monday-first authored weeks, Sunday long runs) -- every
                  // other program (recovery, race lead-in, crash course,
                  // hand-authored) is day-sequenced and the athlete should
                  // start exactly when they pick, e.g. post-marathon
                  // recovery starting the day running actually resumes.
                  const isWeekdayBound = program?.frameworkKey != null && WEEKDAY_BOUND_FRAMEWORK_KEYS.has(program.frameworkKey);
                  setStartDateInput(isWeekdayBound ? mostRecentMonday(new Date(`${e.target.value}T00:00:00Z`)) : e.target.value);
                }}
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

          {appliedStrengthOptions.length > 0 ? <StrengthOptionsSummary options={appliedStrengthOptions} /> : null}

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

const STRENGTH_OPTION_LABELS: Record<AppliedStrengthOption["key"], string> = {
  foundation: "Foundation",
  "heavy-lifting": "Heavy lifting",
  plyometrics: "Plyometrics",
  "hill-sprints": "Hill sprints",
};

// The coach-facing summary of which strength options actually landed on
// this assignment's calendar, and why -- including, by design, why one
// the coach asked for was withheld (e.g. plyometrics withheld for an
// athlete rebounding from a setback). Shown both in the preview, before
// anything is written, and on the confirmation screen after assigning.
function StrengthOptionsSummary({ options }: { options: AppliedStrengthOption[] }) {
  return (
    <div className="border-t border-black/10 pt-3 dark:border-white/10">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
        Strength training
      </p>
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
