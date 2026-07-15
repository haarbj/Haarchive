"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { updateUserPermissionsSchema } from "@/lib/validation/user-permissions";

const BRONCOS_TEAM_ID = "00000000-0000-0000-0000-000000000001";

export type UpdateUserPermissionsState = { error?: string; success?: boolean };

// Content permissions and training-dashboard access are deliberately updated
// through two entirely separate mechanisms in the same action, mirroring how
// they're stored: user_permissions (new) vs. team_memberships (existing,
// untouched). Admin itself is never touched here -- there is no path in this
// action that can grant admin; it stays exclusively the ADMIN_EMAILS
// allowlist.
export async function updateUserPermissions(
  _prevState: UpdateUserPermissionsState,
  formData: FormData,
): Promise<UpdateUserPermissionsState> {
  const session = await getAppSession();
  if (!session?.isAdmin) return { error: "Not authorized." };

  const parsed = updateUserPermissionsSchema.safeParse({
    userId: formData.get("userId"),
    contentContributor: formData.get("contentContributor"),
    reviewer: formData.get("reviewer"),
    trainingDashboardAccess: formData.get("trainingDashboardAccess"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { userId, contentContributor, reviewer, trainingDashboardAccess } = parsed.data;
  const admin = createServiceRoleClient();

  const { error: deleteError } = await admin
    .from("user_permissions")
    .delete()
    .eq("user_id", userId)
    .in("permission", ["content_contributor", "reviewer"]);
  if (deleteError) return { error: deleteError.message };

  const toGrant = [
    contentContributor && "content_contributor",
    reviewer && "reviewer",
  ].filter((permission): permission is "content_contributor" | "reviewer" => Boolean(permission));

  if (toGrant.length > 0) {
    const { error: insertError } = await admin
      .from("user_permissions")
      .insert(toGrant.map((permission) => ({ user_id: userId, permission, granted_by: session.userId })));
    if (insertError) return { error: insertError.message };
  }

  // Training dashboard access = a 'coach' team_membership row, exactly what
  // the coach-invite redemption trigger already grants. The delete is
  // scoped to role = 'coach' specifically so unchecking this box can never
  // remove an athlete's own team_memberships row.
  if (trainingDashboardAccess) {
    const { error } = await admin
      .from("team_memberships")
      .upsert({ team_id: BRONCOS_TEAM_ID, user_id: userId, role: "coach" }, { onConflict: "team_id,user_id" });
    if (error) return { error: error.message };
  } else {
    const { error } = await admin
      .from("team_memberships")
      .delete()
      .eq("team_id", BRONCOS_TEAM_ID)
      .eq("user_id", userId)
      .eq("role", "coach");
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}
