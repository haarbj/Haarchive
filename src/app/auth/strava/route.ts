import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/db/server";

// Kicks off the Strava OAuth flow. This is a separate, post-login "connect
// your account" step -- not a sign-in method -- so it requires an existing
// Supabase session rather than establishing one.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { origin } = new URL(request.url);
  const state = randomBytes(16).toString("hex");

  const authorizeUrl = new URL("https://www.strava.com/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", process.env.STRAVA_CLIENT_ID!);
  authorizeUrl.searchParams.set("redirect_uri", `${origin}/auth/strava/callback`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("approval_prompt", "auto");
  authorizeUrl.searchParams.set("scope", "read,activity:read_all");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("strava_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
