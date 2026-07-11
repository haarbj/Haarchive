import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import { BackLink } from "@/components/back-link";
import { DeleteGroupButton, MembershipRoster, RenameGroupForm } from "./group-detail-client";

export const metadata: Metadata = {
  title: "Group",
};

type Group = { id: string; name: string };
type Membership = { user_id: string };
type Profile = { id: string; display_name: string };

type GroupDetailPageProps = {
  params: Promise<{ groupId: string }>;
};

export default async function GroupDetailPage({ params }: GroupDetailPageProps) {
  const { groupId } = await params;
  const session = await getAppSession();
  const supabase = await createClient();

  const { data: group } = await supabase.from("groups").select("id, name").eq("id", groupId).maybeSingle<Group>();
  if (!group) notFound();

  const [{ data: teamMemberships }, { data: groupMemberships }, { data: otherGroups }] = await Promise.all([
    supabase.from("team_memberships").select("user_id").eq("team_id", session!.teamId!).eq("role", "athlete").returns<Membership[]>(),
    supabase.from("group_memberships").select("user_id").eq("group_id", groupId).returns<Membership[]>(),
    supabase.from("groups").select("id, name").eq("team_id", session!.teamId!).neq("id", groupId).returns<Group[]>(),
  ]);

  const athleteIds = teamMemberships?.map((m) => m.user_id) ?? [];
  const { data: profiles } = athleteIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", athleteIds).order("display_name").returns<Profile[]>()
    : { data: [] as Profile[] };

  // For the multi-group warning: which OTHER groups (by name) is each
  // athlete already in, so the roster checkbox can name them before the
  // coach adds a second one.
  const otherGroupIds = (otherGroups ?? []).map((g) => g.id);
  const { data: otherMemberships } = otherGroupIds.length
    ? await supabase.from("group_memberships").select("user_id, group_id").in("group_id", otherGroupIds).returns<{ user_id: string; group_id: string }[]>()
    : { data: [] as { user_id: string; group_id: string }[] };
  const otherGroupNameById = new Map((otherGroups ?? []).map((g) => [g.id, g.name]));
  const otherGroupNamesByAthlete = new Map<string, string[]>();
  for (const m of otherMemberships ?? []) {
    const name = otherGroupNameById.get(m.group_id);
    if (!name) continue;
    const list = otherGroupNamesByAthlete.get(m.user_id) ?? [];
    list.push(name);
    otherGroupNamesByAthlete.set(m.user_id, list);
  }

  return (
    <section className="mx-auto w-full max-w-2xl px-6 py-16 animate-fade-in">
      <BackLink href="/coach/groups" label="Groups" />
      <h1 className="mt-4 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">{group.name}</h1>

      <div className="mt-10 rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">Rename</p>
        <div className="mt-3">
          <RenameGroupForm groupId={group.id} name={group.name} />
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">Roster</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Check who&rsquo;s in this group.</p>
        <div className="mt-3">
          <MembershipRoster
            groupId={group.id}
            athletes={profiles ?? []}
            memberIds={(groupMemberships ?? []).map((m) => m.user_id)}
            otherGroupNamesByAthlete={Object.fromEntries(otherGroupNamesByAthlete)}
          />
        </div>
      </div>

      <div className="mt-8">
        <DeleteGroupButton groupId={group.id} />
      </div>
    </section>
  );
}
