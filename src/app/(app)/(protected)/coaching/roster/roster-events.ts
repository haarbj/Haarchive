"use client";

// A same-page, DOM-native signal -- not React context or prop-drilling --
// letting RemoveAthleteButton/RevokeInviteButton tell the separately
// mounted InviteAthleteForm "something changed elsewhere on this page"
// without restructuring roster/page.tsx's three independent client islands
// (the invite form, the pending-invites list, the athletes list) into one
// shared-state tree just for this. Deliberately never fired by
// inviteAthlete itself -- that action's whole point is showing its own
// fresh result, not clearing it.
export const ROSTER_CHANGED_EVENT = "haarchive:coaching-roster-changed";

export function notifyRosterChanged() {
  window.dispatchEvent(new Event(ROSTER_CHANGED_EVENT));
}
