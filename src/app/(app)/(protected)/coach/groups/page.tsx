import type { Metadata } from "next";

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import { CreateGroupForm } from "./create-group-form";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { ListRow } from "@/components/ui/list-row";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Groups",
};

type Group = { id: string; name: string };
type MembershipCount = { group_id: string };

export default async function GroupsPage() {
  const session = await getAppSession();
  const supabase = await createClient();

  const { data: groups } = await supabase
    .from("groups")
    .select("id, name")
    .eq("team_id", session!.coachTeamId!)
    .order("name", { ascending: true })
    .returns<Group[]>();

  const groupIds = groups?.map((g) => g.id) ?? [];
  const { data: memberships } = groupIds.length
    ? await supabase.from("group_memberships").select("group_id").in("group_id", groupIds).returns<MembershipCount[]>()
    : { data: [] as MembershipCount[] };
  const countByGroup = new Map<string, number>();
  for (const m of memberships ?? []) {
    countByGroup.set(m.group_id, (countByGroup.get(m.group_id) ?? 0) + 1);
  }

  return (
    <Container variant="dashboard">
      <Heading>Groups</Heading>
      <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Training groups -- Varsity, JV, Frosh, or however you split things up. Each group gets its own
        schedule.
      </p>

      <Card padding="md" className="mt-10">
        <CreateGroupForm />
      </Card>

      <div className="mt-8">
        {groups && groups.length > 0 ? (
          <div className="space-y-2">
            {groups.map((group) => (
              <ListRow
                key={group.id}
                href={`/coach/groups/${group.id}`}
                className="font-medium text-zinc-900 dark:text-white"
              >
                <span>{group.name}</span>
                <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  {countByGroup.get(group.id) ?? 0} athlete{(countByGroup.get(group.id) ?? 0) === 1 ? "" : "s"}
                </span>
              </ListRow>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">No groups yet -- create one above.</p>
        )}
      </div>
    </Container>
  );
}
