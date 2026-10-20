import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { loadPlanPayoffData } from "@/app/(app)/(protected)/coaching/your-plan/data";
import { PlanPayoffView } from "@/components/private-coaching/plan-payoff-view";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Preview: Your Plan",
  robots: { index: false, follow: false },
};

// The coach's read-only preview of exactly what their athlete will see
// on "Your Plan" (coaching/your-plan) -- same PlanPayoffView, same
// loadPlanPayoffData, just called with the coach's own session instead
// of the athlete's. The only behavioral difference is mode="coach-
// preview", which PlanPayoffView uses to swap live remedy forms for a
// plain note (a coach shouldn't be adding a race result or a goal race
// on the athlete's behalf from here) and to disable the first-action
// button -- every other section renders identically.
export default async function YourPlanPreviewPage({ params }: { params: Promise<{ athleteId: string }> }) {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) redirect("/coaching");

  const { athleteId } = await params;
  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("id")
    .eq("coach_id", session.userId)
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .maybeSingle();
  if (!relationship) redirect("/coaching");

  const today = new Date().toISOString().slice(0, 10);
  const data = await loadPlanPayoffData(supabase, athleteId, session.userId, today);

  return (
    <Container variant="dashboard">
      <BackLink href={`/coaching/athletes/${athleteId}/schedule`}>Back to schedule</BackLink>
      <Heading>Preview: Your Plan</Heading>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        This is exactly what your athlete sees on their own &ldquo;Your Plan&rdquo; page.
      </p>
      <div className="mt-6">
        <PlanPayoffView data={data} mode="coach-preview" />
      </div>
    </Container>
  );
}
