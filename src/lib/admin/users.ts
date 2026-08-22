import "server-only";
import type { User } from "@supabase/supabase-js";

import { createServiceRoleClient } from "@/lib/db/service-role";

export type BasicUser = { id: string; email: string; displayName: string };

export type UserWithDetails = BasicUser & {
  /** ISO timestamp -- auth.users' own created_at, the actual signup moment (profiles.created_at is set by the same trigger a moment later and is effectively identical, but this is the source of truth). */
  createdAt: string;
  /** ISO timestamp, or null if the user has never signed in again since creating their account. */
  lastSignInAt: string | null;
  /** ISO timestamp, or null if never unsubscribed -- see profiles.email_unsubscribed_at. */
  emailUnsubscribedAt: string | null;
};

// listUsers() paginates (500/page in practice) rather than returning
// everyone in one call -- looping until nextPage is null is what actually
// makes loadAllUsers "all," not just "the first 500." A single-page
// perPage:500 call here previously silently truncated past that size.
async function fetchAllAuthUsers(): Promise<User[]> {
  const admin = createServiceRoleClient();
  const users: User[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    users.push(...data.users);
    if (!data.nextPage) break;
    page = data.nextPage;
  }
  return users;
}

// Merges Supabase auth users (the only source of email) with profiles (the
// only source of display_name) -- shared by /admin/users (permission
// checkboxes) and /admin/articles/[id] (contributor picker), which both
// need "every real user, with a name and email" as their starting point.
// Only auth users that already have a profile row are included, since the
// handle_new_user trigger guarantees every real signup gets one.
export async function loadAllUsers(): Promise<BasicUser[]> {
  const admin = createServiceRoleClient();
  const [authUsers, { data: profiles, error }] = await Promise.all([
    fetchAllAuthUsers(),
    admin.from("profiles").select("id, display_name").returns<{ id: string; display_name: string }[]>(),
  ]);
  // A failed profiles query must not silently read as "no profiles exist" --
  // that previously fell through to an empty displayNameById map, which
  // filtered out every single user below and rendered as an empty (not
  // erroring) page, the exact failure mode that made a real schema problem
  // look like a filter bug.
  if (error) throw new Error(`loadAllUsers: profiles query failed: ${error.message}`);

  const displayNameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  return authUsers
    .filter((u) => displayNameById.has(u.id))
    .map((u) => ({
      id: u.id,
      email: u.email ?? "(no email)",
      displayName: displayNameById.get(u.id) ?? "Runner",
    }));
}

// Same merge as loadAllUsers, plus createdAt/lastSignInAt -- split out
// rather than added to BasicUser/loadAllUsers itself, since the other two
// callers (contributor picker, question assignment picker) have no use for
// account-age/activity fields and shouldn't have to carry them. Built for
// /admin/users' audience-management columns specifically.
export async function loadAllUsersWithDetails(): Promise<UserWithDetails[]> {
  const admin = createServiceRoleClient();
  const [authUsers, { data: profiles, error }] = await Promise.all([
    fetchAllAuthUsers(),
    admin
      .from("profiles")
      .select("id, display_name, email_unsubscribed_at")
      .returns<{ id: string; display_name: string; email_unsubscribed_at: string | null }[]>(),
  ]);
  // See loadAllUsers' own comment -- same failure mode, same fix.
  if (error) throw new Error(`loadAllUsersWithDetails: profiles query failed: ${error.message}`);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return authUsers
    .filter((u) => profileById.has(u.id))
    .map((u) => ({
      id: u.id,
      email: u.email ?? "(no email)",
      displayName: profileById.get(u.id)?.display_name ?? "Runner",
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      emailUnsubscribedAt: profileById.get(u.id)?.email_unsubscribed_at ?? null,
    }));
}

// Every signed-up user gets a profiles row unconditionally (see
// handle_new_user), so loadAllUsers() above is deliberately unfiltered --
// correct for /admin/users, where an admin needs to see everyone to GRANT
// a permission in the first place. Assigning someone as an article
// author/reviewer/contributor is different: they can't do anything with
// that assignment unless they already hold content_contributor or
// reviewer (contribute/layout.tsx gates the whole /contribute area on
// exactly that), so the picker should only ever offer people who already
// have one of those two permissions -- the same set admin/users/page.tsx
// already computes and labels as "contributors" elsewhere in this app.
export async function loadEligibleContributors(): Promise<BasicUser[]> {
  const admin = createServiceRoleClient();
  const [users, { data: permissionRows }] = await Promise.all([
    loadAllUsers(),
    admin
      .from("user_permissions")
      .select("user_id, permission")
      .in("permission", ["content_contributor", "reviewer"])
      .returns<{ user_id: string; permission: string }[]>(),
  ]);

  const eligibleIds = new Set((permissionRows ?? []).map((p) => p.user_id));
  return users.filter((u) => eligibleIds.has(u.id));
}
