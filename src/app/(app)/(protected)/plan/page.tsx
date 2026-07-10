import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { PlanView } from "./plan-view";

export const metadata: Metadata = {
  title: "Training Plan",
};

export default async function PlanPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");

  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-16 animate-fade-in">
      <PlanView userId={session.userId} />
    </section>
  );
}
