import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

type CoachProfile = {
  display_name: string;
  coach_display_name: string | null;
  coach_bio: string | null;
  coach_philosophy: string | null;
};

export async function generateMetadata(): Promise<Metadata> {
  const session = await getAppSession();
  if (!session?.isCoachedAthlete) return { title: "Coach Profile", robots: { index: false, follow: false } };

  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("coach_id")
    .eq("athlete_id", session.userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle<{ coach_id: string }>();
  if (!relationship) return { title: "Coach Profile", robots: { index: false, follow: false } };

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, coach_display_name")
    .eq("id", relationship.coach_id)
    .maybeSingle<{ display_name: string; coach_display_name: string | null }>();
  const name = profile?.coach_display_name || profile?.display_name || "Your Coach";
  return { title: name, robots: { index: false, follow: false } };
}

// Athlete-facing read view of the coach_bio/coach_philosophy a coach can
// set in Settings -- reuses profiles_select_as_coached_athlete's existing
// whole-row grant (see the migration's own comment), no new RLS needed.
// Coach-only pages already exist for the coach's OWN view of things; this
// is deliberately the one page an athlete, not a coach, reads.
export default async function CoachProfilePage() {
  const session = await getAppSession();
  if (!session?.isCoachedAthlete) redirect("/coaching");

  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("coach_id")
    .eq("athlete_id", session.userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle<{ coach_id: string }>();
  if (!relationship) redirect("/coaching");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, coach_display_name, coach_bio, coach_philosophy")
    .eq("id", relationship.coach_id)
    .maybeSingle<CoachProfile>();

  const name = profile?.coach_display_name || profile?.display_name || "Your Coach";

  return (
    <Container variant="narrow">
      <BackLink href="/coaching">My Coaching</BackLink>
      <Heading>{name}</Heading>
      {profile?.coach_bio ? (
        <p className="mt-3 text-lg leading-8 text-zinc-600 dark:text-zinc-300">{profile.coach_bio}</p>
      ) : null}

      <div className="mt-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
          Training Philosophy
        </p>
        {profile?.coach_philosophy ? (
          <Card padding="md" className="mt-3">
            <p className="text-sm leading-7 whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">
              {profile.coach_philosophy}
            </p>
          </Card>
        ) : (
          <div className="mt-3">
            <EmptyState>{name} hasn&rsquo;t added a training philosophy yet.</EmptyState>
          </div>
        )}
      </div>
    </Container>
  );
}
