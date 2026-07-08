"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/server";
import { decryptToken } from "@/lib/crypto";

export async function disconnectStrava() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return;

  const { data: existing } = await supabase
    .from("connected_accounts")
    .select("access_token_encrypted")
    .eq("provider", "strava")
    .maybeSingle();

  if (existing?.access_token_encrypted) {
    try {
      const accessToken = decryptToken(existing.access_token_encrypted);
      await fetch("https://www.strava.com/oauth/deauthorize", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ access_token: accessToken }),
      });
    } catch {
      // Best-effort revoke with Strava -- still remove our own record below
      // even if this fails (e.g. token already invalid).
    }
  }

  await supabase.from("connected_accounts").delete().eq("provider", "strava");
  revalidatePath("/dashboard");
}
