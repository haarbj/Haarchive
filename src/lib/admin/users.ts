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
