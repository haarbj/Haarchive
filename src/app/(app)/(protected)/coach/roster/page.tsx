import type { Metadata } from "next";

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";

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
    <section className="mx-auto w-full max-w-2xl px-6 py-16 animate-fade-in">
      <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">Roster</h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Athletes who&rsquo;ve signed up with an @brophybroncos.org email join automatically.
      </p>

      <div className="mt-10">
        {profiles && profiles.length > 0 ? (
          <div className="space-y-2">
            {profiles.map((athlete) => (
              <div
                key={athlete.id}
                className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-medium text-zinc-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
              >
                {athlete.display_name}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            No athletes have joined yet.
          </p>
        )}
      </div>
    </section>
  );
}
