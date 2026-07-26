import "server-only";

import { createServiceRoleClient } from "@/lib/db/service-role";

export type BasicUser = { id: string; email: string; displayName: string };

// Merges Supabase auth users (the only source of email) with profiles (the
// only source of display_name) -- shared by /admin/users (permission
// checkboxes) and /admin/articles/[id] (contributor picker), which both
// need "every real user, with a name and email" as their starting point.
// Only auth users that already have a profile row are included, since the
// handle_new_user trigger guarantees every real signup gets one.
export async function loadAllUsers(): Promise<BasicUser[]> {
  const admin = createServiceRoleClient();
  const [{ data: authUsers }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 500 }),
    admin.from("profiles").select("id, display_name").returns<{ id: string; display_name: string }[]>(),
  ]);

  const displayNameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  return (authUsers?.users ?? [])
    .filter((u) => displayNameById.has(u.id))
    .map((u) => ({
      id: u.id,
      email: u.email ?? "(no email)",
      displayName: displayNameById.get(u.id) ?? "Runner",
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
