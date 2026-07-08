"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/server";

export type UpdateProfileState = {
  error?: string;
  success?: boolean;
};

export async function updateProfile(
  _prevState: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const displayName = formData.get("displayName");
  const units = formData.get("units");

  if (typeof displayName !== "string" || !displayName.trim()) {
    return { error: "Display name can't be empty" };
  }
  if (units !== "mi" && units !== "km") {
    return { error: "Invalid units" };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    return { error: "Your session expired — sign in again." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName.trim(), units })
    .eq("id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true };
}
