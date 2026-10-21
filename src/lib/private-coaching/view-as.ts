import { cookies } from "next/headers";
import type { createClient } from "@/lib/db/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// A coach "viewing as" one of their athletes: presentation only, never a
// change of auth identity. The coach's own session.userId never changes
// and never gains any new write capability -- every mutation action
// checks isViewingAsAthlete() (below) and refuses outright while the
// mode is active, regardless of whose id it would otherwise write under.
//
// State lives in a single httpOnly cookie (same precedent as
// anon-id.ts's getOrCreateAnonId/getAnonIdReadOnly split: a Server
// Component can read a cookie but never set one, so entering/exiting is
// a Server Action, while every page that needs to know the effective
// athlete just reads it). The cookie alone is never trusted: every read
// re-validates against coach_athletes, so a relationship ended mid-mode
// (or a cookie edited/replayed for a different athlete) falls back to
// "inactive," never an error.
//
// Deliberately no `import "server-only"` here, unlike anon-id.ts/
// viewer-timezone.ts: this module is imported directly (not just source-
// scanned) by the mutation actions it guards, and those actions' own
// tests invoke the real exported function -- the same reason
// viewer-timezone.ts's own header comment gives for keeping that guard
// out of week.ts's pure half. isViewingAsAthlete/resolveViewAsState are
// themselves mocked by any test that needs to control whether the mode
// is "active," the same way createNotification is mocked elsewhere,
// rather than relying on a guard that would just break those tests.
export const VIEW_AS_COOKIE = "haarchive_view_as_athlete_id";
// A coach's own working session, not an indefinite grant -- long enough
// to review a full plan/check-in/payoff without re-entering, short
// enough that a stale cookie left in a shared/borrowed browser doesn't
// stay live for weeks.
export const VIEW_AS_MAX_AGE_S = 60 * 60 * 12;

export type ViewAsState = { athleteId: string };

/** The raw cookie value, completely unvalidated -- never use this to decide anything; it only exists so Server Actions (which CAN set/clear cookies) have a single constant to agree on. */
export async function getViewAsCookieRaw(): Promise<string | null> {
  const store = await cookies();
  return store.get(VIEW_AS_COOKIE)?.value ?? null;
}

/**
 * The one real entry point every athlete-surface page and every
 * mutation guard should call. Re-validated on every call, never cached
 * across requests: the cookie's athleteId is a real, active target only
 * if `coachUserId` currently has an active, non-self coach_athletes row
 * with it. Returns null (silently inactive) for a missing cookie, a
 * self-targeted one, an ended/never-existed relationship, or a coach
 * session that isn't actually isPrivateCoach -- never throws, never
 * redirects, matching the task's own "invalid or expired mode = silently
 * inactive" rule.
 */
export async function resolveViewAsState(supabase: Supabase, coachUserId: string): Promise<ViewAsState | null> {
  const athleteId = await getViewAsCookieRaw();
  if (!athleteId || athleteId === coachUserId) return null;

  const { data } = await supabase
    .from("coach_athletes")
    .select("id")
    .eq("coach_id", coachUserId)
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();

  return data ? { athleteId } : null;
}

/**
 * The guard every athlete-surface mutation action calls first, right
 * after resolving its own session. True only when THIS caller (the
 * signed-in coach) currently has a valid, active view-as mode -- a
 * normal athlete's own session, or a coach with no/an invalid mode, both
 * get false. Mutations refuse unconditionally when this is true,
 * regardless of which user id the write would otherwise target --
 * nothing about view-as should ever let a write through.
 */
export async function isViewingAsAthlete(supabase: Supabase, callerUserId: string): Promise<boolean> {
  return (await resolveViewAsState(supabase, callerUserId)) != null;
}

export const VIEW_AS_REFUSAL = "Viewing as an athlete is read-only. Exit view-as to do this.";
