import { describe, expect, it } from "vitest";

import {
  EXPORT_COLUMNS,
  buildUsersCsv,
  extractEmails,
  usersCsvFilename,
  type UserExportRow,
} from "@/lib/admin/user-export";

function makeUser(overrides: Partial<UserExportRow> = {}): UserExportRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    displayName: "Jane Doe",
    email: "jane@example.com",
    createdAt: "2026-01-15T08:30:00.000Z",
    lastSignInAt: "2026-08-20T12:00:00.000Z",
    status: "active",
    emailUnsubscribedAt: null,
    isAdmin: false,
    contentContributor: false,
    reviewer: false,
    trainingDashboardAccess: false,
    learningEventCount: 0,
    savedCalculationCount: 0,
    ...overrides,
  };
}

describe("extractEmails", () => {
  it("returns valid emails in input order", () => {
    const users = [{ email: "b@example.com" }, { email: "a@example.com" }];
    expect(extractEmails(users)).toEqual(["b@example.com", "a@example.com"]);
  });

  it("deduplicates case-insensitively, keeping the first occurrence's casing", () => {
    const users = [{ email: "Jane@Example.com" }, { email: "jane@example.com" }];
    expect(extractEmails(users)).toEqual(["Jane@Example.com"]);
  });

  it("ignores the '(no email)' placeholder and other invalid addresses", () => {
    const users = [{ email: "(no email)" }, { email: "not-an-email" }, { email: "real@example.com" }];
    expect(extractEmails(users)).toEqual(["real@example.com"]);
  });

  it("ignores blank/whitespace-only emails", () => {
    expect(extractEmails([{ email: "" }, { email: "   " }])).toEqual([]);
  });

  it("trims whitespace around an otherwise-valid email", () => {
    expect(extractEmails([{ email: "  jane@example.com  " }])).toEqual(["jane@example.com"]);
  });

  it("returns an empty array for an empty selection", () => {
    expect(extractEmails([])).toEqual([]);
  });
});

describe("buildUsersCsv", () => {
  it("includes only the selected columns, in EXPORT_COLUMNS order", () => {
    const csv = buildUsersCsv([makeUser()], ["email", "name"]);
    expect(csv).toBe("Name,Email\r\nJane Doe,jane@example.com");
  });

  it("uses each column's own header label", () => {
    const csv = buildUsersCsv([makeUser()], ["name", "email", "admin", "coach"]);
    expect(csv.split("\r\n")[0]).toBe("Name,Email,Admin,Coach / Training Dashboard");
  });

  it("renders booleans as Yes/No", () => {
    const csv = buildUsersCsv([makeUser({ isAdmin: true, reviewer: false })], ["admin", "reviewer"]);
    expect(csv).toBe("Admin,Reviewer\r\nYes,No");
  });

  it("renders Created and Last sign-in as plain YYYY-MM-DD dates", () => {
    const csv = buildUsersCsv([makeUser()], ["created", "lastSignIn"]);
    expect(csv).toBe("Created,Last sign-in\r\n2026-01-15,2026-08-20");
  });

  it("renders a blank Last sign-in for a user who has never signed in again", () => {
    const csv = buildUsersCsv([makeUser({ lastSignInAt: null })], ["name", "lastSignIn"]);
    expect(csv).toBe("Name,Last sign-in\r\nJane Doe,");
  });

  it("renders Status from the active/pending union", () => {
    const csv = buildUsersCsv([makeUser({ status: "pending" })], ["status"]);
    expect(csv).toBe("Status\r\nPending");
  });

  it("renders Subscribed to emails as Yes when never unsubscribed", () => {
    const csv = buildUsersCsv([makeUser({ emailUnsubscribedAt: null })], ["subscribed"]);
    expect(csv).toBe("Subscribed to emails\r\nYes");
  });

  it("renders Subscribed to emails as No when unsubscribed", () => {
    const csv = buildUsersCsv([makeUser({ emailUnsubscribedAt: "2026-08-01T00:00:00.000Z" })], ["subscribed"]);
    expect(csv).toBe("Subscribed to emails\r\nNo");
  });

  it("renders engagement counts as plain numbers", () => {
    const csv = buildUsersCsv([makeUser({ learningEventCount: 12, savedCalculationCount: 3 })], [
      "learningActivity",
      "savedCalculations",
    ]);
    expect(csv).toBe("Learning activity count,Saved calculations\r\n12,3");
  });

  it("escapes a name containing a comma", () => {
    const csv = buildUsersCsv([makeUser({ displayName: "Doe, Jane" })], ["name"]);
    expect(csv).toBe('Name\r\n"Doe, Jane"');
  });

  it("produces one row per user, in the given order", () => {
    const csv = buildUsersCsv(
      [makeUser({ displayName: "Jane" }), makeUser({ displayName: "Bo", email: "bo@example.com" })],
      ["name", "email"],
    );
    expect(csv).toBe("Name,Email\r\nJane,jane@example.com\r\nBo,bo@example.com");
  });

  it("produces a header-only CSV for an empty user list", () => {
    expect(buildUsersCsv([], ["name", "email"])).toBe("Name,Email");
  });

  it("selecting zero columns produces an empty header and an empty data line, not a crash", () => {
    const csv = buildUsersCsv([makeUser()], []);
    expect(csv).toBe("\r\n");
  });

  it("every declared column key round-trips through buildUsersCsv without throwing", () => {
    const allKeys = EXPORT_COLUMNS.map((c) => c.key);
    expect(() => buildUsersCsv([makeUser()], allKeys)).not.toThrow();
  });
});

describe("usersCsvFilename", () => {
  it("formats as haarchive-users-YYYY-MM-DD.csv", () => {
    expect(usersCsvFilename(new Date(2026, 7, 22))).toBe("haarchive-users-2026-08-22.csv");
  });

  it("zero-pads single-digit months and days", () => {
    expect(usersCsvFilename(new Date(2026, 0, 5))).toBe("haarchive-users-2026-01-05.csv");
  });
});
