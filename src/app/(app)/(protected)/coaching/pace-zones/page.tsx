import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { isAthleteCoachedByAdmin } from "@/lib/private-coaching/admin-coach-access";
import { getAthleteFitnessEstimates } from "@/lib/private-coaching/fitness-estimates";
import { getAthleteMostRecentRace, resolvePaceReference } from "@/lib/private-coaching/pace-reference";
import { formatDateSafe } from "@/lib/format";
import { MILE_METERS, metersFor } from "@/lib/race-distances";
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

  const [race, fitnessEstimates] = await Promise.all([
    getAthleteMostRecentRace(supabase, session.userId),
    getAthleteFitnessEstimates(supabase, session.userId),
  ]);

  // Prefer the athlete's own current fitness estimate over a race
  // prediction for the same basis -- it's the one canonical "current
  // fitness" number Your Paces (plan-payoff-view.tsx's PaceSection) treats
  // as the source of truth since scope 4, and it's live rather than tied
  // to whenever the last race happened. Falls back to the existing
  // race-based suggestion (resolvePaceReference) when no estimate is on
  // file for that basis -- that fallback already existed here and is
  // preserved as-is, not replaced.
  const suggestions: SuggestedReferencePace[] = [];
  for (const basis of ["5k", "marathon"] as const) {
    const estimate = fitnessEstimates[basis];
    if (estimate) {
      const minSPerMi = Math.round(estimate.estimatedTimeS / (metersFor(basis) / MILE_METERS));
      const updatedText = formatDateSafe(estimate.updatedAt);
      suggestions.push({
        basis,
        paceText: formatClock(minSPerMi),
        sourceLabel: `your fitness estimate${updatedText ? ` (updated ${updatedText})` : ""}`,
        kind: "estimate",
      });
      continue;
    }
    const resolved = race ? resolvePaceReference(basis, race) : null;
    if (resolved) {
      suggestions.push({ basis, paceText: formatClock(resolved.minSPerMi), sourceLabel: resolved.sourceLabel });
    }
  }

  const hasAnyEstimate = Object.keys(fitnessEstimates).length > 0;

  return (
    <Container variant="dashboard">
      <BackLink href="/coaching">My Coaching</BackLink>
      <Heading>Pace Zone Table</Heading>
      <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Enter your current 5K or marathon pace to build a table of named effort zones as a percentage of that pace
        -- and, if you train at altitude, see the equivalent paces to actually run there.
      </p>
      {/* Deep-links to the one real edit home (Your Paces' "Your current
          fitness estimate" block, scope 4) rather than building a second
          editor here -- see this page's own suggestions above, which
          already read that same estimate when one exists. */}
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        {hasAnyEstimate ? (
          <>
            The suggestion below is your current fitness estimate.{" "}
            <Link
              href="/coaching/your-plan#your-paces"
              className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
            >
              Update your estimate
            </Link>
            .
          </>
        ) : (
          <>
            You haven&rsquo;t set a fitness estimate yet.{" "}
            <Link
              href="/coaching/your-plan#your-paces"
              className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
            >
              Add one on Your Paces
            </Link>{" "}
            to auto-fill this table.
          </>
        )}
      </p>
      <AthletePaceZoneTable suggestions={suggestions} />
    </Container>
  );
}
