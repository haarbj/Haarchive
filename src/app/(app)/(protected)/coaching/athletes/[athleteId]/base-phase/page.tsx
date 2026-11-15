import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { loadBasePhaseDefaults } from "./actions";
import { BasePhaseGeneratorForm } from "./base-phase-generator-form";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Base Phase Generator",
  robots: { index: false, follow: false },
};

export default async function BasePhaseGeneratorPage({ params }: { params: Promise<{ athleteId: string }> }) {
  const { athleteId } = await params;
  const session = await getAppSession();
  if (!session?.isPrivateCoach) redirect("/coaching");

  const loaded = await loadBasePhaseDefaults(athleteId);
  if (loaded.error || !loaded.defaults) {
    return (
      <Container variant="content">
        <BackLink href={`/coaching/athletes/${athleteId}`}>Athlete</BackLink>
        <Heading>Base phase generator</Heading>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">{loaded.error ?? "Athlete not found."}</p>
      </Container>
    );
  }

  return (
    <Container variant="content">
      <BackLink href={`/coaching/athletes/${athleteId}`}>{loaded.defaults.athleteName}</BackLink>
      <Heading>Base phase generator</Heading>
      <p className="mt-4 max-w-xl text-sm text-zinc-600 dark:text-zinc-300">
        Builds {loaded.defaults.athleteName} from their current weekly mileage up to a plan&rsquo;s starting mileage,
        week by week. Review and adjust everything before anything is added to their schedule.
      </p>
      <div className="mt-8">
        <BasePhaseGeneratorForm athleteId={athleteId} defaults={loaded.defaults} />
      </div>
    </Container>
  );
}
