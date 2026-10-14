import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { formatDate } from "@/lib/format";
import { addDays } from "@/lib/coaching-engine";
import { ATHLETE_LEVEL_LABELS, type ATHLETE_LEVELS } from "@/lib/validation/athlete-profile";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Profile = { id: string; display_name: string };
type AthleteProfile = {
  birth_year: number | null;
  sex: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  years_running: number | null;
  current_level: (typeof ATHLETE_LEVELS)[number] | null;
  current_weekly_mileage: number | null;
  primary_event: string | null;
};
type Goal = { id: string; race_name: string; distance_m: number; goal_time_s: number | null; goal_date: string | null; status: string };
type RaceResult = { id: string; race_name: string; race_date: string; distance_m: number; finish_time_s: number };
type Injury = { id: string; injury_type: string; body_part: string; start_date: string; end_date: string | null; severity: string; affects_training: boolean };
type Checkin = {
  week_start: string;
  overall_feel: number | null;
  fatigue: number;
  soreness: number;
  sleep_quality: number;
  stress: number;
  pain: boolean;
  pain_notes: string | null;
  biggest_positive: string | null;
  biggest_concern: string | null;
  schedule_constraints: string | null;
  notes: string | null;
};

function metersToLabel(m: number): string {
  const miles = m / 1609.344;
  if (Math.abs(miles - Math.round(miles)) < 0.02) return `${Math.round(miles)}mi`;
  return `${miles.toFixed(1)}mi`;
}

