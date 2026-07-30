"use server";

import { createClient } from "@/lib/db/server";
import { createServiceRoleClient } from "@/lib/db/service-role";

export type AvatarUploadState = { url?: string; error?: string };

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// Shared by the contributor profile form and the community (runner)
// profile form -- both edit the same profiles.avatar_url column, and any
// signed-in user should be able to set their own avatar regardless of
// contributor status, unlike uploadArticleImage which requires
// content_contributor/admin. Uploads to storage via service-role (the
// public avatars bucket has no object policies at all, see its own
// migration), but the auth check itself is just "is there a session".
export async function uploadAvatarImage(formData: FormData): Promise<AvatarUploadState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Your session expired. Sign in again." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file provided." };
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { error: "Unsupported image type. Use PNG, JPEG, WebP, or GIF." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "Image is too large. Keep it under 8 MB." };
  }

  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;

  const admin = createServiceRoleClient();
  const { error: uploadError } = await admin.storage.from("avatars").upload(path, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { data: publicUrlData } = admin.storage.from("avatars").getPublicUrl(path);
  return { url: publicUrlData.publicUrl };
}
