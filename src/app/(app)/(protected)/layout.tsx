import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";

// The site is open to any signed-in user now -- team membership, admin
// status, and content permissions are independent CAPABILITIES layered on
// top of general access (see coach/admin/plan's own layout guards), not
// prerequisites for it. /pending and the "no team_memberships row yet"
// state it was built for are left in place as unused-but-harmless, in case
// a future suspended/banned-account case needs a similar waypoint.
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (!session) redirect("/login");

  return children;
}
