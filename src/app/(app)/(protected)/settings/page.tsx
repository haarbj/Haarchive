import type { Metadata } from "next";

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import { kgToLbs } from "@/lib/profile-fitness-source";
import { AthleteProfileForm } from "@/app/(app)/(protected)/settings/athlete-profile-form";
import { CommunityProfileForm } from "@/app/(app)/(protected)/settings/community-profile-form";
import { RaceResultsSection, type RaceResultRow } from "@/app/(app)/(protected)/settings/race-results-section";
import { SettingsForm } from "@/app/(app)/(protected)/settings/settings-form";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Settings",
};

type Profile = {
  display_name: string;
  units: "mi" | "km";
};

type AthleteProfile = {
  birth_year: number | null;
  weight_kg: number | null;
  current_weekly_mileage: number | null;
  running_days_per_week: number | null;
};

type CommunityProfile = {
  bio: string | null;
  location: string | null;
  favorite_distances: string[];
};

export default async function SettingsPage() {
  const session = await getAppSession(); // non-null: (protected)/layout.tsx already redirected otherwise
  const supabase = await createClient();

  const [{ data: profile }, { data: athleteProfile }, { data: communityProfile }, { data: raceResults }] =
    await Promise.all([
      supabase.from("profiles").select("display_name, units").single<Profile>(),
      supabase
        .from("athlete_profiles")
        .select("birth_year, weight_kg, current_weekly_mileage, running_days_per_week")
        .maybeSingle<AthleteProfile>(),
      supabase
        .from("community_profiles")
        .select("bio, location, favorite_distances")
        .maybeSingle<CommunityProfile>(),
      supabase
        .from("race_results")
        .select("id, race_name, race_date, distance_m, finish_time_s, course_type")
        .order("race_date", { ascending: false })
        .returns<RaceResultRow[]>(),
    ]);

  return (
    <Container variant="auth">
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
          initialBio={communityProfile?.bio ?? ""}
          initialLocation={communityProfile?.location ?? ""}
          initialFavoriteDistances={communityProfile?.favorite_distances ?? []}
        />
      </div>

      <h2 className="mt-12 text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">My race results</h2>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
        Log your race results here -- your best time at each distance shows as a PR on your public profile.
      </p>
      <div className="mt-8">
        <RaceResultsSection results={raceResults ?? []} />
      </div>
    </Container>
  );
}
