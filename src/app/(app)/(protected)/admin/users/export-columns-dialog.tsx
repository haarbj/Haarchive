"use client";

import { useState } from "react";
import { X } from "lucide-react";

import type { UserRow } from "./page";
import { EXPORT_COLUMNS, EXPORT_COLUMN_GROUPS, buildUsersCsv, usersCsvFilename, type ExportColumnKey } from "@/lib/admin/user-export";
import { Button } from "@/components/ui/button";

const DEFAULT_KEYS = EXPORT_COLUMNS.filter((c) => c.defaultSelected).map((c) => c.key);

function downloadCsv(csv: string, filename: string) {
  // A BOM helps Excel (Windows especially) detect UTF-8 rather than
  // guessing a local codepage and mangling anything non-ASCII in a name.
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// A lightweight column-picker popover, not a spreadsheet editor -- see
// lib/admin/user-export.ts for the actual column definitions/CSV
// serialization, which stays framework-free and independently testable.
export function ExportColumnsDialog({ users, onClose }: { users: UserRow[]; onClose: () => void }) {
  const [selectedKeys, setSelectedKeys] = useState<ExportColumnKey[]>(DEFAULT_KEYS);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: ExportColumnKey) {
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function handleDownload() {
    if (selectedKeys.length === 0) {
      setError("Select at least one column.");
      return;
    }
    if (users.length === 0) {
      setError("No users selected to export.");
      return;
    }
    try {
      const csv = buildUsersCsv(users, selectedKeys);
      downloadCsv(csv, usersCsvFilename());
      onClose();
    } catch {
      setError("Couldn't generate the CSV. Try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-md flex-col rounded-card border border-black/10 bg-white shadow-modal dark:border-white/10 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4 dark:border-white/10">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            Export {users.length} user{users.length === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel export"
            className="text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto px-5 py-4">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Columns</p>
          {EXPORT_COLUMN_GROUPS.map((group) => (
            <div key={group}>
              <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">{group}</p>
              <div className="mt-2 space-y-1.5">
                {EXPORT_COLUMNS.filter((c) => c.group === group).map((col) => (
                  <label key={col.key} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={selectedKeys.includes(col.key)}
                      onChange={() => toggle(col.key)}
                      className="accent-zinc-900 dark:accent-white"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
          {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-black/5 px-5 py-4 dark:border-white/10">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={selectedKeys.length === 0} onClick={handleDownload}>
            Download CSV
          </Button>
        </div>
      </div>
    </div>
  );
}
