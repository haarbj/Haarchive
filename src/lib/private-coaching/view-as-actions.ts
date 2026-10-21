"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { VIEW_AS_COOKIE, VIEW_AS_MAX_AGE_S } from "./view-as";

export type EnterViewAsState = { error?: string };

/**
 * Entry point for the "View as {name}" buttons (roster row, athlete-
 * detail header). Validated here, then re-validated on every subsequent
 * read (resolveViewAsState) -- this isn't the only check, just the one
 * that decides whether the cookie gets set at all. Redirects to the
 * athlete's own home, where the mode first becomes visible.
 */
export async function enterViewAsAthlete(
  athleteId: string,
  _prevState: EnterViewAsState,
  _formData: FormData,
): Promise<EnterViewAsState> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };
  if (athleteId === session.userId) return { error: "Can't view as yourself." };

  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("id")
    .eq("coach_id", session.userId)
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();
  if (!relationship) return { error: "That's not your athlete." };

  const store = await cookies();
  store.set(VIEW_AS_COOKIE, athleteId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: VIEW_AS_MAX_AGE_S,
    path: "/",
  });
  redirect("/coaching");
}

/** The banner's "Back to coach view" control -- clears the mode and lands on that athlete's own coach-side detail page, never on an error page even if the cookie was already gone. */
export async function exitViewAsAthlete(): Promise<void> {
  const store = await cookies();
  const athleteId = store.get(VIEW_AS_COOKIE)?.value ?? null;
  store.delete(VIEW_AS_COOKIE);
  redirect(athleteId ? `/coaching/athletes/${athleteId}` : "/coaching/roster");
}
