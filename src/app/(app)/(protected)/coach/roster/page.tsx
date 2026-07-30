import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import { AddAthleteForm } from "./add-athlete-form";
import { RemoveAthleteButton } from "./remove-athlete-button";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Roster",
};

type Membership = { user_id: string };
type Profile = { id: string; display_name: string };

export default async function RosterPage() {
  const session = await getAppSession();
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("team_memberships")
    .select("user_id")
    .eq("team_id", session!.coachTeamId!)
    .eq("role", "athlete")
    .returns<Membership[]>();

  const athleteIds = memberships?.map((m) => m.user_id) ?? [];
  const { data: profiles } = athleteIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", athleteIds).returns<Profile[]>()
    : { data: [] as Profile[] };

  return (
    <Container variant="dashboard">
      <BackLink href="/coach">Coach</BackLink>
      <Heading>Roster</Heading>
      <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Athletes who&rsquo;ve signed up with an @brophybroncos.org email join automatically. Anyone else who
        already has an account can be added directly below.
      </p>

      <div className="mt-8">
        <AddAthleteForm />
      </div>

      <div className="mt-10">
        {profiles && profiles.length > 0 ? (
          <div className="space-y-2">
            {profiles.map((athlete) => (
              <div
                key={athlete.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-black/10 bg-white px-4 py-3 text-sm transition hover:border-black/20 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-white/20"
              >
                <Link href={`/coach/athletes/${athlete.id}`} className="font-medium text-zinc-900 dark:text-white">
                  {athlete.display_name}
                </Link>
                <RemoveAthleteButton athleteId={athlete.id} athleteName={athlete.display_name} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            No athletes have joined yet.
          </p>
        )}
      </div>
    </Container>
  );
}
