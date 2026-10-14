import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { isAthleteCoachedByAdmin } from "@/lib/private-coaching/admin-coach-access";
import { getAthleteMostRecentRace, resolvePaceReference } from "@/lib/private-coaching/pace-reference";
import { formatClock } from "@/lib/running-format";
import { AthletePaceZoneTable, type SuggestedReferencePace } from "@/components/private-coaching/athlete-pace-zone-table";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Pace Zone Table",
  robots: { index: false, follow: false },
};

export default async function CoachingPaceZonesPage() {
  const session = await getAppSession();
  if (!session?.isCoachedAthlete) redirect("/coaching");

  const supabase = await createClient();
  if (!(await isAthleteCoachedByAdmin(supabase, session.userId))) redirect("/coaching");

  const race = await getAthleteMostRecentRace(supabase, session.userId);

  const suggestions: SuggestedReferencePace[] = [];
  for (const basis of ["5k", "marathon"] as const) {
    const resolved = race ? resolvePaceReference(basis, race) : null;
    if (resolved) {
      suggestions.push({ basis, paceText: formatClock(resolved.minSPerMi), sourceLabel: resolved.sourceLabel });
    }
  }

  return (
    <Container variant="dashboard">
      <BackLink href="/coaching">My Coaching</BackLink>
      <Heading>Pace Zone Table</Heading>
      <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Enter your current 5K or marathon pace to build a table of named effort zones as a percentage of that pace
        -- and, if you train at altitude, see the equivalent paces to actually run there.
      </p>
      <AthletePaceZoneTable suggestions={suggestions} />
    </Container>
  );
}
