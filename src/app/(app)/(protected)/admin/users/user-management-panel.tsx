"use client";

import { useState } from "react";

import type { UserRow } from "./page";
import { UserPermissionsRow } from "./user-permissions-row";
import { ExportColumnsDialog } from "./export-columns-dialog";
import { SelectAllConfirmDialog } from "./select-all-confirm-dialog";
import { extractEmails } from "@/lib/admin/user-export";
import {
  clearSelection as emptySelection,
  countUnsubscribed,
  isAllSelected,
  selectAll,
  subscribedIds,
  toggleSelection,
} from "@/lib/admin/selection";
import { Button } from "@/components/ui/button";

// Selection lives entirely client-side, over the already-filtered `users`
// array the server component passed in -- the page has no pagination (every
// filtered user renders in one shot), so "select all" here genuinely means
// every user matching the current search/role filter, not just a visible
// page of them. Nothing here re-fetches or re-derives the filter itself;
// changing the search box or a role pill still navigates and re-renders the
// whole page server-side, same as before this panel existed.
export function UserManagementPanel({ users }: { users: UserRow[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showUnsubscribedPrompt, setShowUnsubscribedPrompt] = useState(false);

  const selectedUsers = users.filter((u) => selectedIds.has(u.id));
  const filteredIds = users.map((u) => u.id);
  const allSelected = isAllSelected(selectedIds, filteredIds);
  const unsubscribedInFilter = countUnsubscribed(users);

  function toggleOne(id: string) {
    setSelectedIds((prev) => toggleSelection(prev, id));
    setCopyMessage(null);
  }

  // Selecting all is the one path that can silently sweep in someone who's
  // asked not to be emailed -- individual clicks are always a deliberate
  // choice about one specific person, so only "select all" needs the check.
  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(emptySelection());
      setCopyMessage(null);
      return;
    }
    if (unsubscribedInFilter > 0) {
      setShowUnsubscribedPrompt(true);
      return;
    }
    setSelectedIds(selectAll(filteredIds));
    setCopyMessage(null);
  }

  function confirmSelectAll() {
    setSelectedIds(selectAll(filteredIds));
    setShowUnsubscribedPrompt(false);
    setCopyMessage(null);
  }

  function confirmSelectSubscribedOnly() {
    setSelectedIds(selectAll(subscribedIds(users)));
    setShowUnsubscribedPrompt(false);
    setCopyMessage(null);
  }

  function clearSelection() {
    setSelectedIds(emptySelection());
    setCopyMessage(null);
  }

  async function copyEmails(separator: "\n" | ", ") {
    const emails = extractEmails(selectedUsers);
    if (emails.length === 0) {
      setCopyMessage("No valid email addresses in the current selection.");
      return;
    }
    try {
      await navigator.clipboard.writeText(emails.join(separator));
      setCopyMessage(`Copied ${emails.length} email${emails.length === 1 ? "" : "s"}`);
    } catch {
      setCopyMessage("Couldn't access the clipboard -- copy manually instead.");
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="accent-zinc-900 dark:accent-white"
              aria-label={allSelected ? "Clear selection" : `Select all ${users.length} filtered users`}
            />
            Select all {users.length} filtered
          </label>
          {unsubscribedInFilter > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {unsubscribedInFilter} unsubscribed from emails
            </p>
          )}
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {selectedIds.size} selected
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="ml-3 text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
            >
              Clear selection
            </button>
          )}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={selectedIds.size === 0} onClick={() => copyEmails("\n")}>
          Copy emails
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={selectedIds.size === 0} onClick={() => setShowExportDialog(true)}>
          Export CSV
        </Button>
        {selectedIds.size > 0 && (
          <button
            type="button"
            onClick={() => copyEmails(", ")}
            className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
          >
            Copy as comma-separated
          </button>
        )}
        {selectedIds.size === 0 && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Select users below to copy emails or export a CSV.</p>
        )}
        {copyMessage && <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">{copyMessage}</p>}
      </div>

      <div className="mt-6 space-y-4">
        {users.map((user) => (
          <div key={user.id} className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={selectedIds.has(user.id)}
              onChange={() => toggleOne(user.id)}
              className="mt-6 shrink-0 accent-zinc-900 dark:accent-white"
              aria-label={`Select ${user.displayName}`}
            />
            <div className="min-w-0 flex-1">
              <UserPermissionsRow {...user} />
            </div>
          </div>
        ))}
      </div>

      {showExportDialog && <ExportColumnsDialog users={selectedUsers} onClose={() => setShowExportDialog(false)} />}
      {showUnsubscribedPrompt && (
        <SelectAllConfirmDialog
          totalCount={users.length}
          unsubscribedCount={unsubscribedInFilter}
          onSelectAll={confirmSelectAll}
          onSelectSubscribedOnly={confirmSelectSubscribedOnly}
          onCancel={() => setShowUnsubscribedPrompt(false)}
        />
      )}
    </div>
  );
}
