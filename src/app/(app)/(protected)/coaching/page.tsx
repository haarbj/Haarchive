import type { Metadata } from "next";
import Link from "next/link";

import { getAppSession, isAdminEmail } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { getUserEmailById } from "@/lib/admin/users";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { addDays } from "@/lib/coaching-engine";
import { mostRecentMonday } from "@/lib/week";
import type { WorkoutType } from "@/lib/coaching-engine";
import { getWorkoutDisplayLabel } from "@/lib/private-coaching/workout-status";
import { loadCoachHomeData } from "./coach-home-data";
import { CoachTrainsSelfPrompt } from "@/components/private-coaching/coach-trains-self-prompt";
import { SelfCoachPrompt } from "@/components/private-coaching/self-coach-prompt";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

// A pure athlete (no coaching practice of their own) reading a bare
// "Coaching" tab could plausibly read it as "people I coach" -- same
// reasoning as buildAccountWorkspaces' own label branch, mirrored here for
// the page's own <title>/<h1> rather than just the nav entry pointing at it.
// For a dual-role account the ?view=athlete toggle (below) changes which
// one actually applies, so this reads the same searchParams the page
// itself does rather than just session.isPrivateCoach.
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ view?: string }> }): Promise<Metadata> {
  const session = await getAppSession();
  const { view } = await searchParams;
  const showingCoachView = session?.isPrivateCoach && !(session.isCoachedAthlete && view === "athlete");
  const title = showingCoachView ? "Coaching" : "My Coaching";
  return { title, robots: { index: false, follow: false } };
}

type CoachRow = { coach_id: string };
type Profile = { display_name: string; coach_display_name: string | null };
type UpcomingWorkout = {
  id: string;
  scheduled_date: string;
  title: string | null;
  day_label: string | null;
  workout_type: WorkoutType | null;
};

// Role-aware landing -- a coach and a coached athlete see genuinely
// different content. isPrivateCoach and isCoachedAthlete are independent
// (see AppSession's own comment -- someone can coach others AND be coached
// themselves, e.g. a coach who also has their own coach). A dual-role
// account used to see BOTH sections stacked on one page -- that avoided
// an earlier bug (a coach who also ran as someone else's athlete could
// never reach their own schedule/messages/check-in), but conflated "both
// exist" with "show both at once." The toggle below keeps both reachable
// while showing exactly one at a time, defaulting to the coach view:
// ?view=athlete switches it, as a real URL rather than client state, so
// it's linkable and needs no client component. The real Coach Home
// (attention triage) and athlete calendar are Phase 7/Phase 3
// respectively -- this is intentionally a thin routing/orientation page
// for now, not a dashboard.
export default async function CoachingHomePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const session = await getAppSession();
  if (!session) return null;

  const isDualRole = session.isPrivateCoach && session.isCoachedAthlete;
  const { view } = await searchParams;
  const showingAthleteView = isDualRole && view === "athlete";
  const showingCoachView = session.isPrivateCoach && !showingAthleteView;

  if (!session.isPrivateCoach && !session.isCoachedAthlete) {
    return (
      <Container variant="content">
        <Heading>My Coaching</Heading>
        <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          The Haarchive is experimenting with free private, 1-on-1 remote coaching. It&rsquo;s invite-only for
          now -- if a coach has invited you, use the link they sent to accept.
        </p>
        <SelfCoachPrompt />
      </Container>
    );
  }

  return (
    <Container variant="content">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading>{showingCoachView ? "Coaching" : "My Coaching"}</Heading>
        {isDualRole ? (
          <Link
            href={showingAthleteView ? "/coaching" : "/coaching?view=athlete"}
            className="text-sm font-semibold text-zinc-600 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-300 dark:decoration-white/20 dark:hover:decoration-white"
          >
            {showingAthleteView ? "View as Coach" : "View as Athlete"}
          </Link>
        ) : null}
      </div>

      {showingCoachView ? (
        <div className="mt-6">
          <CoachSection userId={session.userId} isCoachedAthlete={session.isCoachedAthlete} />
        </div>
      ) : null}

      {session.isCoachedAthlete && !showingCoachView ? (
        <div className="mt-6">
          <AthleteHomeSection userId={session.userId} />
        </div>
      ) : null}
    </Container>
  );
}

