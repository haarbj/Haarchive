import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { PlanView } from "./plan-view";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Training Plan",
};

export default async function PlanPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");

  return (
    <Container variant="dashboard">
      <PlanView userId={session.userId} />
    </Container>
  );
}