function secondsToClock(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default async function CoachingAthleteDetailPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) redirect("/coaching");
  const { athleteId } = await params;

  const supabase = await createClient();

  // profiles_select_private_coach / *_select_private_coach RLS scopes every
  // one of these to only athleteId's rows if -- and only if -- session's
  // caller actually, actively coaches them (coaches_this_athlete()). An
  // athleteId that isn't yours simply comes back empty across the board.
  const [{ data: profile }, { data: athleteProfile }, { data: goals }, { data: raceResults }, { data: injuries }, { data: everPublished }] =
    await Promise.all([
      supabase.from("profiles").select("id, display_name").eq("id", athleteId).maybeSingle<Profile>(),
      supabase
        .from("athlete_profiles")
        .select("birth_year, sex, weight_kg, height_cm, years_running, current_level, current_weekly_mileage, primary_event")
        .eq("user_id", athleteId)
        .maybeSingle<AthleteProfile>(),
      supabase
        .from("goals")
        .select("id, race_name, distance_m, goal_time_s, goal_date, status")
        .eq("user_id", athleteId)
        .eq("status", "active")
        .order("goal_date", { ascending: true })
        .returns<Goal[]>(),
      supabase
        .from("race_results")
        .select("id, race_name, race_date, distance_m, finish_time_s")
        .eq("user_id", athleteId)
        .order("race_date", { ascending: false })
        .limit(5)
        .returns<RaceResult[]>(),
      supabase
        .from("injuries")
        .select("id, injury_type, body_part, start_date, end_date, severity, affects_training")
        .eq("user_id", athleteId)
        .is("end_date", null)
        .returns<Injury[]>(),
      // Same "has this athlete ever received training" signal the
      // athlete's own coaching home uses (see GettingStarted in
      // /coaching/page.tsx) -- the coach-side mirror of that state, not a
      // second, independently-derived one.
      supabase.from("scheduled_workouts").select("id").eq("athlete_id", athleteId).not("published_at", "is", null).limit(1).maybeSingle(),
    ]);

  // weekly_checkins_select_private_coach RLS -- the most recent row
  // regardless of week, not scoped to "this week" the way the athlete's
  // own submission page is: a coach reviewing between check-ins should
  // still see the last one, not nothing.
  const { data: checkin } = await supabase
    .from("weekly_checkins")
    .select("week_start, overall_feel, fatigue, soreness, sleep_quality, stress, pain, pain_notes, biggest_positive, biggest_concern, schedule_constraints, notes")
    .eq("user_id", athleteId)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle<Checkin>();

  if (!profile) notFound();

  const currentYear = new Date().getFullYear();

  return (
    <Container variant="content">
      <BackLink href="/coaching/roster">Roster</BackLink>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading>{profile.display_name}</Heading>
      </div>
      <div className="mt-2">
        <Button href={`/coaching/athletes/${athleteId}/schedule`} size="sm">
          View schedule
        </Button>
      </div>

      {!everPublished ? (
        <div className="mt-6 rounded-control border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Getting started</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            {`${profile.display_name} hasn’t received their first workout yet -- they see a “waiting on training” screen until you publish one.`}
          </p>
          <div className="mt-3">
            <Button href={`/coaching/athletes/${athleteId}/schedule`} size="sm" variant="outline">
              Create first workout
            </Button>
          </div>
        </div>
      ) : null}

      {injuries && injuries.length > 0 ? (
        <div className="mt-6 rounded-control border border-amber-600/30 bg-amber-500/5 p-4 text-sm text-amber-800 dark:border-amber-400/30 dark:text-amber-300">
          <p className="font-semibold">
            {injuries.length === 1 ? "Active injury reported" : `${injuries.length} active injuries reported`}
          </p>
          <ul className="mt-1 space-y-0.5">
            {injuries.map((injury) => (
              <li key={injury.id}>
                {injury.body_part} -- {injury.injury_type} ({injury.severity}
                {injury.affects_training ? ", affecting training" : ""})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Latest Check-in</p>
        {checkin ? (
          <Card padding="md" className="mt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-zinc-900 dark:text-white">
                Week of {formatDate(checkin.week_start)} – {formatDate(addDays(checkin.week_start, 6))}
              </p>
              {checkin.pain ? <span className="text-xs font-semibold text-red-600 dark:text-red-400">Pain reported</span> : null}
            </div>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Feel {checkin.overall_feel ?? "--"}/5 · Fatigue {checkin.fatigue}/5 · Soreness {checkin.soreness}/5 · Sleep{" "}
              {checkin.sleep_quality}/5 · Stress {checkin.stress}/5
            </p>
            {checkin.pain_notes ? <p className="mt-1 text-sm text-red-700 dark:text-red-400">{checkin.pain_notes}</p> : null}
            {checkin.biggest_positive ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                <span className="font-medium text-zinc-900 dark:text-white">Positive: </span>
                {checkin.biggest_positive}
              </p>
            ) : null}
            {checkin.biggest_concern ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                <span className="font-medium text-zinc-900 dark:text-white">Concern: </span>
                {checkin.biggest_concern}
              </p>
            ) : null}
            {checkin.schedule_constraints ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                <span className="font-medium text-zinc-900 dark:text-white">Schedule: </span>
                {checkin.schedule_constraints}
              </p>
            ) : null}
            {checkin.notes ? <p className="mt-1 text-sm italic text-zinc-500 dark:text-zinc-400">&ldquo;{checkin.notes}&rdquo;</p> : null}
          </Card>
        ) : (
          <div className="mt-3">
            <EmptyState>No check-ins submitted yet.</EmptyState>
          </div>
        )}
      </div>

      <div className="mt-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Profile</p>
        {athleteProfile ? (
          <Card padding="md" className="mt-3">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {athleteProfile.birth_year ? (
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Age</dt>
                  <dd className="text-zinc-900 dark:text-white">{currentYear - athleteProfile.birth_year}</dd>
                </div>
              ) : null}
              {athleteProfile.current_level ? (
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Level</dt>
                  <dd className="text-zinc-900 dark:text-white">{ATHLETE_LEVEL_LABELS[athleteProfile.current_level]}</dd>
                </div>
              ) : null}
              {athleteProfile.current_weekly_mileage ? (
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Current weekly mileage</dt>
                  <dd className="text-zinc-900 dark:text-white">{athleteProfile.current_weekly_mileage} mi</dd>
                </div>
              ) : null}
              {athleteProfile.years_running !== null ? (
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Years running</dt>
                  <dd className="text-zinc-900 dark:text-white">{athleteProfile.years_running}</dd>
                </div>
              ) : null}
              {athleteProfile.primary_event ? (
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Primary event</dt>
                  <dd className="text-zinc-900 dark:text-white">{athleteProfile.primary_event}</dd>
                </div>
              ) : null}
            </dl>
          </Card>
        ) : (
          <div className="mt-3">
            <EmptyState>Hasn&rsquo;t completed their profile in Settings yet.</EmptyState>
          </div>
        )}
      </div>

      <div className="mt-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Active Goals</p>
        {goals && goals.length > 0 ? (
          <div className="mt-3 space-y-2">
            {goals.map((goal) => (
              <Card key={goal.id} padding="md">
                <p className="font-medium text-zinc-900 dark:text-white">{goal.race_name}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  {metersToLabel(goal.distance_m)}
                  {goal.goal_time_s ? ` · Goal ${secondsToClock(goal.goal_time_s)}` : ""}
                  {goal.goal_date ? ` · ${formatDate(goal.goal_date)}` : ""}
                </p>
              </Card>
            ))}
          </div>
        ) : (
          <div className="mt-3">
            <EmptyState>No active goals set.</EmptyState>
          </div>
        )}
      </div>

      <div className="mt-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Recent Races</p>
        {raceResults && raceResults.length > 0 ? (
          <div className="mt-3 divide-y divide-black/10 dark:divide-white/10">
            {raceResults.map((race) => (
              <div key={race.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">{race.race_name}</p>
                  <p className="text-zinc-500 dark:text-zinc-400">{formatDate(race.race_date)}</p>
                </div>
                <p className="text-zinc-900 dark:text-white">
                  {metersToLabel(race.distance_m)} · {secondsToClock(race.finish_time_s)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3">
            <EmptyState>No race results logged yet.</EmptyState>
          </div>
        )}
      </div>
    </Container>
  );
}
