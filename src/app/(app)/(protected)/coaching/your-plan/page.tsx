import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { getActiveCoachRelationship } from "@/lib/private-coaching/athlete-coach";
import { resolveViewAsState } from "@/lib/private-coaching/view-as";
import { loadPlanPayoffData } from "./data";
import { PlanPayoffView } from "@/components/private-coaching/plan-payoff-view";
import { ViewAsBanner } from "@/components/private-coaching/view-as-banner";
import { DismissPayoffButton } from "./dismiss-payoff-button";
import type { RaceResultRow } from "@/app/(app)/(protected)/settings/race-results-section";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Your Plan",
  robots: { index: false, follow: false },
};

// A real, deep-linkable route (the program_assigned notification points
// here -- notification-href.ts), shown automatically exactly once (see
// coaching/page.tsx's AthleteHomeSection for the one-time redirect, and
// dismiss-payoff-button.tsx/actions.ts for how dismissal persists) and
// reachable afterward from the athlete's own coaching home. This page
// does nothing but load real data and hand it to PlanPayoffView -- the
// same component the coach's preview route renders, so there's exactly
// one place that decides what this view looks like.
export default async function YourPlanPage() {
  const session = await getAppSession();
  if (!session) redirect("/coaching");

  const supabase = await createClient();
  // View-as lets a coach reach this exact real route for a target
  // athlete, read-only -- same mechanism and same mode="coach-preview"
  // the dedicated your-plan-preview route already uses, just reachable
  // from the real URL the athlete themselves would see while the mode is
  // active. Falls back to the ordinary self-view for a non-coach, or a
  // coach with no (or an invalidated) view-as mode.
  const viewAs = session.isPrivateCoach ? await resolveViewAsState(supabase, session.userId) : null;
  if (!viewAs && !session.isCoachedAthlete) redirect("/coaching");

  const effectiveAthleteId = viewAs?.athleteId ?? session.userId;
  const relationship = await getActiveCoachRelationship(supabase, effectiveAthleteId);
  if (!relationship) redirect("/coaching");

  const today = new Date().toISOString().slice(0, 10);
  const [data, { data: raceResultRows }, { data: athleteProfile }] = await Promise.all([
    loadPlanPayoffData(supabase, effectiveAthleteId, relationship.coachId, today),
    supabase
      .from("race_results")
      .select("id, race_name, race_date, distance_m, finish_time_s, course_type")
      .eq("user_id", effectiveAthleteId)
      .order("race_date", { ascending: false })
      .returns<RaceResultRow[]>(),
    viewAs
      ? supabase.from("profiles").select("display_name").eq("id", effectiveAthleteId).maybeSingle<{ display_name: string }>()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <Container variant="dashboard">
      <BackLink href="/coaching">My Coaching</BackLink>
      {viewAs ? <ViewAsBanner athleteName={athleteProfile?.display_name ?? "this athlete"} /> : null}
      <Heading>Your Plan</Heading>
      <div className="mt-6">
        <PlanPayoffView
          data={data}
          mode={viewAs ? "coach-preview" : "athlete"}
          existingRaceResults={raceResultRows ?? []}
          onDismiss={viewAs ? undefined : <DismissPayoffButton />}
        />
      </div>
    </Container>
  );
}
