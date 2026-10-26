import type { Metadata } from "next";

import { getAppSession } from "@/lib/auth/session";
import { loadClubIntakeCycles, loadClubIntakeQueue } from "./actions";
import { QueueTable } from "./queue-table";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Club Intake",
  robots: { index: false, follow: false },
};

export default async function ClubIntakeQueuePage({ searchParams }: { searchParams: Promise<{ cycle?: string }> }) {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return null;

  const { cycle: cycleParam } = await searchParams;
  const cycles = await loadClubIntakeCycles();
  const activeCycle = cycles.find((c) => c.id === cycleParam) ?? cycles[0] ?? null;
  const rows = activeCycle ? await loadClubIntakeQueue(activeCycle.id) : [];

  return (
    <Container variant="content">
      <BackLink href="/coaching">Coaching</BackLink>
      <Heading>Club Intake</Heading>

      {!activeCycle ? (
        <div className="mt-8">
          <EmptyState>No intake cycles yet.</EmptyState>
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            {activeCycle.label} &middot; {activeCycle.raceName} &middot; {rows.length} submission{rows.length === 1 ? "" : "s"}
          </p>
          <div className="mt-8">
            <QueueTable rows={rows} />
          </div>
        </>
      )}
    </Container>
  );
}
