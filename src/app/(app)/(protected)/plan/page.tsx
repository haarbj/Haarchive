import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { PlanView } from "./plan-view";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Training Plan",
};

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const session = await getAppSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const view = sp.view === "timeline" ? "timeline" : "week";

  return (
    <Container variant="dashboard">
      <PlanView userId={session.userId} view={view} />
    </Container>
  );
}
