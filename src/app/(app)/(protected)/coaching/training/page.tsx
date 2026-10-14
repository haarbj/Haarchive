import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { formatDate } from "@/lib/format";
import { getAthleteGoalRace, weeksUntilGoalRace, formatWeeksAwayLabel } from "@/lib/private-coaching/goal-race";
import {
  buildRoadmapSections,
  phaseWeekCount,
  getPhaseTypeAccent,
  type TrainingPhase,
} from "@/lib/private-coaching/training-phases";
import { DAY_TYPE_BORDER_CLASSES } from "@/lib/private-coaching/day-type-visuals";
import { ATHLETE_GUIDES } from "@/lib/private-coaching/athlete-education";
import { mostRecentMonday } from "@/lib/week";
import { PhaseExplainer } from "@/components/private-coaching/phase-explainer";
import { BackLink } from "@/components/ui/back-link";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "My Training",
  robots: { index: false, follow: false },
};

type PhaseRow = {
  id: string;
  athlete_id: string;
  phase_type: string;
  name: string | null;
  start_date: string;
  end_date: string;
  goal_id: string | null;
  notes: string | null;
  explainer: string | null;
  source_program_id: string | null;
  source_program_phase_definition_id: string | null;
};

// The athlete's own read-only view of their training roadmap: which
// phases they're in, when each one runs, and why each one exists.
//
// Deliberately separate from the coach's Phase View
// (/coaching/athletes/[athleteId]/schedule?view=phase), which is a
// planning surface full of edit, assign, import and clear-all controls
// that an athlete must never see. The two share the phase math
// (buildRoadmapSections) and the explainer component, not the page.
//
// Gated on isCoachedAthlete, so a self-serve athlete or a coach with no
// training of their own lands back on /coaching rather than on an empty
// roadmap. RLS on training_phases independently scopes the query to this
// athlete's own rows.
export default async function AthleteTrainingPage() {
  const session = await getAppSession();
  if (!session?.isCoachedAthlete) redirect("/coaching");

  const supabase = await createClient();
  const [{ data: phaseRows }, goalRace] = await Promise.all([
    supabase
      .from("training_phases")
      .select(
        "id, athlete_id, phase_type, name, start_date, end_date, goal_id, notes, explainer, source_program_id, source_program_phase_definition_id",
      )
      .eq("athlete_id", session.userId)
      .order("start_date")
      .returns<PhaseRow[]>(),
    getAthleteGoalRace(supabase, session.userId),
  ]);

  const phases: TrainingPhase[] = (phaseRows ?? []).map((p) => ({
    id: p.id,
    athleteId: p.athlete_id,
    phaseType: p.phase_type,
    name: p.name,
    startDate: p.start_date,
    endDate: p.end_date,
    goalId: p.goal_id,
    notes: p.notes,
    explainer: p.explainer,
    sourceProgramId: p.source_program_id,
    sourceProgramPhaseDefinitionId: p.source_program_phase_definition_id,
  }));

  const today = new Date().toISOString().slice(0, 10);
  const sections = buildRoadmapSections(phases);

  return (
    <Container variant="dashboard">
      <BackLink href="/coaching">My Coaching</BackLink>
      <Heading>My Training</Heading>

      {goalRace ? (
        <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          {goalRace.raceName} on {formatDate(goalRace.goalDate)},{" "}
          {formatWeeksAwayLabel(weeksUntilGoalRace(mostRecentMonday(new Date()), goalRace.goalDate))}.
        </p>
      ) : null}

      {sections.length === 0 ? (
        <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          Your coach hasn&rsquo;t set up your training phases yet. Your scheduled workouts are on your coaching home in the
          meantime.
        </p>
      ) : (
        <div className="mt-8 space-y-6">
          {sections.map((section, i) =>
            section.kind === "phase" ? (
              <div
                key={section.phase.id}
                className={`border-l-4 pl-3 ${DAY_TYPE_BORDER_CLASSES[getPhaseTypeAccent(section.phase.phaseType)]}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold tracking-wide text-zinc-900 uppercase dark:text-white">
                    {section.phase.phaseType}
                    {section.phase.name ? ` — ${section.phase.name}` : ""}
                    {today >= section.phase.startDate && today <= section.phase.endDate ? (
                      <span className="ml-2 text-xs font-semibold text-accent-navy">Current</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDate(section.phase.startDate)} – {formatDate(section.phase.endDate)} ·{" "}
                    {phaseWeekCount(section.phase)} week{phaseWeekCount(section.phase) === 1 ? "" : "s"}
                  </p>
                </div>
                {section.phase.notes ? (
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">{section.phase.notes}</p>
                ) : null}
                <PhaseExplainer phaseType={section.phase.phaseType} explainer={section.phase.explainer} />
              </div>
            ) : (
              // A real gap your coach left between two phases. Named rather
              // than hidden, so a week that belongs to no phase doesn't look
              // like a bug in the roadmap.
              <div key={`unphased-${i}`}>
                <p className="text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                  Between phases
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {section.weeks.length} week{section.weeks.length === 1 ? "" : "s"} starting {formatDate(section.weeks[0])}
                </p>
              </div>
            ),
          )}
        </div>
      )}

      <div className="mt-12">
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
          Understanding your training
        </p>
        <div className="mt-3 space-y-2">
          {ATHLETE_GUIDES.map((guide) => (
            <Link key={guide.slug} href={`/coaching/learn/${guide.slug}`}>
              <Card padding="md" className="transition hover:border-black/20 dark:hover:border-white/20">
                <p className="font-medium text-zinc-900 dark:text-white">{guide.title}</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{guide.summary}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </Container>
  );
}
