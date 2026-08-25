import { NextResponse } from "next/server";

import { createClient } from "@/lib/db/server";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { notifyAdmins } from "@/lib/notifications/create-notification";
import { recordConversionEvent } from "@/app/conversion-actions";

// This route handles both a brand-new OAuth signup/email-confirmation
// completion and a returning user's OAuth sign-in -- Supabase's code
// exchange doesn't distinguish them, and the email/password signUp action's
// own admin notification (auth-actions.ts) never fires for either of those
// two cases. Whether this is "the account's very first completed sign-in"
// used to be guessed from created_at/last_sign_in_at landing within a few
// seconds of each other, but that's wrong for the email-confirmation path:
// a real user takes anywhere from several seconds to several minutes to
// open the confirmation email and click through, so that heuristic silently
// (and permanently, since this route only runs once per confirmation click)
// dropped the notification for any account confirmed by email rather than
// Google OAuth. Instead, check directly whether a user_signed_up
// notification already exists for this user_id -- notifications are never
// deleted (see notification-bell.tsx, which only ever updates read_at), so
// "none exists yet" is an exact, non-time-based signal this is the first
// completed sign-in, and is idempotent against repeat callback hits no
// matter how long the confirmation click took.
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
      if (user?.id) {
        const admin = createServiceRoleClient();
        const { data: existing } = await admin
          .from("notifications")
          .select("id")
          .eq("type", "user_signed_up")
          .eq("related_entity_id", user.id)
          .limit(1)
          .maybeSingle();

        if (!existing) {
          await notifyAdmins({
            type: "user_signed_up",
            content: `New signup: ${user.email ?? "unknown email"}`,
            relatedEntityId: user.id,
          });
          // Phase 12A: covers OAuth (Google) signups and email-confirmation
          // completions -- the two cases auth-actions.ts's own signUp()
          // can't fire this for (see its matching comment). Awaited for the
          // same reason as there: a one-time, low-frequency event right
          // before a redirect, not a hot interactive path.
          await recordConversionEvent("account_created", "learning_progress", { method: "oauth_or_confirmation" });
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
}
