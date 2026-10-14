"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { savePhase, deletePhase, clearPhaseTraining, shiftPhaseDates, rescalePhaseMileage } from "./actions";
import { previewPhaseResync, resyncPhaseFromProgram, type PhaseResyncPreview } from "./assign-program-actions";
import { DateRangePicker } from "./date-range-picker";
import { SUGGESTED_PHASE_TYPES } from "@/lib/private-coaching/training-phases";
import { formatDate } from "@/lib/format";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { ConfirmButton } from "@/components/ui/confirm-button";

export type PhaseGoalOption = { id: string; raceName: string; goalDate: string };

export type ExistingPhase = {
  id: string;
  phaseType: string;
  name: string | null;
  startDate: string;
  endDate: string;
  goalId: string | null;
  notes: string | null;
  explainer: string | null;
  sourceProgramId: string | null;
};

// Create/edit form for an explicit, coach-defined training phase -- see
// training-phases.ts's own comment: the coach says "this is Build," the
// system never infers it. Mirrors WeekPlanEditor's inline toggle-to-edit-
// form pattern (week-plan-editor.tsx), reused here for both creating a
// new phase ("+ Add phase") and editing an existing one.
export function PhaseForm({
  athleteId,
  goalOptions,
  existing,
  onDone,
  onCancel,
}: {
  athleteId: string;
  goalOptions: PhaseGoalOption[];
  existing?: ExistingPhase;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [phaseType, setPhaseType] = useState(existing?.phaseType ?? "");
  const [name, setName] = useState(existing?.name ?? "");
  const [startDate, setStartDate] = useState(existing?.startDate ?? "");
  const [endDate, setEndDate] = useState(existing?.endDate ?? "");
  const [goalId, setGoalId] = useState(existing?.goalId ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [explainer, setExplainer] = useState(existing?.explainer ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [shiftWeeks, setShiftWeeks] = useState("1");
  const [isShifting, setIsShifting] = useState(false);
  const [newPeak, setNewPeak] = useState("");
  const [isRescaling, setIsRescaling] = useState(false);
  const [rescaleMessage, setRescaleMessage] = useState<string | null>(null);
  const [resyncPreview, setResyncPreview] = useState<PhaseResyncPreview | null>(null);
  const [isResyncing, setIsResyncing] = useState(false);
  const [resyncMessage, setResyncMessage] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!phaseType.trim()) return setError("Give this phase a type.");
    if (!startDate || !endDate) return setError("Pick a start and end date.");
    setIsPending(true);
    try {
      const result = await savePhase({
        id: existing?.id,
        athleteId,
        phaseType,
        name: name.trim() || null,
        startDate,
        endDate,
        goalId: goalId || null,
        notes: notes.trim() || null,
        explainer: explainer.trim() || null,
      });
      if (result.error) return setError(result.error);
      onDone();
      router.refresh();
    } catch {
      // An unexpected throw (network hiccup, unhandled server error) must
      // still surface as a real, visible error -- never leave the button
      // stuck on its pending label with no feedback at all.
      setError("Something went wrong saving this phase. Try again.");
    } finally {
      setIsPending(false);
    }
  }

  // Moves this whole phase -- and every workout/week-plan inside it -- by
  // whole weeks, for the real "built this against the wrong week" mistake.
  // Closes the form on success (same as delete, below) rather than trying
  // to keep this form's own local start/end date state in sync with the
  // now-stale `existing` prop; reopening "Edit" afterward shows the real,
  // shifted dates.
  async function handleShift(direction: 1 | -1) {
    if (!existing) return;
    const n = Number(shiftWeeks);
    if (!Number.isInteger(n) || n <= 0) return setError("Enter a whole number of weeks to shift by.");
    setError(null);
    setIsShifting(true);
    try {
      const result = await shiftPhaseDates(existing.id, athleteId, n * direction);
      if (result.error) return setError(result.error);
      onDone();
      router.refresh();
    } catch {
      setError("Something went wrong shifting this phase. Try again.");
    } finally {
      setIsShifting(false);
    }
  }

  // Rescales every workout's planned distance in this phase to a corrected
  // peak weekly mileage -- the real "the template got imported at the
  // wrong volume" fix. Stays open on success (unlike delete/shift above)
  // so the coach can see the confirmation and keep editing; nothing about
  // this form's own dates/type/name state goes stale the way a shift does.
  async function handleRescale() {
    if (!existing) return;
    const peak = Number(newPeak);
    if (!Number.isFinite(peak) || peak <= 0) return setError("Enter a target peak weekly mileage greater than 0.");
    setError(null);
    setRescaleMessage(null);
    setIsRescaling(true);
    try {
      const result = await rescalePhaseMileage(existing.id, athleteId, peak);
      if (result.error) return setError(result.error);
      setRescaleMessage(
        `Recomputed ${result.scaledWorkouts} workout${result.scaledWorkouts === 1 ? "" : "s"} from the plan's own ${result.oldPeakWeeklyMiles}mi reference peak to a ${result.newPeakWeeklyMiles}mi peak week (${result.scaledWeekPlans ?? 0} week target${result.scaledWeekPlans === 1 ? "" : "s"} updated to match).`,
      );
      router.refresh();
    } catch {
      // Same reasoning as handleSubmit/handleShift above -- this is very
      // likely what actually happened the first time this shipped: a
      // thrown error left isRescaling stuck true with no error and no
      // confirmation, which looked exactly like the rescale silently doing
      // nothing even if the underlying write partially succeeded.
      setError("Something went wrong rescaling this phase. The mileage may be partially updated -- check the roadmap and try again.");
    } finally {
      setIsRescaling(false);
    }
  }

  // Pulls this phase's own source Program's current content -- see
  // resyncPhaseFromProgram's own header comment for why editing a Program
  // never otherwise reaches an athlete it's already been assigned to.
  // Two-step, like AssignProgramForm's own preview-then-confirm: the
  // preview's counts are what make "replace every workout here" an
  // informed choice rather than a surprise.
  async function handlePreviewResync() {
    if (!existing) return;
    setError(null);
    setResyncMessage(null);
    setIsResyncing(true);
    try {
      const result = await previewPhaseResync(existing.id, athleteId);
      if (result.error) return setError(result.error);
      setResyncPreview(result.preview ?? null);
    } catch {
      setError("Something went wrong checking this phase against its program. Try again.");
    } finally {
      setIsResyncing(false);
    }
  }

  async function handleResync() {
    if (!existing) return;
    setError(null);
    setIsResyncing(true);
    try {
      const result = await resyncPhaseFromProgram(existing.id, athleteId);
      if (result.error) return setError(result.error);
      setResyncPreview(null);
      setResyncMessage(
        `Replaced ${result.clearedWorkouts ?? 0} workout${result.clearedWorkouts === 1 ? "" : "s"} and ${result.clearedWeekPlans ?? 0} week target${result.clearedWeekPlans === 1 ? "" : "s"} with ${result.workoutsCreated ?? 0} freshly-generated from the program.`,
      );
      router.refresh();
    } catch {
      setError("Something went wrong resyncing this phase. It may be partially updated -- check the roadmap and try again.");
    } finally {
      setIsResyncing(false);
    }
  }

  return (
    <div className="space-y-3 rounded-control border border-black/10 p-3 dark:border-white/10">
      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Phase type</span>
          <input
            list="phase-type-suggestions"
            value={phaseType}
            onChange={(e) => setPhaseType(e.target.value)}
            placeholder="Base, Build, Peak, Taper…"
            className={fieldClass}
          />
          <datalist id="phase-type-suggestions">
            {SUGGESTED_PHASE_TYPES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className={labelClass}>Name (optional)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aerobic Development" className={fieldClass} />
        </label>
      </div>

      <div>
        <span className={labelClass}>Dates</span>
        <DateRangePicker
          startDate={startDate || null}
          endDate={endDate || null}
          onChange={({ startDate: s, endDate: e }) => {
            setStartDate(s ?? "");
            setEndDate(e ?? "");
          }}
        />
      </div>

      {existing ? (
        <div className="border-t border-black/10 pt-3 dark:border-white/10">
          <span className={labelClass}>Shift entire phase (fix a wrong start date)</span>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Moves this phase&rsquo;s dates and every workout and week plan inside it together, in whole weeks --
            for when the whole block landed on the wrong week.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={isShifting} onClick={() => handleShift(-1)}>
              ◂ Earlier
            </Button>
            <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
              <input
                type="number"
                min={1}
                step={1}
                value={shiftWeeks}
                onChange={(e) => setShiftWeeks(e.target.value)}
                className={`${fieldClass} w-16 text-center`}
              />
              week{Number(shiftWeeks) === 1 ? "" : "s"}
            </label>
            <Button type="button" variant="outline" size="sm" disabled={isShifting} onClick={() => handleShift(1)}>
              Later ▸
            </Button>
            {isShifting ? <span className="text-xs text-zinc-500 dark:text-zinc-400">Shifting…</span> : null}
          </div>
        </div>
      ) : null}

      {existing ? (
        <div className="border-t border-black/10 pt-3 dark:border-white/10">
          <span className={labelClass}>Rescale mileage (fix a wrong peak)</span>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Rescales every workout&rsquo;s planned distance in this phase proportionally to a corrected peak weekly
            mileage -- for when the imported template (or a hand-built phase) was set up at the wrong volume. Pace
            and heart-rate targets aren&rsquo;t affected.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
              New peak
              <input
                type="number"
                min={1}
                value={newPeak}
                onChange={(e) => setNewPeak(e.target.value)}
                placeholder="e.g. 85"
                className={`${fieldClass} w-20`}
              />
              mi/week
            </label>
            <Button type="button" variant="outline" size="sm" disabled={isRescaling || !newPeak} onClick={handleRescale}>
              {isRescaling ? "Rescaling…" : "Rescale"}
            </Button>
          </div>
          {rescaleMessage ? <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{rescaleMessage}</p> : null}
        </div>
      ) : null}

      {existing?.sourceProgramId ? (
        <div className="border-t border-black/10 pt-3 dark:border-white/10">
          <span className={labelClass}>Resync from program</span>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Pulls this program&rsquo;s current content into this phase, replacing every workout and week target in
            it -- for when the program itself was edited after this phase was assigned. Keeps this phase&rsquo;s own
            dates and the athlete&rsquo;s current peak volume; use Rescale above separately if the volume itself
            also needs to change.
          </p>
          {!resyncPreview ? (
            <div className="mt-2 flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled={isResyncing} onClick={handlePreviewResync}>
                {isResyncing ? "Checking…" : "Check for changes"}
              </Button>
            </div>
          ) : (
            <div className="mt-2 space-y-2 rounded-control border border-black/10 p-2 dark:border-white/10">
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                Will replace {resyncPreview.currentWorkoutCount} existing workout
                {resyncPreview.currentWorkoutCount === 1 ? "" : "s"} and {resyncPreview.currentWeekPlanCount} week
                target{resyncPreview.currentWeekPlanCount === 1 ? "" : "s"} with {resyncPreview.generation.days.length}{" "}
                regenerated from the program.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <ConfirmButton
                  action={handleResync}
                  confirmMessage={`Replace every workout and week target in this phase (${formatDate(existing.startDate)} – ${formatDate(existing.endDate)}) with ${resyncPreview.generation.days.length} freshly generated from the program? This can't be undone.`}
                  label="Resync this phase"
                  pendingLabel="Resyncing…"
                  className="text-xs font-semibold text-zinc-700 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-300 dark:decoration-white/20 dark:hover:decoration-white"
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => setResyncPreview(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {resyncMessage ? <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{resyncMessage}</p> : null}
        </div>
      ) : null}

      {goalOptions.length > 0 ? (
        <label className="block">
          <span className={labelClass}>Link to a goal (optional)</span>
          <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className={fieldClass}>
            <option value="">-- None --</option>
            {goalOptions.map((g) => (
              <option key={g.id} value={g.id}>
                {g.raceName} -- {g.goalDate}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="block">
        <span className={labelClass}>Notes (optional)</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={fieldClass} />
      </label>

      {/* What this athlete reads under "Why this phase?" on their own
          roadmap. Pre-filled from the Program when the phase was assigned;
          editing it here changes only this athlete's copy. */}
      <label className="block">
        <span className={labelClass}>Why this phase, shown to the athlete (optional)</span>
        <textarea
          value={explainer}
          onChange={(e) => setExplainer(e.target.value)}
          rows={6}
          placeholder="Blank lines separate paragraphs. Leave empty to use the standard explanation for this phase type."
          className={fieldClass}
        />
      </label>

      {error && <FormError>{error}</FormError>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" disabled={isPending} onClick={handleSubmit}>
          {isPending ? "Saving…" : "Save phase"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        {existing ? (
          <ConfirmButton
            action={() =>
              deletePhase(existing.id, athleteId).then(() => {
                onDone();
                router.refresh();
              })
            }
            confirmMessage="Delete this phase? Its workouts and week plans stay in the calendar, just unphased."
            label="Delete"
            pendingLabel="Deleting…"
            className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
          />
        ) : null}
        {existing ? (
          <ConfirmButton
            action={() =>
              clearPhaseTraining(existing.id, athleteId).then((result) => {
                if (result.error) return;
                onDone();
                router.refresh();
              })
            }
            confirmMessage={`Clear every workout and week plan in this phase (${formatDate(existing.startDate)} – ${formatDate(existing.endDate)}), and delete the phase itself? This can't be undone -- use this to start this block over from scratch.`}
            label="Clear this phase's training"
            pendingLabel="Clearing…"
            className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
          />
        ) : null}
      </div>
    </div>
  );
}
