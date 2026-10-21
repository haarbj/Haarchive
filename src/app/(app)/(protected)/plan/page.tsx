import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { resolveViewAsState } from "@/lib/private-coaching/view-as";
import { PlanView } from "./plan-view";
import { ViewAsBanner } from "@/components/private-coaching/view-as-banner";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Training Plan",
};

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const session = await getAppSession();
  if (!session) redirect("/login");

  const supabase = await createClient();
  const viewAs = session.isPrivateCoach ? await resolveViewAsState(supabase, session.userId) : null;
  const effectiveUserId = viewAs?.athleteId ?? session.userId;

  const sp = await searchParams;
  // Timeline's own data loader (timeline-actions.ts's loadAthleteTimelineWeeks)
  // always reads the CALLING session, not a parameterizable athleteId --
  // threading view-as through it would mean changing that action's
  // signature and its client-side call sites, real surgery this task
  // explicitly allows deferring rather than forcing. Week stays fully
  // correct in view-as; Timeline simply isn't offered while the mode is
  // active, rather than silently rendering the coach's own timeline
  // mislabeled as the athlete's.
  const view = sp.view === "timeline" && !viewAs ? "timeline" : "week";

  let athleteName: string | null = null;
  if (viewAs) {
    const { data } = await supabase.from("profiles").select("display_name").eq("id", viewAs.athleteId).maybeSingle<{ display_name: string }>();
    athleteName = data?.display_name ?? "this athlete";
  }

  return (
    <Container variant="dashboard">
      {viewAs ? <ViewAsBanner athleteName={athleteName!} /> : null}
      <PlanView userId={effectiveUserId} view={view} readOnly={!!viewAs} />
    </Container>
  );
}
