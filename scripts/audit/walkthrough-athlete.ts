#!/usr/bin/env -S npx tsx
// Athlete-path browser walkthrough. See walkthrough-coach.ts for the
// pattern this mirrors.

import { chromium, type Page } from "playwright";
import path from "node:path";

const SHOT_DIR = path.resolve(__dirname, "../../docs/coaching-platform-audit/screenshots");
const BASE = "http://localhost:3000";

let shotIndex = 0;
async function shot(page: Page, name: string) {
  shotIndex += 1;
  const file = path.join(SHOT_DIR, `athlete-${String(shotIndex).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`[shot] ${file}  (url=${page.url()})`);
}

async function main() {
  const viewport = process.argv[2] === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const prefix = process.argv[2] === "mobile" ? "mobile" : "desktop";

  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState: "/tmp/haarchive-audit-athletea.json", viewport });
  const page = await context.newPage();

  console.log(`\n=== ATHLETE PATH (${prefix}) ===\n`);

  console.log("--- 1. ORIENT: /coaching home ---");
  await page.goto(`${BASE}/coaching`, { waitUntil: "networkidle" });
  await shot(page, `${prefix}-home-today`);

  console.log("--- Does /dashboard show anything about coaching? (D10 repro) ---");
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await shot(page, `${prefix}-dashboard`);
  const dashboardText = await page.locator("body").innerText();
  const mentionsCoaching = /coach|coaching/i.test(dashboardText);
  console.log(`[check] /dashboard body text mentions "coach"/"coaching": ${mentionsCoaching}`);

  console.log("--- D3 repro: try to view a PAST date directly ---");
  await page.goto(`${BASE}/coaching`, { waitUntil: "networkidle" });
  // Athletes have no calendar at all -- confirm there is no route/link that
  // lets them reach past training. Check for any date-picker or "history"
  // link on the coaching home.
  const historyLink = page.locator('a:has-text("History"), a:has-text("Past"), a:has-text("Calendar")');
  console.log(`[count] links containing History/Past/Calendar on athlete home: ${await historyLink.count()}`);

  console.log("--- Messages ---");
  await page.goto(`${BASE}/coaching/messages`, { waitUntil: "networkidle" });
  await shot(page, `${prefix}-messages`);

  console.log("--- Check-in ---");
  await page.goto(`${BASE}/coaching/checkin`, { waitUntil: "networkidle" });
  await shot(page, `${prefix}-checkin`);

  console.log("\n--- Done with athlete path ---");
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
