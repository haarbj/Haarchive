// Pure helpers behind coach_athlete_invites -- kept separate from the
// Server Actions that touch the database so the actual expiry/matching
// logic is unit-testable without mocking Supabase.

export function isInviteExpired(expiresAtIso: string, now: Date = new Date()): boolean {
  return new Date(expiresAtIso).getTime() <= now.getTime();
}

// Case-insensitive, whitespace-tolerant email comparison -- the same
// matching rule the coach_athlete_invites unique index and the
// handle_new_user() trigger both apply via lower(email).
export function emailsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
