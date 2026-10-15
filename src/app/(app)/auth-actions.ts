"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/db/server";
import { notifyAdmins } from "@/lib/notifications/create-notification";
import { recordConversionEvent } from "@/app/conversion-actions";
import { signInSchema, signUpSchema, forgotPasswordSchema, resetPasswordSchema } from "@/lib/validation/auth";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

export type AuthActionState = {
  error?: string;
  message?: string;
};

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const next = safeRedirectPath(formData.get("next") as string | null, "/dashboard");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) {
    return { error: error.message };
  }

  if (!data.session) {
    return {
      message: "Check your email to confirm your account before signing in.",
    };
  }

  // Confirmation-required signups are notified later, from the
  // /auth/callback exchange that actually completes them -- notifying here
  // too would double-fire for that path. This branch only runs once email
  // confirmation is off (or already satisfied), so it's this account's one
  // and only completion. account_created mirrors that exact same
  // mutually-exclusive placement (also present in /auth/callback below).
  //
  // Awaited, unlike every client-triggered conversion event in this phase:
  // this is a low-frequency, one-time action immediately followed by a
  // redirect (which itself short-circuits execution in Next.js), so
  // leaving it un-awaited risks the event never actually completing before
  // the response ends. recordConversionEvent already fails open internally
  // (see its own try/catch), so awaiting it here can never fail this
  // action or delay the user meaningfully.
  await notifyAdmins({
    type: "user_signed_up",
    content: `New signup: ${data.user?.email ?? parsed.data.email}`,
    relatedEntityId: data.user?.id ?? null,
  });
  await recordConversionEvent("account_created", "learning_progress", { method: "email" });

  redirect(next);
}

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const next = safeRedirectPath(formData.get("next") as string | null, "/dashboard");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: error.message };
  }

  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// Deliberately returns the same generic message whether or not the email
// actually has an account -- Supabase's own resetPasswordForEmail already
// doesn't reveal account existence via its error, and this action doesn't
// add a check that would (never leak "no account for that email" from a
// public, unauthenticated form). The reset link itself carries a Supabase
// recovery code, exchanged by the existing /auth/callback route (same
// exchangeCodeForSession call OAuth/email-confirmation already use) --
// landing the user on /reset-password with a short-lived authenticated
// session, not a separate token-handling path of its own.
export async function requestPasswordReset(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  return { message: "If an account exists for that email, we've sent a link to reset your password." };
}

// Only reachable with a valid (recovery) session already established by
// /auth/callback -- updateUser fails on its own if there isn't one, and
// the /reset-password page itself also redirects out before this can be
// submitted without a session, so this isn't the only guard, just the
// authoritative one.
export async function updatePassword(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
