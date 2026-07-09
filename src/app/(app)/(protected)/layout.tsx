import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (!session) redirect("/login");

  return children;
}
