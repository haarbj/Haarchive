import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (!session?.isCoach) redirect("/dashboard");

  return children;
}
