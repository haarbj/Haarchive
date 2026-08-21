"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/db/server";
import { notifyAdmins } from "@/lib/notifications/create-notification";
import { recordConversionEvent } from "@/app/conversion-actions";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";

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
  });
  await recordConversionEvent("account_created", "learning_progress", { method: "email" });

  redirect("/dashboard");
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
