import type { Metadata } from "next";

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import { kgToLbs } from "@/lib/profile-fitness-source";
import type { ATHLETE_LEVELS, SEXES } from "@/lib/validation/athlete-profile";
import { AthleteProfileForm } from "@/app/(app)/(protected)/settings/athlete-profile-form";
import { CommunityProfileForm } from "@/app/(app)/(protected)/settings/community-profile-form";
import { RaceResultsSection, type RaceResultRow } from "@/app/(app)/(protected)/settings/race-results-section";
import { InjuriesSection, type InjuryRow } from "@/app/(app)/(protected)/settings/injuries-section";
import { SettingsForm } from "@/app/(app)/(protected)/settings/settings-form";
import { LearningInterestsForm } from "@/app/(app)/(protected)/settings/learning-interests-form";
import type { LearningInterestCategory, LearningOrientation } from "@/lib/validation/learning";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Settings",
};

type Profile = {
  display_name: string;
  units: "mi" | "km";
  avatar_url: string | null;
  email_unsubscribed_at: string | null;
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
  ] = await Promise.all([
      supabase.from("profiles").select("display_name, units, avatar_url, email_unsubscribed_at").single<Profile>(),
      supabase
        .from("athlete_profiles")
        .select(
          "birth_year, weight_kg, current_weekly_mileage, running_days_per_week, sex, height_cm, years_running, current_level, primary_event",
        )
        .maybeSingle<AthleteProfile>(),
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
        .order("race_date", { ascending: false })
        .returns<RaceResultRow[]>(),
      supabase
        .from("injuries")
        .select("id, injury_type, body_part, start_date, end_date, severity, affects_training, notes")
        .order("start_date", { ascending: false })
        .returns<InjuryRow[]>(),
      supabase
        .from("learning_preferences")
        .select("orientation, interest_category_slugs")
        .maybeSingle<LearningPreferences>(),
    ]);

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

      <h2 className="mt-12 text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">Athlete profile</h2>
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
        />
      </div>

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

      <h2 className="mt-12 text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">My race results</h2>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
        Log your race results here -- your best time at each distance shows as a PR on your public profile.
      </p>
      <div className="mt-8">
        <RaceResultsSection results={raceResults ?? []} />
      </div>

      <h2 className="mt-12 text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">Injuries</h2>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
        Keep a log of what&rsquo;s come up and when -- useful for spotting patterns over a season.
      </p>
      <div className="mt-8">
        <InjuriesSection injuries={injuries ?? []} />
      </div>
    </Container>
  );
}
