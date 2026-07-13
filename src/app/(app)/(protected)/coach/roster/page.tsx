import type { Metadata } from "next";

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import { BackLink } from "@/components/back-link";
import { Container } from "@/components/ui/container";
import { ListRow } from "@/components/ui/list-row";
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
    .eq("team_id", session!.teamId!)
    .eq("role", "athlete")
    .returns<Membership[]>();

  const athleteIds = memberships?.map((m) => m.user_id) ?? [];
  const { data: profiles } = athleteIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", athleteIds).returns<Profile[]>()
    : { data: [] as Profile[] };

  return (
    <Container variant="dashboard">
      <BackLink href="/coach" label="Coach" />
      <Heading className="mt-4">Roster</Heading>
      <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Athletes who&rsquo;ve signed up with an @brophybroncos.org email join automatically.
      </p>

      <div className="mt-10">
        {profiles && profiles.length > 0 ? (
          <div className="space-y-2">
            {profiles.map((athlete) => (
              <ListRow key={athlete.id} href={`/coach/athletes/${athlete.id}`} className="font-medium text-zinc-900 dark:text-white">
                {athlete.display_name}
              </ListRow>
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
