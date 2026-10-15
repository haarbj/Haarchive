#!/usr/bin/env -S npx tsx
// One-off, staging-only: sets a known password on existing staging test
// accounts (brodyhaar+coacha@gmail.com, brodyhaar+athletea@gmail.com --
// already fake/owned test accounts, not real athletes) so the UX audit can
// drive the app's real email/password login form with Playwright instead
// of fighting the magic-link implicit-flow/PKCE mismatch. Staging only.
import { createClient } from "@supabase/supabase-js";

const TEST_PASSWORD = "haarchive-audit-test-2026!";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!url.includes("yaicnjupruusqctwyxqp")) {
    throw new Error(`Refusing to run: NEXT_PUBLIC_SUPABASE_URL does not look like staging (${url})`);
  }
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const emails = process.argv.slice(2);
  if (emails.length === 0) throw new Error("Usage: set-staging-passwords.ts <email> [email...]");

  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 });
  for (const email of emails) {
    const user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) {
      console.error(`No user found for ${email}`);
      continue;
    }
    const { error } = await admin.auth.admin.updateUserById(user.id, { password: TEST_PASSWORD });
    if (error) throw error;
    console.log(`Set password for ${email} (${user.id})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
