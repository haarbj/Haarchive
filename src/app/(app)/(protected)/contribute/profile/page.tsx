import type { Metadata } from "next";

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import { ContributorProfileForm } from "./contributor-profile-form";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "My Contributor Profile",
};

type ProfileRow = { display_name: string; avatar_url: string | null };
type ContributorRow = { title: string | null; bio: string | null; expertise: string[] };

export default async function ContributorProfilePage() {
  const session = await getAppSession(); // non-null: contribute/layout.tsx already gated
  const supabase = await createClient();

  const [{ data: profile }, { data: contributor }] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", session!.userId).single<ProfileRow>(),
    supabase
      .from("contributor_profiles")
      .select("title, bio, expertise")
      .eq("user_id", session!.userId)
      .maybeSingle<ContributorRow>(),
  ]);

  return (
    <Container variant="auth">
      <Heading variant="compact">My Contributor Profile</Heading>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
        Shown publicly on any article you&rsquo;re credited on — your name, title, bio, and areas of
        expertise.
      </p>

      <div className="mt-8">
        <ContributorProfileForm
          displayName={profile?.display_name ?? "Runner"}
          initialAvatarUrl={profile?.avatar_url ?? ""}
          initialTitle={contributor?.title ?? ""}
          initialBio={contributor?.bio ?? ""}
          initialExpertise={(contributor?.expertise ?? []).join(", ")}
        />
      </div>
    </Container>
  );
}
