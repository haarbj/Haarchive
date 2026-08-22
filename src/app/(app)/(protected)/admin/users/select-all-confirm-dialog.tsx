"use client";

import { Button } from "@/components/ui/button";

// Only ever shown when "Select all filtered" is clicked and at least one
// currently-filtered user is marked unsubscribed -- selecting an
// unsubscribed person is still a real, allowed choice (an admin might
// genuinely want to export everyone including subscription status), but it
// shouldn't happen silently as a side effect of a bulk "select all" click.
// Same overlay/panel visual pattern as export-columns-dialog.tsx.
export function SelectAllConfirmDialog({
  totalCount,
  unsubscribedCount,
  onSelectAll,
  onSelectSubscribedOnly,
  onCancel,
}: {
  totalCount: number;
  unsubscribedCount: number;
  onSelectAll: () => void;
  onSelectSubscribedOnly: () => void;
  onCancel: () => void;
}) {
  const subscribedCount = totalCount - unsubscribedCount;

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card border border-black/10 bg-white p-5 shadow-modal dark:border-white/10 dark:bg-zinc-900">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
          {unsubscribedCount} of these {totalCount} {unsubscribedCount === 1 ? "is" : "are"} unsubscribed from
          emails
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Select all {totalCount} filtered users, or only the {subscribedCount} still subscribed?
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onSelectAll}>
            Select all {totalCount}
          </Button>
          <Button type="button" size="sm" onClick={onSelectSubscribedOnly}>
            Select {subscribedCount} subscribed
          </Button>
        </div>
      </div>
    </div>
  );
}
