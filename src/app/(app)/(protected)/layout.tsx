import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";

// The site is open to any signed-in user now -- team membership, admin
// status, and content permissions are independent CAPABILITIES layered on
// top of general access (see coach/admin/plan's own layout guards), not
// prerequisites for it. /pending and the "no team_memberships row yet"
// state it was built for are left in place as unused-but-harmless, in case
// a future suspended/banned-account case needs a similar waypoint.

// Applies to every route under (protected) -- dashboard, admin/*, coach/*,
// contribute/*, settings, plan/* -- since none of those ~25 page files set
// their own `robots` field, so this layout-level default flows straight
// through to all of them (Next merges metadata down the tree; a more
// specific page's own `robots` would still win if one were ever added).
// The login redirect above already keeps a logged-out crawler from ever
// seeing real content here; this is the separate, explicit signal that
// these URLs themselves were never meant to be indexed even if discovered
// some other way. See docs/seo-audit.md section 3/9.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (!session) redirect("/login");

  return children;
}
