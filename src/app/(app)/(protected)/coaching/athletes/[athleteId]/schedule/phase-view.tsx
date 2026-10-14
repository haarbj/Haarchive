"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  weeksInPhase,
  phaseWeekCount,
  getPhaseTypeAccent,
  buildRoadmapSections,
  type TrainingPhase,
} from "@/lib/private-coaching/training-phases";
import { formatWeeksAwayLabel, weeksUntilGoalRace, type AthleteGoalRace } from "@/lib/private-coaching/goal-race";
import { DAY_TYPE_BORDER_CLASSES } from "@/lib/private-coaching/day-type-visuals";
import { mostRecentMonday } from "@/lib/week";
import { formatDate } from "@/lib/format";
import type { AthleteMostRecentRace } from "@/lib/private-coaching/pace-reference";
import { PhaseForm, type ExistingPhase, type PhaseGoalOption } from "./phase-form";
import { ImportPlanForm } from "./import-plan-form";
import { AssignProgramForm, type ProgramOption } from "./assign-program-form";
import { applyRaceLeadIn, type ApplyRaceLeadInResult } from "./race-lead-in-actions";
import { PlanHealthPanel } from "./plan-health-panel";
import { EstimateReviewPanel } from "./estimate-review-panel";
import { MultiCyclePanel } from "./multi-cycle-panel";
import { PostRacePanel } from "./post-race-panel";
import { formatTargetVolume } from "./week-plan-editor";
import { clearAllTraining } from "./actions";
import { PhaseExplainer } from "@/components/private-coaching/phase-explainer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";

export type PhaseViewWeekInfo = {
  label: string | null;
  targetVolumeMin: number | null;
  targetVolumeMax: number | null;
  targetVolumeUnit: "miles" | "minutes" | null;
};

