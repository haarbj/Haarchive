import type { Metadata } from "next";

import { createServiceRoleClient } from "@/lib/db/service-role";
import { loadAllUsers } from "@/lib/admin/users";
import { UserPermissionsRow } from "./user-permissions-row";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { fieldClass } from "@/lib/form-styles";

export const metadata: Metadata = {
  title: "Users & Permissions",
};

// Fixed at the access-control migration's own seed id -- same constant
// admin/actions.ts uses for coach invites.
const BRONCOS_TEAM_ID = "00000000-0000-0000-0000-000000000001";

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  contentContributor: boolean;
  reviewer: boolean;
  trainingDashboardAccess: boolean;
};

// This page is already gated on isAdmin by admin/layout.tsx. team_memberships
// and user_permissions are read via the service-role client rather than the
// RLS-scoped one, since an admin managing OTHER users' access needs to see
// rows RLS would otherwise restrict to "your own".
async function loadUsers(): Promise<UserRow[]> {
  const admin = createServiceRoleClient();

  const [users, { data: memberships }, { data: permissionRows }] = await Promise.all([
    loadAllUsers(),
    admin
      .from("team_memberships")
      .select("user_id, role")
      .eq("team_id", BRONCOS_TEAM_ID)
      .returns<{ user_id: string; role: string }[]>(),
    admin
      .from("user_permissions")
      .select("user_id, permission")
      .returns<{ user_id: string; permission: string }[]>(),
  ]);

  const coachIds = new Set((memberships ?? []).filter((m) => m.role === "coach").map((m) => m.user_id));
  const contributorIds = new Set(
    (permissionRows ?? []).filter((p) => p.permission === "content_contributor").map((p) => p.user_id),
  );
  const reviewerIds = new Set(
    (permissionRows ?? []).filter((p) => p.permission === "reviewer").map((p) => p.user_id),
  );

  return users.map((u) => ({
    ...u,
    contentContributor: contributorIds.has(u.id),
    reviewer: reviewerIds.has(u.id),
    trainingDashboardAccess: coachIds.has(u.id),
  }));
}

function matchesSearch(user: UserRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return user.email.toLowerCase().includes(q) || user.displayName.toLowerCase().includes(q);
}

export default async function UsersPermissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const users = await loadUsers();
  const filtered = users
    .filter((user) => matchesSearch(user, q ?? ""))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <Container variant="dashboard">
      <BackLink href="/admin">Back to Admin</BackLink>
      <Heading>Users & Permissions</Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Grant or remove Content Contributor, Reviewer, and Training Dashboard access. These are independent
        of each other and of Admin, which is only ever set via the ADMIN_EMAILS environment variable.
      </p>

      <form className="mt-8" action="/admin/users">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or email…"
          className={`${fieldClass} w-full max-w-sm`}
        />
      </form>

      <div className="mt-6 space-y-4">
        {filtered.length > 0 ? (
          filtered.map((user) => <UserPermissionsRow key={user.id} {...user} />)
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">No users match that search.</p>
        )}
      </div>
    </Container>
  );
}
