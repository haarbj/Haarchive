import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import { kgToLbs } from "@/lib/profile-fitness-source";
import type { ATHLETE_LEVELS, SEXES } from "@/lib/validation/athlete-profile";
import { AthleteProfileForm } from "@/app/(app)/(protected)/settings/athlete-profile-form";
import { CommunityProfileForm } from "@/app/(app)/(protected)/settings/community-profile-form";
import { RaceResultsSection, type RaceResultRow } from "@/app/(app)/(protected)/settings/race-results-section";
import { FitnessEstimatesSection, type FitnessEstimateRow } from "@/app/(app)/(protected)/settings/fitness-estimates-section";
import { InjuriesSection, type InjuryRow } from "@/app/(app)/(protected)/settings/injuries-section";
import { TrainingBackgroundSection } from "@/app/(app)/(protected)/settings/training-background-section";
import type { TrainingBackgroundSource } from "@/lib/private-coaching/training-background";
import { evaluateIntakeGaps } from "@/lib/private-coaching/intake-gaps";
import { SettingsForm } from "@/app/(app)/(protected)/settings/settings-form";
import { CoachSettingsForm } from "@/app/(app)/(protected)/settings/coach-settings-form";
import { LearningInterestsForm } from "@/app/(app)/(protected)/settings/learning-interests-form";
import type { LearningInterestCategory, LearningOrientation } from "@/lib/validation/learning";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Settings",
};

type Profile = {
  display_name: string;
  units: "mi" | "km";
  avatar_url: string | null;
  email_unsubscribed_at: string | null;
  coach_display_name: string | null;
  coach_trains_self: boolean | null;
  coach_bio: string | null;
  coach_philosophy: string | null;
  coach_default_volume_unit: "miles" | "minutes" | null;
};

type AthleteProfile = {
  birth_year: number | null;
  weight_kg: number | null;
  current_weekly_mileage: number | null;
  running_days_per_week: number | null;
  sex: (typeof SEXES)[number] | null;
  height_cm: number | null;
  years_running: number | null;
  current_level: (typeof ATHLETE_LEVELS)[number] | null;
  primary_event: string | null;
  training_facilities: string[] | null;
  elevation_m: number | null;
  recent_training_detail: string | null;
  long_run_day: string | null;
  blackout_days: string[] | null;
};

type TrainingBackgroundProfile = {
  training_background_source: TrainingBackgroundSource | null;
  training_background_coach_name: string | null;
  training_background_program_name: string | null;
  training_background_recent_mileage: number | null;
  training_background_peak_mileage: number | null;
  training_background_summary: string | null;
  training_background_injury_history: string | null;
};

function cmToIn(cm: number): number {
  return cm / 2.54;
}

type CommunityProfile = {
  bio: string | null;
  location: string | null;
  favorite_distances: string[];
};

type LearningPreferences = {
  orientation: LearningOrientation | null;
  interest_category_slugs: LearningInterestCategory[];
};