// Phases (ordered by start_date) each containing their own weeks, ending
// at the goal race -- the actual training roadmap, not just a flat week
// list. Phase membership is derived purely from date math (weeksInPhase),
// never from training_week_plans -- a phase's weeks render immediately on
// creation with zero week-plan rows required to exist. Gaps between
// phases (before phases are set up, or a real gap a coach left) render
// under a plain "Unphased" heading rather than being hidden or mis-
// attributed. Read-only roadmap + phase CRUD live here; clicking any week
// hands off into Week View, which is where the actual planning happens.
export function PhaseView({
  athleteId,
  phases,
  weekInfoByWeek,
  goalRace,
  goalOptions,
  copiedWeek,
  mostRecentRace,
  programs,
  preselectProgramId,
}: {
  athleteId: string;
  phases: TrainingPhase[];
  weekInfoByWeek: Record<string, PhaseViewWeekInfo>;
  goalRace: AthleteGoalRace | null;
  goalOptions: PhaseGoalOption[];
  copiedWeek: string | null;
  // Seeds the "Import a training plan" form's reference-race fields --
  // see ImportPlanForm's own comment on why this comes from a prop rather
  // than fetching itself (Phase View is the one place that already has a
  // server-side fetch boundary; the form itself is a client component).
  mostRecentRace: AthleteMostRecentRace | null;
  // This coach's own Program library, fed into "Assign a program" --
  // same server-fetch-boundary reasoning as mostRecentRace above.
  programs: ProgramOption[];
  // Set when this page was reached via a program's own "Assign to athlete"
  // deep link (see /coaching/programs/[programId]'s AssignToAthleteButton)
  // -- opens the assign form immediately with that program preselected,
  // instead of requiring a second click on "Assign a program" here.
  preselectProgramId?: string | null;
}) {
  const router = useRouter();
  const [leadInPending, setLeadInPending] = useState(false);
  const [leadInResult, setLeadInResult] = useState<ApplyRaceLeadInResult | null>(null);
  const [formTarget, setFormTarget] = useState<"new" | "import" | "assign-program" | ExistingPhase | null>(
    preselectProgramId ? "assign-program" : null,
  );

  const sections = buildRoadmapSections(phases);

  function weekHref(week: string) {
    const params = new URLSearchParams({ view: "week", week });
    if (copiedWeek) params.set("copiedWeek", copiedWeek);
    return `?${params.toString()}`;
  }

  function toExistingPhase(phase: TrainingPhase): ExistingPhase {
    return {
      id: phase.id,
      phaseType: phase.phaseType,
      name: phase.name,
      startDate: phase.startDate,
      endDate: phase.endDate,
      goalId: phase.goalId,
      notes: phase.notes,
      explainer: phase.explainer,
      sourceProgramId: phase.sourceProgramId,
    };
  }

  return (
    <div className="space-y-6">
      {sections.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-300">
          No phases set up yet -- add one to start building this athlete&rsquo;s training roadmap.
        </p>
      ) : null}

      {sections.map((section, i) =>
        section.kind === "phase" ? (
          <div key={section.phase.id}>
            <div className={`border-l-4 pl-3 ${DAY_TYPE_BORDER_CLASSES[getPhaseTypeAccent(section.phase.phaseType)]}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold tracking-wide text-zinc-900 uppercase dark:text-white">
                  {section.phase.phaseType}
                  {section.phase.name ? ` — ${section.phase.name}` : ""}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {formatDate(section.phase.startDate)} – {formatDate(section.phase.endDate)} · {phaseWeekCount(section.phase)}{" "}
                  week{phaseWeekCount(section.phase) === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormTarget(toExistingPhase(section.phase))}
                className="mt-1 text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
              >
                Edit
              </button>
              {/* The same "Why this phase?" the athlete sees, so a coach is
                  never guessing what was actually communicated. Its Edit
                  link goes to the source Program phase, which is where a
                  change affects FUTURE assignments; changing this athlete's
                  own copy is the Edit button above. */}
              <PhaseExplainer
                phaseType={section.phase.phaseType}
                explainer={section.phase.explainer}
                editHref={
                  section.phase.sourceProgramId && section.phase.sourceProgramPhaseDefinitionId
                    ? `/coaching/programs/${section.phase.sourceProgramId}/phases/${section.phase.sourceProgramPhaseDefinitionId}`
                    : null
                }
              />
            </div>
            <div className="mt-2 space-y-1.5">
              {weeksInPhase(section.phase).map((week, weekIndex, allWeeks) => (
                <WeekRow
                  key={week}
                  href={weekHref(week)}
                  positionLabel={`Week ${weekIndex + 1} of ${allWeeks.length}`}
                  week={week}
                  info={weekInfoByWeek[week]}
                />
              ))}
            </div>
          </div>
        ) : (
          <div key={`unphased-${i}`}>
            <p className="text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Unphased</p>
            <div className="mt-2 space-y-1.5">
              {section.weeks.map((week) => (
                <WeekRow key={week} href={weekHref(week)} positionLabel={null} week={week} info={weekInfoByWeek[week]} />
              ))}
            </div>
          </div>
        ),
      )}

      {/* Part H, coach-only. Fires once a goal race has passed and goes
          quiet after eight weeks, so it sits above the rest while live. */}
      <PostRacePanel athleteId={athleteId} />

      {/* Part B, coach-only. Renders nothing when there is nothing to say. */}
      <PlanHealthPanel athleteId={athleteId} />

      {/* Part F, coach-only. On demand: a review is something the coach
          chooses to run, not a number that should appear unbidden. */}
      <EstimateReviewPanel athleteId={athleteId} />

      {/* Part G, coach-only. Derived from the phases already on the
          schedule, so the history cannot drift from what happened. */}
      <MultiCyclePanel athleteId={athleteId} />

      <Card padding="md">
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Goal Race</p>
        {goalRace ? (
          <>
            <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">{goalRace.raceName}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {formatDate(goalRace.goalDate)} · {formatWeeksAwayLabel(weeksUntilGoalRace(mostRecentMonday(new Date()), goalRace.goalDate))}
            </p>
            {/* Part A item 2. Writes drafts onto the fourteen days ending on
                race day and never touches a phase, so it can be run over an
                existing plan's final two weeks. Occupied days are skipped
                rather than overwritten, which also makes it re-runnable. */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={leadInPending}
                onClick={async () => {
                  setLeadInPending(true);
                  setLeadInResult(null);
                  const result = await applyRaceLeadIn({ athleteId, raceDate: goalRace.goalDate });
                  setLeadInPending(false);
                  setLeadInResult(result);
                  if (!result.error) router.refresh();
                }}
              >
                {leadInPending ? "Applying…" : "Apply standard 2-week lead-in"}
              </Button>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Creates editable drafts. Nothing is published.</span>
            </div>
            {leadInResult?.error ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{leadInResult.error}</p>
            ) : leadInResult ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                {leadInResult.created} draft session{leadInResult.created === 1 ? "" : "s"} written
                {leadInResult.skippedDates && leadInResult.skippedDates.length > 0
                  ? `. ${leadInResult.skippedDates.length} day${leadInResult.skippedDates.length === 1 ? "" : "s"} already had a workout and ${leadInResult.skippedDates.length === 1 ? "was" : "were"} left alone: ${leadInResult.skippedDates.map((d) => formatDate(d)).join(", ")}.`
                  : "."}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-300">
            No goal race set. Setting one unlocks laying phases out from race day and applying the two-week lead-in.
          </p>
        )}
      </Card>

      {formTarget === "import" ? (
        <ImportPlanForm
          athleteId={athleteId}
          initialRace={mostRecentRace}
          onDone={() => setFormTarget(null)}
          onCancel={() => setFormTarget(null)}
        />
      ) : formTarget === "assign-program" ? (
        <AssignProgramForm
          athleteId={athleteId}
          programs={programs}
          initialProgramId={preselectProgramId ?? undefined}
          onDone={() => setFormTarget(null)}
          onCancel={() => setFormTarget(null)}
        />
      ) : formTarget ? (
        <PhaseForm
          athleteId={athleteId}
          goalOptions={goalOptions}
          existing={formTarget === "new" ? undefined : formTarget}
          onDone={() => setFormTarget(null)}
          onCancel={() => setFormTarget(null)}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setFormTarget("new")}>
            + Add phase
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setFormTarget("import")}>
            Import a training plan
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setFormTarget("assign-program")}>
            Assign a program
          </Button>
          <ConfirmButton
            action={() => clearAllTraining(athleteId).then(() => router.refresh())}
            confirmMessage="Clear ALL planned training for this athlete -- every workout, week plan, and phase, with no date limit? This can't be undone. Use this for a full restart, not a partial cleanup."
            label="Clear all training"
            pendingLabel="Clearing…"
            className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
          />
        </div>
      )}
    </div>
  );
}

function WeekRow({
  href,
  positionLabel,
  week,
  info,
}: {
  href: string;
  positionLabel: string | null;
  week: string;
  info: PhaseViewWeekInfo | undefined;
}) {
  return (
    <Link
      href={href}
      className="block rounded-control border border-black/10 p-2 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
    >
      {positionLabel ? <span className="font-medium text-zinc-900 dark:text-white">{positionLabel}</span> : null}
      <span className={positionLabel ? "ml-2 text-zinc-500 dark:text-zinc-400" : "font-medium text-zinc-900 dark:text-white"}>
        {formatDate(week)}
      </span>
      {info?.label ? <span className="ml-2 text-zinc-600 dark:text-zinc-300">{info.label}</span> : null}
      {info?.targetVolumeMin != null ? (
        <span className="ml-2 text-zinc-500 dark:text-zinc-400">{formatTargetVolume(info)}</span>
      ) : null}
    </Link>
  );
}
