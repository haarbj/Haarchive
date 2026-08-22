// Pure data shaping for the Users & Permissions page's "Copy emails" /
// "Export CSV" actions -- no React, no Supabase client, so this is testable
// without mocking anything. See admin/users/page.tsx for where UserRow (the
// page's own shape) gets mapped into UserExportRow below.

import { serializeCsv } from "@/lib/admin/csv";

export type UserExportRow = {
  id: string;
  displayName: string;
  email: string;
  /** ISO timestamp. */
  createdAt: string;
  /** ISO timestamp, or null if never signed in again after signup. */
  lastSignInAt: string | null;
  /** Has at least one team_memberships row -- the same "approved" gate getAppSession() uses to unlock /dashboard. */
  status: "active" | "pending";
  /** ISO timestamp, or null if never unsubscribed -- see profiles.email_unsubscribed_at. */
  emailUnsubscribedAt: string | null;
  isAdmin: boolean;
  contentContributor: boolean;
  reviewer: boolean;
  trainingDashboardAccess: boolean;
  /** Count of learning_events rows (content_viewed/tool_used/note_taken/knowledge_check_answered/etc. all in one table) -- a single aggregate query, not per-user. */
  learningEventCount: number;
  /** Count of saved_calculations rows -- a single aggregate query, not per-user. */
  savedCalculationCount: number;
};

// A reasonably strict but not pedantic sanity check -- good enough to
// reject the "(no email)" placeholder loadAllUsers falls back to for an
// auth user with no email on file, without trying to be a full RFC 5322
// validator.
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Deduplicates case-insensitively (mail providers treat the local part as
// effectively case-insensitive in practice), ignores anything that doesn't
// look like a real address, and preserves the input array's own order --
// callers already sort users the way they want copied/exported (see
// page.tsx's displayName sort), so this doesn't re-sort.
export function extractEmails(users: { email: string }[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const user of users) {
    const email = user.email.trim();
    if (!email || !isValidEmail(email)) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(email);
  }
  return result;
}

// YYYY-MM-DD, not a locale-formatted date -- unambiguous in a CSV opened by
// a spreadsheet app in any region, unlike MM/DD vs. DD/MM. Deliberately not
// lib/format.ts's formatDate: that function expects a bare "yyyy-mm-dd"
// date (see its own header comment) and mishandles a full ISO timestamp
// like createdAt/lastSignInAt here -- slice to the date portion first, the
// same fix formatRelativeTime already applies before calling it.
function formatCsvDate(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}

export type ExportColumnKey =
  | "name"
  | "email"
  | "created"
  | "lastSignIn"
  | "status"
  | "subscribed"
  | "admin"
  | "contentContributor"
  | "reviewer"
  | "coach"
  | "learningActivity"
  | "savedCalculations";

export type ExportColumnGroup = "Identity" | "Account" | "Permissions" | "Engagement";

export type ExportColumnDef = {
  key: ExportColumnKey;
  label: string;
  group: ExportColumnGroup;
  defaultSelected: boolean;
  getValue: (user: UserExportRow) => string;
};

// Order here is display order in the column picker and in the exported
// CSV alike -- grouped the same way the task's own mockup grouped them.
export const EXPORT_COLUMNS: ExportColumnDef[] = [
  { key: "name", label: "Name", group: "Identity", defaultSelected: true, getValue: (u) => u.displayName },
  { key: "email", label: "Email", group: "Identity", defaultSelected: true, getValue: (u) => u.email },
  { key: "created", label: "Created", group: "Account", defaultSelected: false, getValue: (u) => formatCsvDate(u.createdAt) },
  {
    key: "lastSignIn",
    label: "Last sign-in",
    group: "Account",
    defaultSelected: false,
    getValue: (u) => (u.lastSignInAt ? formatCsvDate(u.lastSignInAt) : ""),
  },
  {
    key: "status",
    label: "Status",
    group: "Account",
    defaultSelected: false,
    getValue: (u) => (u.status === "active" ? "Active" : "Pending"),
  },
  {
    key: "subscribed",
    label: "Subscribed to emails",
    group: "Account",
    defaultSelected: false,
    getValue: (u) => (u.emailUnsubscribedAt === null ? "Yes" : "No"),
  },
  { key: "admin", label: "Admin", group: "Permissions", defaultSelected: false, getValue: (u) => (u.isAdmin ? "Yes" : "No") },
  {
    key: "contentContributor",
    label: "Content Contributor",
    group: "Permissions",
    defaultSelected: false,
    getValue: (u) => (u.contentContributor ? "Yes" : "No"),
  },
  {
    key: "reviewer",
    label: "Reviewer",
    group: "Permissions",
    defaultSelected: false,
    getValue: (u) => (u.reviewer ? "Yes" : "No"),
  },
  {
    key: "coach",
    label: "Coach / Training Dashboard",
    group: "Permissions",
    defaultSelected: false,
    getValue: (u) => (u.trainingDashboardAccess ? "Yes" : "No"),
  },
  {
    key: "learningActivity",
    label: "Learning activity count",
    group: "Engagement",
    defaultSelected: false,
    getValue: (u) => String(u.learningEventCount),
  },
  {
    key: "savedCalculations",
    label: "Saved calculations",
    group: "Engagement",
    defaultSelected: false,
    getValue: (u) => String(u.savedCalculationCount),
  },
];

export const EXPORT_COLUMN_GROUPS: ExportColumnGroup[] = ["Identity", "Account", "Permissions", "Engagement"];

export function buildUsersCsv(users: UserExportRow[], selectedKeys: ExportColumnKey[]): string {
  const columns = EXPORT_COLUMNS.filter((c) => selectedKeys.includes(c.key));
  const headers = columns.map((c) => c.label);
  const rows = users.map((user) => columns.map((c) => c.getValue(user)));
  return serializeCsv(headers, rows);
}

export function usersCsvFilename(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `haarchive-users-${y}-${m}-${d}.csv`;
}
