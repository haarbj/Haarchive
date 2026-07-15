"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/server";
import { updateContributorProfileSchema } from "@/lib/validation/contributor-profile";

export type UpdateContributorProfileState = { error?: string; success?: boolean };

// Uses the regular RLS-scoped client, not the service-role one: a
// contributor editing their own bio/avatar is exactly the "own row" case
// contributor_profiles_update_own and profiles_update_own already cover, the
// same reasoning settings/actions.ts already follows for display_name/units.
export async function updateContributorProfile(
  _prevState: UpdateContributorProfileState,
  formData: FormData,
): Promise<UpdateContributorProfileState> {
  const parsed = updateContributorProfileSchema.safeParse({
    title: formData.get("title"),
    bio: formData.get("bio"),
    expertiseInput: formData.get("expertiseInput"),
    avatarUrl: formData.get("avatarUrl"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Your session expired — sign in again." };

  const { title, bio, expertiseInput, avatarUrl } = parsed.data;

  const { error: profileError } = await supabase.from("contributor_profiles").upsert(
    { user_id: userId, title: title || null, bio: bio || null, expertise: expertiseInput },
    { onConflict: "user_id" },
  );
  if (profileError) return { error: profileError.message };

  const { error: avatarError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl || null })
    .eq("id", userId);
  if (avatarError) return { error: avatarError.message };

  revalidatePath("/contribute/profile");
  revalidatePath("/contribute");
  revalidatePath(`/contributors/${userId}`);
  return { success: true };
}
