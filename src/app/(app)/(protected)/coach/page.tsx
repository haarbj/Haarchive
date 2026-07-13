import type { Metadata } from "next";

import { createClient } from "@/lib/db/server";
import { formatDate } from "@/lib/format";
import { getAppSession } from "@/lib/auth/session";
import { CardLink } from "@/components/ui/card-link";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Coach",
};

type SeasonPlan = {
  id: string;
  name: string;
  goal_race_name: string;
  goal_race_date: string;
  status: string;
};

export default async function CoachPage() {
  const session = await getAppSession();
  const supabase = await createClient();

  const { data: seasons } = await supabase
    .from("season_plans")
    .select("id, name, goal_race_name, goal_race_date, status")
    .eq("team_id", session!.teamId!)
    .order("created_at", { ascending: false })
    .returns<SeasonPlan[]>();

  return (
    <Container variant="dashboard">
      <Heading>Coach</Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Build a season once, then generate individualized plans for your roster from it.
      </p>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button href="/coach/seasons/new" size="lg">
          Generate a season
        </Button>
        <Button href="/coach/roster" variant="outline" size="lg">
          View roster
        </Button>
        <Button href="/coach/groups" variant="outline" size="lg">
          Groups
        </Button>
      </div>

      <div className="mt-10">
        <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
          Seasons
        </p>
        {seasons && seasons.length > 0 ? (
          <div className="mt-3 space-y-2">
            {seasons.map((season) => (
              <CardLink key={season.id} href={`/coach/seasons/${season.id}`} padding="sm" className="block text-sm">
                <span className="font-medium text-zinc-900 dark:text-white">{season.name}</span>
                <span className="ml-2 text-zinc-600 dark:text-zinc-300">
                  {season.goal_race_name} · {formatDate(season.goal_race_date)}
                </span>
              </CardLink>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            No seasons yet — generate one to get started.
          </p>
        )}
      </div>
    </Container>
  );
}
