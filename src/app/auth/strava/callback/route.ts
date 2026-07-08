import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/db/server";
import { encryptToken } from "@/lib/crypto";

type StravaTokenResponse = {
  access_token: string;
  refresh_token: string;
};

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const stravaError = searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("strava_oauth_state")?.value;

  function redirectWithClearedState(path: string) {
    const response = NextResponse.redirect(`${origin}${path}`);
    response.cookies.delete("strava_oauth_state");
    return response;
  }

  if (stravaError) {
    return redirectWithClearedState("/dashboard?strava_error=denied");
  }
  // Mismatched/missing state means this callback wasn't triggered by our own
  // /auth/strava redirect -- reject rather than trust the code.
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithClearedState("/dashboard?strava_error=invalid_state");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    return redirectWithClearedState("/login");
  }

  const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    return redirectWithClearedState("/dashboard?strava_error=token_exchange_failed");
  }

  const tokenData: StravaTokenResponse = await tokenResponse.json();

  const { error: dbError } = await supabase.from("connected_accounts").upsert(
    {
      user_id: userId,
      provider: "strava",
      access_token_encrypted: encryptToken(tokenData.access_token),
      refresh_token_encrypted: encryptToken(tokenData.refresh_token),
      last_synced_at: null,
    },
    { onConflict: "user_id,provider" },
  );

  if (dbError) {
    return redirectWithClearedState("/dashboard?strava_error=save_failed");
  }

  return redirectWithClearedState("/dashboard?strava_connected=1");
}
