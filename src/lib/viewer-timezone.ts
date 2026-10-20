import "server-only";
import { cookies } from "next/headers";

import { resolveViewerTimeZone, todayInTimeZone } from "@/lib/week";

export const VIEWER_TIMEZONE_COOKIE = "haarchive-tz";

// The viewer's real IANA timezone during server rendering, as reported by
// the tiny bootstrap script in layout.tsx (the same "write it before
// React hydrates" shape as the theme bootstrap script -- see that
// script's own comment in layout.tsx) -- never the server's own
// clock/zone, which Vercel/Node has no reason to share with any given
// visitor's. Read-only, same pattern as getAnonIdReadOnly (anon-id.ts):
// a Server Component render can't set a cookie itself, and doesn't need
// to here, since the client-side script already keeps it current.
// resolveViewerTimeZone (week.ts) does the actual validation/fallback --
// kept there, pure and framework-free, specifically so it stays testable
// without the "server-only" guard this file's own import carries (import
// "server-only" unconditionally throws under Vitest's plain Node
// environment, the same way it would in a browser bundle -- Next's own
// bundler is what aliases it away server-side, which Vitest doesn't do).
export async function getViewerTimeZone(): Promise<string> {
  const store = await cookies();
  return resolveViewerTimeZone(store.get(VIEWER_TIMEZONE_COOKIE)?.value);
}

// The single call every server-rendered "today" in the schedule/calendar
// surfaces should make -- see todayInTimeZone's own comment (week.ts) for
// why this resolves in the viewer's zone rather than the server's.
export async function todayForViewer(): Promise<string> {
  return todayInTimeZone(await getViewerTimeZone());
}
