#!/usr/bin/env -S npx tsx
// One-off helper for the coaching-platform UX audit: drives the app's real
// email/password login form (the same path any user goes through) for a
// staging test account, and saves Playwright storage state to disk so
// audit scripts can `chromium.newContext({ storageState })` without
// re-authenticating. Staging only. Password set once via
// set-staging-passwords.ts. Not part of the app; not run in CI; deleted
// with the rest of the audit's working scripts when the audit concludes.
//
// Usage:
//   npx tsx --env-file-if-exists=.env.development.local scripts/audit/auth-staging.ts <email> <out-file>

import { chromium } from "playwright";

const TEST_PASSWORD = "haarchive-audit-test-2026!";

async function main() {
  const [email, outFile] = process.argv.slice(2);
  if (!email || !outFile) {
    console.error("Usage: auth-staging.ts <email> <out-file>");
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!url.includes("yaicnjupruusqctwyxqp")) {
    throw new Error(`Refusing to run: NEXT_PUBLIC_SUPABASE_URL does not look like staging (${url})`);
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  // The dev server cold-compiles /dashboard on first hit, which can outlast
  // a plain networkidle wait -- wait for the actual URL change instead.
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState("networkidle");
  console.log("After login, landed at:", page.url());

  if (page.url().includes("/login")) {
    console.error("Login failed -- still on /login. Page content snippet:");
    console.error((await page.content()).slice(0, 2000));
    await browser.close();
    process.exit(1);
  }

  await context.storageState({ path: outFile });
  console.log("Saved storage state to", outFile);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
