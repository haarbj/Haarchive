"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";

export type AdminBugReportActionState = { error?: string; success?: boolean };

const VALID_STATUSES = new Set(["new", "investigating", "resolved", "dismissed"]);

async function requireAdmin() {
  const session = await getAppSession();
  return session?.isAdmin ? session : null;
}

export async function updateBugReportStatus(
  _prevState: AdminBugReportActionState,
  formData: FormData,
): Promise<AdminBugReportActionState> {
  const session = await requireAdmin();
  if (!session) return { error: "Not authorized." };

  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || typeof status !== "string" || !VALID_STATUSES.has(status)) {
    return { error: "Invalid request." };
  }

  const admin = createServiceRoleClient();
  const { error } = await admin.from("bug_reports").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/bug-reports");
  return { success: true };
}

export async function deleteBugReport(id: string): Promise<void> {
  const session = await requireAdmin();
  if (!session) return;

  const admin = createServiceRoleClient();
  // Look up the screenshot path first -- deleting the row doesn't touch
  // storage on its own (no cascade between a Postgres row and a Storage
  // object), so an orphaned screenshot would otherwise sit in the bucket
  // forever with nothing pointing at it.
  const { data: report } = await admin
    .from("bug_reports")
    .select("screenshot_path")
    .eq("id", id)
    .maybeSingle<{ screenshot_path: string | null }>();

  if (report?.screenshot_path) {
    await admin.storage.from("bug-report-screenshots").remove([report.screenshot_path]);
  }
  await admin.from("bug_reports").delete().eq("id", id);

  revalidatePath("/admin/bug-reports");
}
