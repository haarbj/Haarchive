"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { loadAllUsers } from "@/lib/admin/users";

export type ReviewApplicationState = { error?: string; success?: boolean };

async function requireAdmin() {
  const session = await getAppSession();
  return session?.isAdmin ? session : null;
}

// Approving grants content_contributor directly (see content_permissions
// migration) rather than just flipping a status flag -- an "approved"
// application that never actually got the applicant into /contribute would
// be a silent dead end. If the applicant wasn't signed in when they applied
// (no user_id yet), this resolves their email against real accounts
// (loadAllUsers, the only source of email -- see its own comment) and fails
// clearly if they haven't signed up yet, rather than silently granting
// nothing.
export async function reviewContributorApplication(
  _prevState: ReviewApplicationState,
  formData: FormData,
): Promise<ReviewApplicationState> {
  const session = await requireAdmin();
  if (!session) return { error: "Not authorized." };

  const id = formData.get("id");
  const status = formData.get("status");
  const adminNotes = formData.get("adminNotes");
  if (typeof id !== "string" || (status !== "approved" && status !== "rejected")) {
    return { error: "Invalid request." };
  }

  const admin = createServiceRoleClient();
  const { data: application } = await admin
    .from("contributor_applications")
    .select("id, email, user_id")
    .eq("id", id)
    .maybeSingle<{ id: string; email: string; user_id: string | null }>();
  if (!application) return { error: "Application not found." };

  let grantUserId = application.user_id;

  if (status === "approved") {
    if (!grantUserId) {
      const users = await loadAllUsers();
      const match = users.find((u) => u.email.toLowerCase() === application.email.toLowerCase());
      if (!match) {
        return { error: "No account found yet for this email — ask them to sign up, then approve again." };
      }
      grantUserId = match.id;
    }

    const { error: permissionError } = await admin
      .from("user_permissions")
      .insert({ user_id: grantUserId, permission: "content_contributor", granted_by: session.userId });
    // 23505 = unique-violation (composite PK) -- they already hold this
    // permission, not a real error.
    if (permissionError && permissionError.code !== "23505") return { error: permissionError.message };
  }

  const { error } = await admin
    .from("contributor_applications")
    .update({
      status,
      admin_notes: typeof adminNotes === "string" && adminNotes ? adminNotes : null,
      reviewed_by: session.userId,
      reviewed_at: new Date().toISOString(),
      user_id: grantUserId ?? application.user_id,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/contributor-applications");
  return { success: true };
}