// Gates CoachHomeSection behind the required "do you also train?" question
// -- skipped entirely if isCoachedAthlete already proves the answer is yes
// (see the coach_trains_self migration's own comment on why that's real
// evidence and null isn't just "hasn't gotten to it yet" in that case).
async function CoachSection({ userId, isCoachedAthlete }: { userId: string; isCoachedAthlete: boolean }) {
  if (isCoachedAthlete) return <CoachHomeSection userId={userId} />;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("coach_trains_self")
    .eq("id", userId)
    .maybeSingle<{ coach_trains_self: boolean | null }>();

  if (profile?.coach_trains_self === null || profile?.coach_trains_self === undefined) {
    return <CoachTrainsSelfPrompt />;
  }
  return <CoachHomeSection userId={userId} />;
}

async function CoachHomeSection({ userId }: { userId: string }) {
  const { athletesNeedingAttention, athletesOnTrack, upcomingRaces, recentCompletions } = await loadCoachHomeData(userId);
  const totalAthletes = athletesNeedingAttention.length + athletesOnTrack.length;
  // Not the same thing as isSelfServeCoach (permission provenance) -- this
  // is "does this coach's roster today consist of ONLY themselves," true
  // whether their private_coach grant was self-serve or admin-granted (a
  // real coach who hasn't invited anyone yet but does self-coach gets the
  // same, more useful, direct-to-schedule treatment below). A coach with
  // real athletes AND a self-coached entry keeps the normal Roster/
  // Messages buttons -- those still matter for the real athletes.
  const allAthleteIds = [...athletesNeedingAttention, ...athletesOnTrack].map((a) => a.athleteId);
  const isSelfOnly = allAthleteIds.length === 1 && allAthleteIds[0] === userId;

  return (
    <div>
      <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        {isSelfOnly
          ? "You're set up to plan your own training."
          : totalAthletes > 0
            ? `You're coaching ${totalAthletes} ${totalAthletes === 1 ? "athlete" : "athletes"}.`
            : "Invite your first athlete to get started."}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {isSelfOnly ? (
          <Button href={`/coaching/athletes/${userId}/schedule`} variant="outline" size="sm">
            Your schedule
          </Button>
        ) : (
          <>
            <Button href="/coaching/roster" variant="outline" size="sm">
              Roster
            </Button>
            <Button href="/coaching/messages" variant="outline" size="sm">
              Messages
            </Button>
          </>
        )}
        <Button href="/coaching/templates" variant="outline" size="sm">
          Workout templates
        </Button>
        <Button href="/coaching/programs" variant="outline" size="sm">
          Programs
        </Button>
      </div>

      {/* "Who needs my attention today" -- the point of this whole page,
          per the product brief. Needing-attention athletes lead, each
          with real, specific reasons (not a raw metric); everyone else
          is a single quiet line, not a second row of cards. Skipped
          entirely for a self-only coach -- seeing your own name listed as
          if being monitored by someone else is confusing, not useful, and
          the "Your schedule" button above already covers the one real
          action available. */}
      {totalAthletes > 0 && !isSelfOnly ? (
        <div className="mt-10">
          <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
            Needs Attention
          </p>
          {athletesNeedingAttention.length > 0 ? (
            <div className="mt-3 space-y-2">
              {athletesNeedingAttention.map((athlete) => (
                <Link key={athlete.athleteId} href={`/coaching/athletes/${athlete.athleteId}`}>
                  <Card padding="md" className="transition hover:border-black/20 dark:hover:border-white/20">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-zinc-900 dark:text-white">{athlete.displayName}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {athlete.flags.map((flag) => (
                          <Badge key={flag.reason} tone={flag.severity === "high" ? "error" : "warning"}>
                            {flag.detail}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">Nobody needs attention right now.</p>
          )}

          {athletesOnTrack.length > 0 ? (
            <div className="mt-6">
              <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">On Track</p>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                {athletesOnTrack.map((athlete) => (
                  <Link
                    key={athlete.athleteId}
                    href={`/coaching/athletes/${athlete.athleteId}`}
                    className="text-sm text-zinc-600 hover:underline dark:text-zinc-300"
                  >
                    {athlete.displayName}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {upcomingRaces.length > 0 ? (
        <div className="mt-10">
          <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
            Upcoming Races
          </p>
          <div className="mt-3 divide-y divide-black/10 dark:divide-white/10">
            {upcomingRaces.map((race, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-zinc-900 dark:text-white">
                  {race.athleteName} -- {race.raceName}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">{formatDate(race.goalDate)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {recentCompletions.length > 0 ? (
        <div className="mt-10">
          <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
            Recently Completed
          </p>
          <div className="mt-3 divide-y divide-black/10 dark:divide-white/10">
            {recentCompletions.map((completion, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-zinc-900 dark:text-white">
                  {completion.athleteName} -- {completion.workoutTitle}
                  {completion.rpe ? ` (RPE ${completion.rpe})` : ""}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">{formatRelativeTime(completion.completedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

async function AthleteHomeSection({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("coach_id")
    .eq("athlete_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle<CoachRow>();
  const { data: coachProfile } = relationship
    ? await supabase
        .from("profiles")
        .select("display_name, coach_display_name")
        .eq("id", relationship.coach_id)
        .maybeSingle<Profile>()
    : { data: null };
  const coachName = coachProfile?.coach_display_name || coachProfile?.display_name;
  const isSelfCoached = relationship?.coach_id === userId;
  // Pace Zone Table is scoped to admin-coached athletes only (see
  // coaching/pace-zones/page.tsx's own gate) -- hidden here rather than
  // shown as a dead-end link that would just redirect back to this page.
  const coachEmail = relationship ? await getUserEmailById(relationship.coach_id) : null;
  const showPaceZoneTool = isAdminEmail(coachEmail);

  // A quiet, sorted list -- not a month grid -- reads as editorial rather
  // than a generic SaaS calendar widget, and is inherently mobile-first
  // (see the product brief's design constraint). Today's workout is the
  // first published one on or after today; "upcoming" is everything
  // after it, up to two weeks out.
  const today = new Date().toISOString().slice(0, 10);
  const twoWeeksOut = addDays(today, 14);
  const thisWeekStart = mostRecentMonday(new Date(`${today}T00:00:00Z`));
  const [{ data: upcoming }, { data: thisWeekPlan }] = await Promise.all([
    supabase
      .from("scheduled_workouts")
      .select("id, scheduled_date, title, day_label, workout_type")
      .eq("athlete_id", userId)
      .not("published_at", "is", null)
      .gte("scheduled_date", today)
      .lte("scheduled_date", twoWeeksOut)
      .order("scheduled_date", { ascending: true })
      .returns<UpcomingWorkout[]>(),
    // Coach-authored week-level guidance (training_week_plans.notes) --
    // shown for the CURRENT week only, since that's the week this home
    // page's own "Today"/"Upcoming" workouts belong to. Renders nothing
    // when the coach hasn't written one for this week, same "never
    // invent content" rule as the rest of this page.
    supabase
      .from("training_week_plans")
      .select("notes")
      .eq("athlete_id", userId)
      .eq("week_start", thisWeekStart)
      .maybeSingle<{ notes: string | null }>(),
  ]);

  const [todayWorkout, ...laterWorkouts] = upcoming ?? [];

  return (
    <div>
      <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        {isSelfCoached
          ? "You're coaching yourself."
          : coachName
            ? `You're being coached by ${coachName}.`
            : "You're being privately coached."}
      </p>

      {thisWeekPlan?.notes ? (
        <div className="mt-6">
          <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">This week</p>
          <Card padding="md" className="mt-3">
            <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">{thisWeekPlan.notes}</p>
          </Card>
        </div>
      ) : null}

      {todayWorkout ? (
        <div className="mt-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
            {todayWorkout.scheduled_date === today ? "Today" : "Next Up"}
          </p>
          <Card padding="md" className="mt-3">
            <Link href={`/coaching/workouts/${todayWorkout.id}`} className="font-semibold text-zinc-900 hover:underline dark:text-white">
              {getWorkoutDisplayLabel(todayWorkout.day_label, todayWorkout.title)}
            </Link>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {formatDate(todayWorkout.scheduled_date)}
              {todayWorkout.workout_type ? ` · ${todayWorkout.workout_type}` : ""}
            </p>
          </Card>
        </div>
      ) : (
        <GettingStarted userId={userId} coachName={coachName} isSelfCoached={isSelfCoached} />
      )}

      {laterWorkouts.length > 0 ? (
        <div className="mt-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Upcoming</p>
          <div className="mt-3 divide-y divide-black/10 dark:divide-white/10">
            {laterWorkouts.map((workout) => (
              <Link key={workout.id} href={`/coaching/workouts/${workout.id}`} className="group flex items-center justify-between gap-3 py-3">
                <span className="text-zinc-900 group-hover:underline dark:text-white">
                  {getWorkoutDisplayLabel(workout.day_label, workout.title)}
                </span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">{formatDate(workout.scheduled_date)}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <Button href="/coaching/training" variant="outline">
          My training
        </Button>
        {/* Messaging yourself is a dead end -- omitted entirely for a
            self-coached account rather than left as a pointless link. */}
        {!isSelfCoached ? (
          <Button href="/coaching/messages" variant="outline">
            Message your coach
          </Button>
        ) : null}
        <Button href="/coaching/checkin" variant="outline">
          Weekly check-in
        </Button>
        {showPaceZoneTool ? (
          <Button href="/coaching/pace-zones" variant="outline">
            Pace zone table
          </Button>
        ) : null}
        <Button href="/coaching/coach-profile" variant="outline">
          Coach profile
        </Button>
      </div>

      <Card padding="md" className="mt-8">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Make sure your{" "}
          <Link href="/settings" className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white">
            profile
          </Link>{" "}
          is up to date{isSelfCoached ? " -- goals and race history feed straight into your own plan." : " so your coach has real context."}
        </p>
      </Card>
    </div>
  );
}

function ChecklistRow({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span
        className={
          done
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-zinc-400 dark:text-zinc-500"
        }
        aria-hidden="true"
      >
        {done ? "✓" : "○"}
      </span>
      <span className={done ? "text-zinc-600 dark:text-zinc-300" : "text-zinc-900 dark:text-white"}>{label}</span>
    </li>
  );
}

// The relationship existing is a real product state on its own -- an
// athlete with zero published workouts isn't a database empty state to
// explain away, it's the normal, expected shape of the first days of a
// coaching relationship. Distinguishes "never had training published"
// (the real first-timer welcome, with a checklist and a way to fill the
// waiting time) from "had training before, just nothing in the next two
// weeks right now" (an ongoing athlete between blocks -- a full "Welcome
// to coaching" message would be actively wrong/confusing there), since
// both currently produce an empty `upcoming` array and need telling apart.
async function GettingStarted({
  userId,
  coachName,
  isSelfCoached,
}: {
  userId: string;
  coachName: string | undefined;
  isSelfCoached: boolean;
}) {
  const supabase = await createClient();
  const [{ data: everPublished }, { data: athleteProfile }] = await Promise.all([
    supabase
      .from("scheduled_workouts")
      .select("id")
      .eq("athlete_id", userId)
      .not("published_at", "is", null)
      .limit(1)
      .maybeSingle(),
    supabase.from("athlete_profiles").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);

  const name = coachName ?? "your coach";

  if (everPublished) {
    return (
      <EmptyState>
        {isSelfCoached
          ? "No upcoming workouts published right now -- head to your schedule to plan the next block."
          : `No upcoming workouts published right now -- check back soon, or message ${name} if you were expecting one.`}
      </EmptyState>
    );
  }

  const profileComplete = !!athleteProfile;

  return (
    <Card padding="md">
      <p className="text-lg font-semibold text-zinc-900 dark:text-white">
        {isSelfCoached ? "Welcome to your own training" : "Welcome to coaching"}
      </p>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        {isSelfCoached
          ? "Your first training hasn't been published yet."
          : <>You&rsquo;re connected with {name}. Your first training hasn&rsquo;t been published yet.</>}
      </p>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
        {isSelfCoached ? "To get started:" : "While you wait, you can:"}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
        {isSelfCoached ? (
          <li>
            Plan your first week on{" "}
            <Link
              href={`/coaching/athletes/${userId}/schedule`}
              className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
            >
              your schedule
            </Link>
          </li>
        ) : (
          <>
            <li>
              Read {name}&rsquo;s{" "}
              <Link href="/coaching/coach-profile" className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white">
                training philosophy
              </Link>
            </li>
            <li>
              Message {name}{" "}
              <Link href="/coaching/messages" className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white">
                with any questions
              </Link>
            </li>
          </>
        )}
        <li>
          Make sure your{" "}
          <Link href="/settings" className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white">
            athlete profile
          </Link>{" "}
          is complete, including your goals
        </li>
      </ul>

      <ul className="mt-5 space-y-1.5 border-t border-black/10 pt-4 dark:border-white/10">
        <ChecklistRow done label={isSelfCoached ? "Self-coaching set up" : "Coaching relationship established"} />
        <ChecklistRow done={profileComplete} label="Athlete profile completed" />
        <ChecklistRow done={false} label="First workout published" />
      </ul>

      <div className="mt-5">
        {isSelfCoached ? (
          <Button href={`/coaching/athletes/${userId}/schedule`}>Go to your schedule</Button>
        ) : (
          <Button href="/coaching/messages">Message {name}</Button>
        )}
      </div>
    </Card>
  );
}
