import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/db/server";
import { formatDate } from "@/lib/format";
import { getAppSession } from "@/lib/auth/session";

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
    <section className="mx-auto w-full max-w-3xl px-6 py-16 animate-fade-in">
      <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">Coach</h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Build a season once, then generate individualized plans for your roster from it.
      </p>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/coach/seasons/new"
          className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Generate a season
        </Link>
        <Link
          href="/coach/roster"
          className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
        >
          View roster
        </Link>
      </div>

      <div className="mt-10">
        <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
          Seasons
        </p>
        {seasons && seasons.length > 0 ? (
          <div className="mt-3 space-y-2">
            {seasons.map((season) => (
              <Link
                key={season.id}
                href={`/coach/seasons/${season.id}`}
                className="block rounded-xl border border-black/10 bg-white px-4 py-3 text-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-zinc-900"
              >
                <span className="font-medium text-zinc-900 dark:text-white">{season.name}</span>
                <span className="ml-2 text-zinc-600 dark:text-zinc-300">
                  {season.goal_race_name} · {formatDate(season.goal_race_date)}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            No seasons yet — generate one to get started.
          </p>
        )}
      </div>
    </section>
  );
}
