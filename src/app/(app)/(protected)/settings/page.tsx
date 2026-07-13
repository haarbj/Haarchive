import type { Metadata } from "next";

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
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

export default async function SettingsPage() {
  const session = await getAppSession(); // non-null: (protected)/layout.tsx already redirected otherwise
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, units")
    .single<Profile>();

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
    </Container>
  );
}
