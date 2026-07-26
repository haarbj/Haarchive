import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/db/server";
import { formatClock, formatDistance } from "@/lib/format";
import { raceDistanceMap } from "@/lib/race-distances";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

type ProfileRow = { display_name: string; avatar_url: string | null };
type CommunityRow = { bio: string | null; location: string | null; favorite_distances: string[] };
type PersonalRecordRow = { distance_m: number; best_time_s: number };

async function loadCommunityMember(id: string) {
  const supabase = await createClient();
  const [{ data: profile }, { data: community }] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", id).maybeSingle<ProfileRow>(),
    supabase
      .from("community_profiles")
      .select("bio, location, favorite_distances")
      .eq("user_id", id)
      .maybeSingle<CommunityRow>(),
  ]);
  // Only a real, saved community_profiles row makes this page exist
  // publicly -- having an account isn't enough, same rule contributor
  // profiles already follow.
  if (!profile || !community) return null;
  return { profile, community };
}

// public_personal_records is a public-readable view pre-aggregated to just
// (user_id, distance_m, best_time_s) -- see the community_profiles
// migration. race_results itself (race names, exact dates, notes,
// conditions) is never queried from this public route.
async function loadPersonalRecords(userId: string): Promise<PersonalRecordRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_personal_records")
    .select("distance_m, best_time_s")
    .eq("user_id", userId)
    .order("distance_m", { ascending: true })
    .returns<PersonalRecordRow[]>();
  return data ?? [];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const result = await loadCommunityMember(id);
  return { title: result?.profile.display_name ?? "Runner" };
}

export default async function CommunityMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadCommunityMember(id);
  if (!result) notFound();
  const { profile, community } = result;
  const personalRecords = await loadPersonalRecords(id);

  return (
    <Container variant="content">
      <div className="flex items-center gap-5">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URL, see contributor-profile-form.tsx
          <img
            src={profile.avatar_url}
            alt=""
            className="h-20 w-20 rounded-full border border-black/10 object-cover dark:border-white/10"
          />
        ) : (
          <div className="h-20 w-20 rounded-full bg-black/5 dark:bg-white/10" />
        )}
        <div>
          <Heading variant="compact">{profile.display_name}</Heading>
          {community.location && (
            <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">{community.location}</p>
          )}
        </div>
      </div>

      {community.bio && (
        <p className="mt-8 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">{community.bio}</p>
      )}

      {community.favorite_distances.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
            Favorite distances
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {community.favorite_distances.map((key) => (
              <span
                key={key}
                className="rounded-full border border-black/10 px-3 py-1 text-sm text-zinc-700 dark:border-white/10 dark:text-zinc-200"
              >
                {raceDistanceMap.get(key)?.label ?? key}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10">
        <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
          Personal records
        </p>
        {personalRecords.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {personalRecords.map((pr) => (
              <div
                key={pr.distance_m}
                className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3 dark:border-white/10"
              >
                <span className="font-semibold text-zinc-900 dark:text-white">{formatDistance(pr.distance_m)}</span>
                <span className="text-zinc-600 dark:text-zinc-300">{formatClock(pr.best_time_s)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">No race results logged yet.</p>
        )}
      </div>
    </Container>
  );
}