export default async function SettingsPage() {
  const session = await getAppSession(); // non-null: (protected)/layout.tsx already redirected otherwise
  const supabase = await createClient();

  const [
    { data: profile },
    { data: athleteProfile },
    { data: communityProfile },
    { data: raceResults },
    { data: injuries },
    { data: learningPreferences },
    { data: fitnessEstimateRows },
    { data: goalRows },
  ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "display_name, units, avatar_url, email_unsubscribed_at, coach_display_name, coach_trains_self, coach_bio, coach_philosophy, coach_default_volume_unit",
        )
        .eq("id", session!.userId)
        .single<Profile>(),
      // Explicitly filtered, same reasoning as community_profiles below --
      // profiles/athlete_profiles/race_results/injuries all gained a second
      // SELECT policy once private coaching shipped
      // (profiles_select_private_coach and friends, 20260825060000/
      // 20260826020000), scoped to "a coach can read THEIR ATHLETE's row."
      // An unfiltered query here used to be safe (only ever "select own"
      // existed), but for a signed-in private coach it would now also
      // match their athlete's row via RLS -- caught live on staging as a
      // goal race submitted by an athlete showing up on their COACH's own
      // dashboard/settings instead.
      supabase
        .from("athlete_profiles")
        .select(
          "birth_year, weight_kg, current_weekly_mileage, running_days_per_week, sex, height_cm, years_running, current_level, primary_event, training_facilities, elevation_m, recent_training_detail, long_run_day, blackout_days, training_background_source, training_background_coach_name, training_background_program_name, training_background_recent_mileage, training_background_peak_mileage, training_background_summary, training_background_injury_history",
        )
        .eq("user_id", session!.userId)
        .maybeSingle<AthleteProfile & TrainingBackgroundProfile>(),
      // Unlike profiles/athlete_profiles above (whose own RLS "select own"
      // policies scope an unfiltered query to the caller for free),
      // community_profiles' only select policy is fully public
      // (`using (true)`, see 20260721010000_community_profiles.sql) --
      // required so /community/[id] can show anyone's public profile, but
      // it means nothing here narrows this read to "mine" without an
      // explicit filter. Without it, this could read a different (or, past
      // one existing row, an ambiguous) profile than the signed-in user's
      // own, which both mis-set the "View how this looks to others" link's
      // hasProfile flag and could prefill the form with someone else's bio.
      supabase
        .from("community_profiles")
        .select("bio, location, favorite_distances")
        .eq("user_id", session!.userId)
        .maybeSingle<CommunityProfile>(),
      supabase
        .from("race_results")
        .select("id, race_name, race_date, distance_m, finish_time_s, course_type")
        .eq("user_id", session!.userId)
        .order("race_date", { ascending: false })
        .returns<RaceResultRow[]>(),
      supabase
        .from("injuries")
        .select("id, injury_type, body_part, start_date, end_date, severity, affects_training, notes")
        .eq("user_id", session!.userId)
        .order("start_date", { ascending: false })
        .returns<InjuryRow[]>(),
      supabase
        .from("learning_preferences")
        .select("orientation, interest_category_slugs")
        .maybeSingle<LearningPreferences>(),
      supabase
        .from("athlete_fitness_estimates")
        .select("reference_key, estimated_time_s, updated_at")
        .eq("athlete_id", session!.userId)
        .returns<{ reference_key: "5k" | "marathon"; estimated_time_s: number; updated_at: string }[]>(),
      // Only ever used for the intake gap-check's hasGoalRace signal
      // below -- the self-serve dashboard has its own, separate goals
      // query/display, which this intentionally doesn't duplicate.
      supabase
        .from("goals")
        .select("id, goal_date")
        .eq("user_id", session!.userId)
        .eq("status", "active")
        .not("goal_date", "is", null)
        .returns<{ id: string; goal_date: string }[]>(),
    ]);
  const fitnessEstimates: FitnessEstimateRow[] = (fitnessEstimateRows ?? []).map((r) => ({
    referenceKey: r.reference_key,
    estimatedTimeS: r.estimated_time_s,
    updatedAt: r.updated_at,
  }));

  const intakeGaps = evaluateIntakeGaps({
    hasGoalRace: (goalRows ?? []).length > 0,
    hasFitnessAnchor: (raceResults ?? []).length > 0 || fitnessEstimates.length > 0,
    trainingFacilities: athleteProfile?.training_facilities ?? null,
    homeAltitudeM: athleteProfile?.elevation_m ?? null,
    recentTrainingDetail: athleteProfile?.recent_training_detail ?? null,
    injuryLimitations: athleteProfile?.training_background_injury_history ?? null,
    runningDaysPerWeek: athleteProfile?.running_days_per_week ?? null,
    longRunDay: athleteProfile?.long_run_day ?? null,
  });

  // A coach-only account (no reason to believe they train themselves --
  // isAthlete/isCoachedAthlete are real relationship-based evidence,
  // coach_trains_self is their own explicit answer) has no real use for
  // the athlete-training-specific sections below. Ordinary community
  // members (the overwhelming majority: no team, no private coach either
  // way) are entirely unaffected -- this only ever hides anything for
  // isPrivateCoach accounts specifically.
  //
  // `!== false`, not `=== true`: CoachSettingsForm's own "trains self"
  // dropdown displays "Yes" as its default when coach_trains_self is null
  // (never explicitly answered) -- an auto-save form, so that default only
  // gets written to the row once the coach actually touches the field. A
  // coach who never has (the common case right after they self-coach a
  // workout, before ever visiting this page) would otherwise see this
  // whole block silently hidden despite the form directly above it
  // visually claiming "Yes" is already selected -- null should read the
  // same as the form's own displayed default, not as an explicit "No."
  const showAthleteSections =
    !session!.isPrivateCoach || session!.isAthlete || session!.isCoachedAthlete || profile?.coach_trains_self !== false;

  return (
    <Container variant="dashboard">
      <Heading variant="compact">
        Settings
      </Heading>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
        Update your display name and preferred units.
      </p>

      <div className="mt-8">
        <SettingsForm
          initialDisplayName={profile?.display_name ?? ""}
          initialUnits={profile?.units ?? "mi"}
          initialEmailUnsubscribed={profile?.email_unsubscribed_at != null}
          email={session!.email ?? ""}
        />
      </div>

      {/* Intake gap-check (see intake-gaps.ts) -- a flag, never a block:
          nothing below requires completing these before a coach assigns
          or publishes a plan. Each prompt deep-links to the exact field;
          a completed item simply stops appearing here. */}
      {session!.isCoachedAthlete && intakeGaps.missing.length > 0 ? (
        <Card padding="md" className="mt-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
            Complete your intake
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Your coach uses this to plan around what you actually have access to.
          </p>
          <ul className="mt-3 space-y-2">
            {intakeGaps.missing.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.athleteHref}
                  className="text-sm font-semibold text-zinc-700 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-zinc-200 dark:decoration-white/30 dark:hover:decoration-white"
                >
                  {item.athletePrompt}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {session!.isPrivateCoach ? (
        <>
          <h2 className="mt-12 text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">Coaching</h2>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            How you appear to your athletes, separate from how you appear elsewhere on the site.
          </p>
          <div className="mt-8">
            <CoachSettingsForm
              initialCoachDisplayName={profile?.coach_display_name ?? ""}
              initialCoachTrainsSelf={profile?.coach_trains_self ?? null}
              initialCoachBio={profile?.coach_bio ?? ""}
              initialCoachPhilosophy={profile?.coach_philosophy ?? ""}
              initialCoachDefaultVolumeUnit={profile?.coach_default_volume_unit ?? "miles"}
            />
          </div>
        </>
      ) : null}

      {showAthleteSections ? (
        <>
          <h2 id="athlete-profile" className="mt-12 text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            Athlete profile
          </h2>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            This feeds calculators and your dashboard so you don&rsquo;t have to re-enter it every time.
          </p>
          <div className="mt-8">
            <AthleteProfileForm
              initialBirthYear={athleteProfile?.birth_year ?? null}
              initialWeightLb={athleteProfile?.weight_kg != null ? Math.round(kgToLbs(athleteProfile.weight_kg)) : null}
              initialCurrentWeeklyMileage={athleteProfile?.current_weekly_mileage ?? null}
              initialDaysPerWeek={athleteProfile?.running_days_per_week ?? null}
              initialSex={athleteProfile?.sex ?? null}
              initialHeightIn={athleteProfile?.height_cm != null ? Math.round(cmToIn(athleteProfile.height_cm) * 10) / 10 : null}
              initialYearsRunning={athleteProfile?.years_running ?? null}
              initialCurrentLevel={athleteProfile?.current_level ?? null}
              initialPrimaryEvent={athleteProfile?.primary_event ?? null}
              initialTrainingFacilities={athleteProfile?.training_facilities ?? null}
              initialHomeAltitudeM={athleteProfile?.elevation_m ?? null}
              initialRecentTrainingDetail={athleteProfile?.recent_training_detail ?? null}
              initialLongRunDay={athleteProfile?.long_run_day ?? null}
              initialBlackoutDays={athleteProfile?.blackout_days ?? null}
            />
          </div>
        </>
      ) : null}

      {session!.isCoachedAthlete ? (
        <>
          <h2 id="training-background" className="mt-12 text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            Training background
          </h2>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            How you trained before joining -- whoever was coaching you, or if no one was. Your coach uses this to
            pick a starting plan and set your progression, instead of assuming your history started here.
          </p>
          <div className="mt-8">
            <TrainingBackgroundSection
              initialSource={athleteProfile?.training_background_source ?? null}
              initialCoachName={athleteProfile?.training_background_coach_name ?? null}
              initialProgramName={athleteProfile?.training_background_program_name ?? null}
              initialRecentTypicalMileage={athleteProfile?.training_background_recent_mileage ?? null}
              initialPeakMileage={athleteProfile?.training_background_peak_mileage ?? null}
              initialSummary={athleteProfile?.training_background_summary ?? null}
              initialInjuryHistory={athleteProfile?.training_background_injury_history ?? null}
            />
          </div>
        </>
      ) : null}

      <h2 className="mt-12 text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">Community profile</h2>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
        Public -- anyone can view this at your profile link, once you save it.
      </p>
      <div className="mt-8">
        <CommunityProfileForm
          userId={session!.userId}
          hasProfile={!!communityProfile}
          initialAvatarUrl={profile?.avatar_url ?? ""}
          initialBio={communityProfile?.bio ?? ""}
          initialLocation={communityProfile?.location ?? ""}
          initialFavoriteDistances={communityProfile?.favorite_distances ?? []}
        />
      </div>

      <h2 className="mt-12 text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">Learning interests</h2>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
        What you told us when you got started -- used to recommend what to read next. Change it anytime.
      </p>
      <div className="mt-8">
        <LearningInterestsForm
          initialOrientation={learningPreferences?.orientation ?? null}
          initialInterestCategorySlugs={learningPreferences?.interest_category_slugs ?? []}
        />
      </div>

      {showAthleteSections ? (
        <>
          <h2 id="race-results" className="mt-12 text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            My race results
          </h2>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            Log your race results here -- your best time at each distance shows as a PR on your public profile.
          </p>
          <div className="mt-8">
            <RaceResultsSection results={raceResults ?? []} />
          </div>

          <h2 id="fitness-estimates" className="mt-12 text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            Fitness estimates
          </h2>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            Your own current fitness, self-reported and updatable anytime -- separate from a completed race result.
          </p>
          <div className="mt-8">
            <FitnessEstimatesSection estimates={fitnessEstimates} />
          </div>

          <h2 className="mt-12 text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">Injuries</h2>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            Keep a log of what&rsquo;s come up and when -- useful for spotting patterns over a season.
          </p>
          <div className="mt-8">
            <InjuriesSection injuries={injuries ?? []} />
          </div>
        </>
      ) : null}
    </Container>
  );
}
