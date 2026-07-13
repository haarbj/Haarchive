import "server-only";
import { cookies } from "next/headers";

const COOKIE_NAME = "haarchive_anon_id";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Identity for signed-out visitors submitting/upvoting questions. Only ever
// called from server actions after confirming the visitor has no session
// (see getAppSession) -- a random, unguessable per-browser id, not tied to
// anything personally identifying. httpOnly since nothing client-side needs
// to read it directly; every read/write of it happens server-side.
export async function getOrCreateAnonId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (existing) return existing;

  const id = crypto.randomUUID();
  store.set(COOKIE_NAME, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
  });
  return id;
}

// Read-only lookup for Server Component renders, which are not allowed to
// set cookies. A visitor who has never voted/submitted has no cookie yet --
// that's equivalent to "not this identity," which is exactly the right
// answer when checking whether they've already upvoted something.
export async function getAnonIdReadOnly(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}
