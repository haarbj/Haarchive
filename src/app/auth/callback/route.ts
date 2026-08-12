import { NextResponse } from "next/server";

import { createClient } from "@/lib/db/server";
import { notifyAdmins } from "@/lib/notifications/create-notification";

// This route handles both a brand-new OAuth signup and a returning user's
// OAuth sign-in -- Supabase's code exchange doesn't distinguish them, and
// the email/password signUp action's own admin notification (auth-actions.ts)
// never fires for OAuth at all. created_at and last_sign_in_at landing
// within a few seconds of each other is the standard signal this session is
// the account's very first one; a returning sign-in has a last_sign_in_at
// long after created_at and is correctly skipped.
const NEW_SIGNUP_WINDOW_MS = 5_000;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (
        user?.created_at &&
        user.last_sign_in_at &&
        Math.abs(new Date(user.last_sign_in_at).getTime() - new Date(user.created_at).getTime()) < NEW_SIGNUP_WINDOW_MS
      ) {
        await notifyAdmins({
          type: "user_signed_up",
          content: `New signup: ${user.email ?? "unknown email"}`,
        });
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
}
