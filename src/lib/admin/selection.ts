// Pure Set<string> operations behind the Users page's row checkboxes --
// extracted out of user-management-panel.tsx so "select all means all
// currently filtered users, never a hidden global set" is something a test
// can pin down directly, not just eyeball in the component.

export function toggleSelection(selected: Set<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

// `ids` is always the caller's own already-filtered list -- this never has
// access to, and therefore can never select, anything outside it.
export function selectAll(ids: string[]): Set<string> {
  return new Set(ids);
}

export function clearSelection(): Set<string> {
  return new Set();
}

// True only when every one of the given (already-filtered) ids is
// selected -- a selection that includes ids from an older/different filter
// (e.g. left over from before a search changed) does NOT count as "all"
// for the current set, which is exactly what drives the checkbox back to
// its unchecked state after the filtered list changes out from under it.
export function isAllSelected(selected: Set<string>, ids: string[]): boolean {
  return ids.length > 0 && ids.every((id) => selected.has(id));
}

type UnsubscribableUser = { id: string; emailUnsubscribedAt: string | null };

export function countUnsubscribed(users: UnsubscribableUser[]): number {
  return users.filter((u) => u.emailUnsubscribedAt !== null).length;
}

// Ids of only the subscribed users among the given (already-filtered)
// list -- the "select all EXCEPT unsubscribed" choice in the select-all
// prompt (see select-all-confirm-dialog.tsx).
export function subscribedIds(users: UnsubscribableUser[]): string[] {
  return users.filter((u) => u.emailUnsubscribedAt === null).map((u) => u.id);
}
