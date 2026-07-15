"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";

export type AdminMessageActionState = { error?: string; success?: boolean };

async function requireAdmin() {
  const session = await getAppSession();
  return session?.isAdmin ? session : null;
}

export async function markContactMessageRead(
  _prevState: AdminMessageActionState,
  formData: FormData,
): Promise<AdminMessageActionState> {
  const session = await requireAdmin();
  if (!session) return { error: "Not authorized." };

  const id = formData.get("id");
  const read = formData.get("read");
  if (typeof id !== "string" || (read !== "true" && read !== "false")) {
    return { error: "Invalid request." };
  }

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("contact_messages")
    .update({ read: read === "true" })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/messages");
  return { success: true };
}
