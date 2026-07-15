import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { hasAnyContentPermission } from "@/lib/auth/permissions";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (!session) redirect("/login");
  // A content contributor/reviewer may hold no team_memberships row at all
  // (they're not an athlete or coach) -- that's expected, not "unapproved",
  // so it bypasses the /pending redirect the same way isAdmin already does.
  if (!session.approved && !session.isAdmin && !hasAnyContentPermission(session.permissions)) {
    redirect("/pending");
  }

  return children;
}
