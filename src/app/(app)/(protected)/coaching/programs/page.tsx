import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Programs",
  robots: { index: false, follow: false },
};

type ProgramRow = {
  id: string;
  name: string;
  description: string | null;
  scales_distance_with_mileage: boolean;
  scales_duration_with_mileage: boolean;
};
type PhaseDefRow = { id: string; program_id: string; phase_key: string; name: string | null; duration_weeks_min: number };
type VariantRow = { id: string; program_id: string; name: string };
type DayWeekRow = { phase_definition_id: string; week_number: number };

// A coach's reusable Program library -- a Program itself is entirely
// methodology-agnostic data (see training_programs' own migration comment);
// nothing about phase names, duration, or scaling behavior is assumed here,
// only read from what each program actually has configured.
export default async function ProgramsPage() {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) redirect("/coaching");

  const supabase = await createClient();
  const { data: programs } = await supabase
    .from("training_programs")
    .select("id, name, description, scales_distance_with_mileage, scales_duration_with_mileage")
    .eq("coach_id", session.userId)
    .order("name")
    .returns<ProgramRow[]>();

  const programIds = (programs ?? []).map((p) => p.id);
  const [{ data: phaseDefRows }, { data: variantRows }, { data: dayWeekRows }] = await Promise.all([
    programIds.length
      ? supabase
          .from("program_phase_definitions")
          .select("id, program_id, phase_key, name, duration_weeks_min")
          .in("program_id", programIds)
          .order("position")
          .returns<PhaseDefRow[]>()
      : Promise.resolve({ data: [] as PhaseDefRow[] }),
    programIds.length
      ? supabase.from("program_duration_variants").select("id, program_id, name").in("program_id", programIds).returns<VariantRow[]>()
      : Promise.resolve({ data: [] as VariantRow[] }),
    programIds.length
      ? supabase.from("program_days").select("phase_definition_id, week_number").returns<DayWeekRow[]>()
      : Promise.resolve({ data: [] as DayWeekRow[] }),
  ]);

  const phaseDefsByProgram = new Map<string, PhaseDefRow[]>();
  for (const row of phaseDefRows ?? []) {
    const list = phaseDefsByProgram.get(row.program_id) ?? [];
    list.push(row);
    phaseDefsByProgram.set(row.program_id, list);
  }
  const variantsByProgram = new Map<string, VariantRow[]>();
  for (const row of variantRows ?? []) {
    const list = variantsByProgram.get(row.program_id) ?? [];
    list.push(row);
    variantsByProgram.set(row.program_id, list);
  }
  // Distinct authored week numbers per phase definition -- the input to
  // this card's own "X/Y weeks have workouts" completeness indicator.
  const weeksWithContentByPhase = new Map<string, Set<number>>();
  for (const row of dayWeekRows ?? []) {
    const set = weeksWithContentByPhase.get(row.phase_definition_id) ?? new Set<number>();
    set.add(row.week_number);
    weeksWithContentByPhase.set(row.phase_definition_id, set);
  }

  return (
    <Container variant="content">
      <BackLink href="/coaching">Coaching</BackLink>
      <Heading>Programs</Heading>
      <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Your reusable training methodologies -- an ordered set of phases, each with its own week-by-week content, that you
        can assign to any athlete in one or more plan lengths.
      </p>

      <div className="mt-8">
        <Button href="/coaching/programs/new">New program</Button>
      </div>

      <div className="mt-8">
        {programs && programs.length > 0 ? (
          <div className="space-y-3">
            {programs.map((program) => {
              const phaseDefs = phaseDefsByProgram.get(program.id) ?? [];
              const variants = variantsByProgram.get(program.id) ?? [];
              const scalingText = [
                program.scales_distance_with_mileage ? "scales distance" : null,
                program.scales_duration_with_mileage ? "scales duration" : null,
              ]
                .filter(Boolean)
                .join(" & ");
              return (
                <Card key={program.id} padding="md">
                  <Link href={`/coaching/programs/${program.id}`} className="font-semibold text-zinc-900 hover:underline dark:text-white">
                    {program.name}
                  </Link>
                  {program.description ? (
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{program.description}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {phaseDefs.length} phase{phaseDefs.length === 1 ? "" : "s"} · {variants.length} plan length
                    {variants.length === 1 ? "" : "s"}
                    {scalingText ? ` · ${scalingText}` : ""}
                  </p>
                  {phaseDefs.length > 0 ? (
                    <ul className="mt-2 space-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {phaseDefs.map((phase) => {
                        const weeksWithContent = weeksWithContentByPhase.get(phase.id)?.size ?? 0;
                        const isComplete = weeksWithContent >= phase.duration_weeks_min;
                        return (
                          <li key={phase.id} className={isComplete ? undefined : "text-amber-600 dark:text-amber-400"}>
                            {phase.name ?? phase.phase_key}: {weeksWithContent}/{phase.duration_weeks_min} week
                            {phase.duration_weeks_min === 1 ? "" : "s"} have workouts
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">No phases configured yet.</p>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState>No programs yet -- create one to model your own training methodology as reusable data.</EmptyState>
        )}
      </div>
    </Container>
  );
}
