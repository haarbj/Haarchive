import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { ProgramForm, type ExistingProgram } from "../../program-form";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type ProgramRow = {
  id: string;
  name: string;
  description: string | null;
  scales_distance_with_mileage: boolean;
  scales_duration_with_mileage: boolean;
  initial_mileage_min: number | null;
  initial_mileage_max: number | null;
  peak_mileage_min: number | null;
  peak_mileage_max: number | null;
  typical_goal_times: string | null;
  recommended_for: string | null;
  glossary_terms: string[] | null;
};

export default async function EditProgramPage({ params }: { params: Promise<{ programId: string }> }) {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) redirect("/coaching");
  const { programId } = await params;

  const supabase = await createClient();
  const { data: program } = await supabase
    .from("training_programs")
    .select(
      "id, name, description, scales_distance_with_mileage, scales_duration_with_mileage, initial_mileage_min, initial_mileage_max, peak_mileage_min, peak_mileage_max, typical_goal_times, recommended_for, glossary_terms",
    )
    .eq("id", programId)
    .eq("coach_id", session.userId)
    .maybeSingle<ProgramRow>();
  if (!program) notFound();

  return (
    <Container variant="content">
      <BackLink href={`/coaching/programs/${program.id}`}>{program.name}</BackLink>
      <Heading>Edit Program</Heading>
      <div className="mt-8">
        <ProgramForm
          existing={
            {
              id: program.id,
              name: program.name,
              description: program.description,
              scalesDistanceWithMileage: program.scales_distance_with_mileage,
              scalesDurationWithMileage: program.scales_duration_with_mileage,
              initialMileageMin: program.initial_mileage_min,
              initialMileageMax: program.initial_mileage_max,
              peakMileageMin: program.peak_mileage_min,
              peakMileageMax: program.peak_mileage_max,
              typicalGoalTimes: program.typical_goal_times,
              recommendedFor: program.recommended_for,
              glossaryTerms: program.glossary_terms ?? [],
            } satisfies ExistingProgram
          }
        />
      </div>
    </Container>
  );
}
