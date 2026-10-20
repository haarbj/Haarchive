import Link from "next/link";
import type { ReactNode } from "react";

import { formatDate } from "@/lib/format";
import { formatRaceCountdown, raceCountdown, firstActionLabel, HOW_THIS_WORKS } from "@/lib/private-coaching/plan-payoff";
import type { PlanPayoffData } from "@/app/(app)/(protected)/coaching/your-plan/data";
import { getDayTypeAccent, abbreviateDayLabel } from "@/lib/private-coaching/day-type-visuals";
import { getWorkoutDisplayLabel } from "@/lib/private-coaching/workout-status";
import { buildTimelineTileFigures } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/timeline-helpers";
import { TimelineTile } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/timeline-view";
import { RaceResultsSection, type RaceResultRow } from "@/app/(app)/(protected)/settings/race-results-section";
import { Button } from "@/components/ui/button";
import { AddGoalRaceForm } from "./add-goal-race-form";

// The one component behind both the athlete's real "Your Plan" payoff
// (coaching/your-plan) and the coach's preview of it
// (coaching/athletes/[athleteId]/your-plan-preview) -- a pure render of
// already-resolved data, so "what the coach previews is what the athlete
// gets" is true by construction rather than by two components being kept
// in sync by hand. Nothing in here fetches anything or resolves a pace;
// every value arrives through `data` (plan-payoff/data.ts's
// loadPlanPayoffData), which is itself just arranging values the rest of
// the platform already resolves.
export function PlanPayoffView({
  data,
  mode,
  existingRaceResults = [],
  onDismiss,
}: {
  data: PlanPayoffData;
  /** "athlete": the real view, with working remedies. "coach-preview": read-only, remedies replaced with a plain note instead of a live form the coach shouldn't be filling in on the athlete's behalf. */
  mode: "athlete" | "coach-preview";
  /** Only meaningful in "athlete" mode -- the quick-add race-result form needs the athlete's own existing results to render correctly (and to not look like it's hiding any). */
  existingRaceResults?: RaceResultRow[];
  /** Only rendered in "athlete" mode. */
  onDismiss?: ReactNode;
}) {
  const isPreview = mode === "coach-preview";

  return (
    <div className="space-y-10">
      {isPreview ? (
        <p className="text-xs font-semibold tracking-[0.2em] text-accent-tip uppercase">Coach preview -- read-only</p>
      ) : null}

      <GoalRaceHeader data={data} isPreview={isPreview} />

      <ProgramSection data={data} />

      <PaceSection data={data} isPreview={isPreview} existingRaceResults={existingRaceResults} />

      <FirstWeekSection data={data} />

      <HowThisWorksSection />

      <FirstActionSection data={data} isPreview={isPreview} />

      {!isPreview && onDismiss ? onDismiss : null}
    </div>
  );
}

function GoalRaceHeader({ data, isPreview }: { data: PlanPayoffData; isPreview: boolean }) {
  if (!data.goalRace) {
    return (
      <section>
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Goal race</p>
        <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-300">No goal race set yet.</p>
        {isPreview ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Your athlete will see a form here to add their race name and date.
          </p>
        ) : (
          <AddGoalRaceForm />
        )}
      </section>
    );
  }

  const countdown = raceCountdown(data.today, data.goalRace.goalDate);

  return (
    <section>
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Goal race</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
        {data.goalRace.raceName} — {formatRaceCountdown(countdown)}
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{formatDate(data.goalRace.goalDate)}</p>
    </section>
  );
}

function ProgramSection({ data }: { data: PlanPayoffData }) {
  if (!data.program) {
    return (
      <section>
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Your program</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          No training phases are set up yet -- once your coach assigns a program, it shows up here.
        </p>
      </section>
    );
  }

  return (
    <section>
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Your program</p>
      <h3 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-white">
        {data.program.name} · {data.program.totalWeeks} week{data.program.totalWeeks === 1 ? "" : "s"}
      </h3>

      {!data.programPublished ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Your coach has set up this program, but hasn&rsquo;t published this week&rsquo;s workouts yet -- check back soon.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {data.phaseStrip.map((phase) => (
          <Link
            key={phase.id}
            href="/coaching/training"
            className={`max-w-xs rounded-control border px-3 py-2 text-left transition hover:border-black/20 dark:hover:border-white/20 ${
              phase.isCurrent ? "border-accent-navy/40 bg-accent-navy/5" : "border-black/10 dark:border-white/10"
            }`}
          >
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
              {phase.phaseType}
              {phase.name ? ` — ${phase.name}` : ""}
              {phase.isCurrent ? <span className="ml-1.5 text-xs font-semibold text-accent-navy">Current</span> : null}
            </p>
            {phase.purpose ? <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{phase.purpose}</p> : null}
          </Link>
        ))}
      </div>
    </section>
  );
}

function PaceSection({
  data,
  isPreview,
  existingRaceResults,
}: {
  data: PlanPayoffData;
  isPreview: boolean;
  existingRaceResults: RaceResultRow[];
}) {
  return (
    <section>
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Your paces</p>

      {!data.hasFitnessAnchor ? (
        <>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Your paces are set relative to a recent race result or fitness estimate -- add one and they&rsquo;ll show up here right
            away.
          </p>
          {isPreview ? (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Your athlete will see a quick race-result form here.
            </p>
          ) : (
            <div className="mt-3">
              <RaceResultsSection results={existingRaceResults} />
            </div>
          )}
        </>
      ) : data.paceRows && data.paceRows.length > 0 ? (
        <div className="mt-3 space-y-2">
          {data.paceRows.map((row) => (
            <div key={row.key} className="rounded-control border border-black/10 p-3 dark:border-white/10">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">{row.label}</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-200">{row.rangeText}</p>
              </div>
              {row.why ? <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{row.why}</p> : null}
              {row.sourceLabel ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{row.sourceLabel}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          This week&rsquo;s workouts don&rsquo;t prescribe a named pace -- check your schedule for exact targets.
        </p>
      )}
    </section>
  );
}

function FirstWeekSection({ data }: { data: PlanPayoffData }) {
  return (
    <section>
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Your first week</p>
      {data.weekWorkouts.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Nothing&rsquo;s published for this week yet.</p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {data.weekWorkouts.map((workout) => {
            const figures = buildTimelineTileFigures(workout);
            return (
              <TimelineTile
                key={workout.id}
                entry={{
                  id: workout.id,
                  accent: getDayTypeAccent(workout.dayLabel),
                  statusTone: workout.status,
                  sessionSlot: workout.sessionSlot,
                  label: abbreviateDayLabel(getWorkoutDisplayLabel(workout.dayLabel, workout.title)),
                  distanceText: figures.distanceText,
                  durationText: figures.durationText,
                  effortText: figures.effortText,
                  feedbackText: figures.feedbackText,
                  hasNotes: figures.hasNotes,
                  emphasize: figures.emphasize,
                  kind: "link",
                  href: `/coaching/workouts/${workout.id}`,
                }}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function HowThisWorksSection() {
  return (
    <section>
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">How this works</p>
      <div className="mt-3 space-y-3">
        {HOW_THIS_WORKS.map((item) => (
          <div key={item.title}>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{item.title}</p>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-300">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FirstActionSection({ data, isPreview }: { data: PlanPayoffData; isPreview: boolean }) {
  return (
    <section>
      {isPreview ? (
        <Button type="button" disabled>
          {firstActionLabel(data.firstAction)}
        </Button>
      ) : (
        <Button href={data.firstAction.href}>{firstActionLabel(data.firstAction)}</Button>
      )}
    </section>
  );
}
