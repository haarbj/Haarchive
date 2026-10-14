import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { formatDate } from "@/lib/format";
import { GroupsSection, type TrainingGroup } from "./groups-section";
import { InviteAthleteForm } from "./invite-athlete-form";
import { RemoveAthleteButton } from "./remove-athlete-button";
import { RevokeInviteButton } from "./revoke-invite-button";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Roster",
  robots: { index: false, follow: false },
};

type CoachAthleteRow = { id: string; athlete_id: string; started_at: string };
type ProfileRow = { id: string; display_name: string };
type PendingInviteRow = { id: string; athlete_email: string; created_at: string; expires_at: string };
type TrainingGroupRow = { id: string; name: string; description: string | null };
type TrainingGroupMemberRow = { id: string; group_id: string; athlete_id: string };

export default async function CoachingRosterPage() {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) redirect("/coaching");

  const supabase = await createClient();
  const { data: relationships } = await supabase
    .from("coach_athletes")
    .select("id, athlete_id, started_at")
    .eq("coach_id", session.userId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .returns<CoachAthleteRow[]>();

  const athleteIds = (relationships ?? []).map((r) => r.athlete_id);
  const { data: profiles } = athleteIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", athleteIds).returns<ProfileRow[]>()
    : { data: [] as ProfileRow[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  // coach_athlete_invites has zero RLS policies for authenticated users
  // (see the migration's own comment) -- reading even your own pending
  // invites requires the service-role client, same as resolveInvite does
  // for coach_invites.
  const admin = createServiceRoleClient();
  const { data: pendingInvites } = await admin
    .from("coach_athlete_invites")
    .select("id, athlete_email, created_at, expires_at")
    .eq("coach_id", session.userId)
    .is("redeemed_at", null)
    .order("created_at", { ascending: false })
    .returns<PendingInviteRow[]>();

  const rosterAthletes = (relationships ?? []).map((rel) => ({
    id: rel.athlete_id,
    name: nameById.get(rel.athlete_id) ?? "Athlete",
  }));

  const { data: groupRows } = await supabase
    .from("training_groups")
    .select("id, name, description")
    .eq("coach_id", session.userId)
    .order("created_at", { ascending: true })
    .returns<TrainingGroupRow[]>();

  const groupIds = (groupRows ?? []).map((g) => g.id);
  const { data: memberRows } = groupIds.length
    ? await supabase
        .from("training_group_members")
        .select("id, group_id, athlete_id")
        .in("group_id", groupIds)
        .returns<TrainingGroupMemberRow[]>()
    : { data: [] as TrainingGroupMemberRow[] };

  const groups: TrainingGroup[] = (groupRows ?? []).map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    members: (memberRows ?? [])
      .filter((member) => member.group_id === group.id)
      .map((member) => ({ membershipId: member.id, athleteId: member.athlete_id })),
  }));

  return (
    <Container variant="content">
      <BackLink href="/coaching">Coaching</BackLink>
      <Heading>Roster</Heading>
      <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Invite an athlete by email. They&rsquo;ll join your roster once they accept -- either by signing up fresh
        with the invited address, or, if they already have a Haarchive account, by opening the link while signed in.
      </p>

      <div className="mt-8">
        <InviteAthleteForm />
      </div>

      {pendingInvites && pendingInvites.length > 0 ? (
        <div className="mt-10">
          <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
            Pending Invites
          </p>
          <div className="mt-3 space-y-2">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-black/10 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-zinc-900"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">{invite.athlete_email}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Sent {formatDate(invite.created_at.slice(0, 10))} · Expires {formatDate(invite.expires_at.slice(0, 10))}
                  </p>
                </div>
                <RevokeInviteButton inviteId={invite.id} athleteEmail={invite.athlete_email} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <GroupsSection groups={groups} rosterAthletes={rosterAthletes} />

      <div className="mt-10">
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
          All athletes
        </p>
        {relationships && relationships.length > 0 ? (
          <div className="mt-3 space-y-2">
            {relationships.map((rel) => (
              <div
                key={rel.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-black/10 bg-white px-4 py-3 text-sm transition hover:border-black/20 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-white/20"
              >
                <Link href={`/coaching/athletes/${rel.athlete_id}`} className="font-medium text-zinc-900 dark:text-white">
                  {nameById.get(rel.athlete_id) ?? "Athlete"}
                </Link>
                <RemoveAthleteButton
                  coachAthleteId={rel.id}
                  athleteName={nameById.get(rel.athlete_id) ?? "this athlete"}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">No athletes yet -- invite one above.</p>
        )}
      </div>
    </Container>
  );
}
