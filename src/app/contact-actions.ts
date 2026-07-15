"use server";

import { getAppSession } from "@/lib/auth/session";
import { getOrCreateAnonId } from "@/lib/anon-id";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { submitContactMessageSchema } from "@/lib/validation/contact";

const RATE_LIMIT_WINDOW_HOURS = 24;
const RATE_LIMIT_MAX = 3;

// Same hybrid identity as questions (see that migration's comment) -- used
// only to rate-limit here, since the submitted email address, not the
// identity column, is what a reply actually goes to.
async function resolveIdentity(): Promise<{ userId: string | null; anonId: string | null }> {
  const session = await getAppSession();
  if (session) return { userId: session.userId, anonId: null };
  return { userId: null, anonId: await getOrCreateAnonId() };
}

export type SubmitContactMessageState = { error?: string; success?: boolean };

export async function submitContactMessage(
  _prevState: SubmitContactMessageState,
  formData: FormData,
): Promise<SubmitContactMessageState> {
  const parsed = submitContactMessageSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
    website: formData.get("website") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your submission" };
  }

  const { userId, anonId } = await resolveIdentity();
  const admin = createServiceRoleClient();

  const identityColumn = userId ? "user_id" : "anon_id";
  const identityValue = userId ?? anonId;
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .eq(identityColumn, identityValue as string)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return { error: "You've already sent a few messages recently — give it a bit before sending more." };
  }

  const { error } = await admin.from("contact_messages").insert({
    name: parsed.data.name,
    email: parsed.data.email,
    message: parsed.data.message,
    user_id: userId,
    anon_id: anonId,
  });

  if (error) return { error: error.message };

  return { success: true };
}
