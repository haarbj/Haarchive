import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/db/server";
import { PlanView } from "@/app/(app)/(protected)/plan/plan-view";
import { BackLink } from "@/components/back-link";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Athlete",
};

type AthleteDetailPageProps = {
  params: Promise<{ athleteId: string }>;
};

export default async function AthleteDetailPage({ params }: AthleteDetailPageProps) {
  const { athleteId } = await params;
  const supabase = await createClient();

  // profiles_select_team_coach (coaches_athlete RLS) scopes this to only
  // athletes on the coach's own team -- a non-teammate id simply returns no
  // row here, which we treat as "doesn't exist" rather than leaking whether
  // some other team's athlete id is valid.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", athleteId)
    .maybeSingle();
  if (!profile) notFound();

  return (
    <Container variant="dashboard">
      <BackLink href="/coach/roster" label="Roster" />
      <p className="mt-4 text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
        Coaching view
      </p>
      <div className="mt-1">
        <PlanView userId={profile.id} coachView />
      </div>
    </Container>
  );
}
