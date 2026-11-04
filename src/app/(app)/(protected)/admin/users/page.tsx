import type { Metadata } from "next";
import Link from "next/link";

import { createServiceRoleClient } from "@/lib/db/service-role";
import { isAdminEmail } from "@/lib/auth/session";
import { loadAllUsersWithDetails } from "@/lib/admin/users";
import { matchesUserSearch, matchesUserType, type UserTypeFilter } from "@/lib/admin/user-filters";
import { UserManagementPanel } from "./user-management-panel";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { EmptyState } from "@/components/ui/empty-state";
import { fieldClass } from "@/lib/form-styles";

export const metadata: Metadata = {
  title: "Users & Permissions",
};

// Fixed at the access-control migration's own seed id -- same constant
// admin/actions.ts uses for coach invites.
const BRONCOS_TEAM_ID = "00000000-0000-0000-0000-000000000001";

export type UserRow = {
  id: string;
  email: string;
  displayName: string;
  contentContributor: boolean;
  reviewer: boolean;
  trainingDashboardAccess: boolean;
  /** Private 1-on-1 coaching product access -- see user_permissions' "private_coach" value. */
  privateCoach: boolean;
  isAdmin: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  /** Has at least one team_memberships row -- the same "approved" gate getAppSession() uses to unlock /dashboard. */
  status: "active" | "pending";
  learningEventCount: number;
  savedCalculationCount: number;
  /** ISO timestamp, or null if never unsubscribed -- see profiles.email_unsubscribed_at. */
  emailUnsubscribedAt: string | null;
};

type TypeKey = UserTypeFilter;

const TYPE_OPTIONS: { key: TypeKey; label: string }[] = [
  { key: "admin", label: "Admin" },
  { key: "contributor", label: "Content Contributor" },
  { key: "reviewer", label: "Reviewer" },
  { key: "coach", label: "Coach (Training Dashboard)" },
  { key: "private_coach", label: "Private Coach" },
  // "Non-contributor": holds none of the roles above -- a plain
  // signed-up community member with no elevated access at all.
  { key: "none", label: "Non-contributor" },
];

// This page is already gated on isAdmin by admin/layout.tsx. team_memberships
// and user_permissions are read via the service-role client rather than the
// RLS-scoped one, since an admin managing OTHER users' access needs to see
// rows RLS would otherwise restrict to "your own".
async function loadUsers(): Promise<UserRow[]> {
  const admin = createServiceRoleClient();

  const [users, { data: memberships }, { data: permissionRows }, { data: engagementRows }] = await Promise.all([
    loadAllUsersWithDetails(),
    admin
      .from("team_memberships")
      .select("user_id, role")
      .eq("team_id", BRONCOS_TEAM_ID)
      .returns<{ user_id: string; role: string }[]>(),
    admin
      .from("user_permissions")
      .select("user_id, permission")
      .returns<{ user_id: string; permission: string }[]>(),
    // Per-user counts computed in the database (user_engagement_counts
    // view, 20261103010000) via GROUP BY, instead of fetching every
    // learning_events/saved_calculations row and counting in JS.
    admin
      .from("user_engagement_counts")
      .select("user_id, learning_event_count, saved_calculation_count")
      .returns<{ user_id: string; learning_event_count: number; saved_calculation_count: number }[]>(),
  ]);

  // Only one team exists in the whole app (see BRONCOS_TEAM_ID's own
  // comment elsewhere) -- so ANY membership row for it, regardless of
  // role, is exactly getAppSession()'s own `approved = memberships.length
  // > 0` gate for unlocking /dashboard.
  const approvedIds = new Set((memberships ?? []).map((m) => m.user_id));
  const coachIds = new Set((memberships ?? []).filter((m) => m.role === "coach").map((m) => m.user_id));
  const contributorIds = new Set(
    (permissionRows ?? []).filter((p) => p.permission === "content_contributor").map((p) => p.user_id),
  );
  const reviewerIds = new Set(
    (permissionRows ?? []).filter((p) => p.permission === "reviewer").map((p) => p.user_id),
  );
  const privateCoachIds = new Set(
    (permissionRows ?? []).filter((p) => p.permission === "private_coach").map((p) => p.user_id),
  );

  const engagementByUser = new Map((engagementRows ?? []).map((r) => [r.user_id, r]));

  return users.map((u) => ({
    ...u,
    contentContributor: contributorIds.has(u.id),
    reviewer: reviewerIds.has(u.id),
    trainingDashboardAccess: coachIds.has(u.id),
    privateCoach: privateCoachIds.has(u.id),
    isAdmin: isAdminEmail(u.email),
    status: approvedIds.has(u.id) ? "active" : "pending",
    learningEventCount: engagementByUser.get(u.id)?.learning_event_count ?? 0,
    savedCalculationCount: engagementByUser.get(u.id)?.saved_calculation_count ?? 0,
  }));
}

export default async function UsersPermissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q, type } = await searchParams;
  const typeKey = TYPE_OPTIONS.some((o) => o.key === type) ? (type as TypeKey) : undefined;
  const users = await loadUsers();
  const filtered = users
    .filter((user) => matchesUserSearch(user, q ?? "") && matchesUserType(user, typeKey))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <Container variant="dashboard">
      <BackLink href="/admin">Back to Admin</BackLink>
      <Heading>Users & Permissions</Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Grant or remove Content Contributor, Reviewer, Training Dashboard, and Private Coach access. These are
        independent of each other and of Admin, which is only ever set via the ADMIN_EMAILS environment variable.
      </p>

      <form className="mt-8" action="/admin/users">
        <input type="hidden" name="type" value={typeKey ?? ""} />
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or email…"
          className={`${fieldClass} w-full max-w-sm`}
        />
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
            !typeKey
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "bg-black/5 text-zinc-700 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/20"
          }`}
        >
          All
        </Link>
        {TYPE_OPTIONS.map((option) => (
          <Link
            key={option.key}
            href={`/admin/users?type=${option.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
              typeKey === option.key
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "bg-black/5 text-zinc-700 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/20"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      {filtered.length > 0 ? (
        <UserManagementPanel users={filtered} />
      ) : (
        <div className="mt-6">
          <EmptyState>No users match these filters.</EmptyState>
        </div>
      )}
    </Container>
  );
}
