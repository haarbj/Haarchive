import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { hasAnyContentPermission } from "@/lib/auth/permissions";

// Deliberately separate from both admin/layout.tsx (isAdmin only) and
// coach/layout.tsx (role === 'coach' only) -- gated on content permissions,
// which admins also always satisfy since "admins have access to everything."
export default async function ContributeLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (!session?.isAdmin && !hasAnyContentPermission(session?.permissions ?? [])) {
    redirect("/dashboard");
  }

  return children;
}
