import type { Metadata } from "next";

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import { kgToLbs } from "@/lib/profile-fitness-source";
import { AthleteProfileForm } from "@/app/(app)/(protected)/settings/athlete-profile-form";
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

export default async function SettingsPage() {
  const session = await getAppSession(); // non-null: (protected)/layout.tsx already redirected otherwise
  const supabase = await createClient();

  const [{ data: profile }, { data: athleteProfile }] = await Promise.all([
    supabase.from("profiles").select("display_name, units").single<Profile>(),
    supabase
      .from("athlete_profiles")
      .select("birth_year, weight_kg, current_weekly_mileage, running_days_per_week")
      .maybeSingle<AthleteProfile>(),
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
    </Container>
  );
}
