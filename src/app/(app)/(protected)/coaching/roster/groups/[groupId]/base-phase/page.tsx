import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { loadGroupMembersForAssign } from "../assign-program/assign-program-group-actions";
import { loadProgramsForGroupBasePhase } from "./base-phase-group-actions";
import { BasePhaseGroupForm } from "./base-phase-group-form";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Base Phase for Group",
  robots: { index: false, follow: false },
};

export default async function GroupBasePhasePage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const session = await getAppSession();
  if (!session?.isPrivateCoach) redirect("/coaching");

  const loaded = await loadGroupMembersForAssign(groupId);
  if (loaded.error || !loaded.members) {
    return (
      <Container variant="content">
        <BackLink href="/coaching/roster">Roster</BackLink>
        <Heading>Base phase</Heading>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">{loaded.error ?? "Group not found."}</p>
      </Container>
    );
  }

  const programsResult = await loadProgramsForGroupBasePhase();

  return (
    <Container variant="content">
      <BackLink href="/coaching/roster">Roster</BackLink>
      <Heading>Base phase for {loaded.groupName}</Heading>
      <p className="mt-4 max-w-xl text-sm text-zinc-600 dark:text-zinc-300">
        Configure one base phase for the whole group -- each athlete is checked individually for injury history and
        schedule conflicts before anything is written.
      </p>
      <div className="mt-8">
        <BasePhaseGroupForm
          groupId={groupId}
          groupName={loaded.groupName ?? "this group"}
          members={loaded.members}
          programs={programsResult.programs ?? []}
        />
      </div>
    </Container>
  );
}
