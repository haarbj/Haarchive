"use server";

import { revalidatePath } from "next/cache";

import { getAppSession, type AppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";

export type TagOptionAdminState = { error?: string; success?: boolean };

async function requireAdmin(): Promise<AppSession> {
  const session = await getAppSession();
  return session?.isAdmin ? session : null;
}

// Same lowercase convention as the free-text tags this replaces (see
// parseTags in validation/articles.ts) -- articles.tags and this table
// need to agree on casing for the tag-filter links on /articles to match.
export async function addTagOption(
  _prevState: TagOptionAdminState,
  formData: FormData,
): Promise<TagOptionAdminState> {
  const session = await requireAdmin();
  if (!session) return { error: "Not authorized." };

  const raw = formData.get("name");
  const name = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!name) return { error: "Enter a tag name." };
  if (name.length > 40) return { error: "Keep it under 40 characters." };

  const admin = createServiceRoleClient();
  const { error } = await admin.from("article_tag_options").insert({ name });
  if (error) {
    if (error.code === "23505") return { error: "That tag already exists." };
    return { error: error.message };
  }

  revalidatePath("/admin/tags");
  return { success: true };
}

// Only removes the option from the picker going forward -- doesn't touch
// articles that already carry this tag (see the migration's own comment).
export async function removeTagOption(tagOptionId: string): Promise<void> {
  const session = await requireAdmin();
  if (!session) return;

  const admin = createServiceRoleClient();
  await admin.from("article_tag_options").delete().eq("id", tagOptionId);
  revalidatePath("/admin/tags");
}
