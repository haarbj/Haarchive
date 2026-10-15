#!/usr/bin/env -S npx tsx
// Coach-path browser walkthrough for the coaching-platform UX audit.
// Reads a saved Playwright storageState (see auth-staging.ts), navigates
// the real coach workflows against staging, captures screenshots into
// docs/coaching-platform-audit/screenshots/, and logs click counts / page
// loads / anything unexpected to stdout for transcription into
// 03-ux-audit.md. Not part of the app; audit tooling only.

import { chromium, type Page } from "playwright";
import path from "node:path";

const SHOT_DIR = path.resolve(__dirname, "../../docs/coaching-platform-audit/screenshots");
const BASE = "http://localhost:3000";
const COACH_ATHLETE_ID = "6d356d51-0cbf-4c8c-835a-54a37bab2078"; // athletea, coached by coacha

let shotIndex = 0;
async function shot(page: Page, name: string) {
  shotIndex += 1;
  const file = path.join(SHOT_DIR, `coach-${String(shotIndex).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`[shot] ${file}  (url=${page.url()})`);
}

async function main() {
  const viewport = process.argv[2] === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const prefix = process.argv[2] === "mobile" ? "mobile" : "desktop";

  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState: "/tmp/haarchive-audit-coacha.json", viewport });
  const page = await context.newPage();

  console.log(`\n=== COACH PATH (${prefix}) ===\n`);

  console.log("--- 1. CONNECT: Coach Home ---");
  await page.goto(`${BASE}/coaching`, { waitUntil: "networkidle" });
  await shot(page, `${prefix}-home`);

  console.log("--- Roster ---");
  await page.goto(`${BASE}/coaching/roster`, { waitUntil: "networkidle" });
  await shot(page, `${prefix}-roster`);

  console.log("--- 2. UNDERSTAND: Athlete overview ---");
  await page.goto(`${BASE}/coaching/athletes/${COACH_ATHLETE_ID}`, { waitUntil: "networkidle" });
  await shot(page, `${prefix}-athlete-overview`);

  console.log("--- 3. COMPOSE: Week view ---");
  await page.goto(`${BASE}/coaching/athletes/${COACH_ATHLETE_ID}/schedule?view=week`, { waitUntil: "networkidle" });
  await shot(page, `${prefix}-schedule-week`);

  // Check for horizontal overflow at this viewport -- direct evidence for D12.
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  console.log(`[measure] week view scrollWidth=${scrollWidth} clientWidth=${clientWidth} overflow=${scrollWidth > clientWidth ? "YES +" + (scrollWidth - clientWidth) + "px" : "no"}`);

  console.log("--- Month view ---");
  await page.goto(`${BASE}/coaching/athletes/${COACH_ATHLETE_ID}/schedule?view=month`, { waitUntil: "networkidle" });
  await shot(page, `${prefix}-schedule-month`);

  console.log("--- Phase view ---");
  await page.goto(`${BASE}/coaching/athletes/${COACH_ATHLETE_ID}/schedule?view=phase`, { waitUntil: "networkidle" });
  await shot(page, `${prefix}-schedule-phase`);

  console.log("--- Opening '+ Add' on a specific day column (quick-create panel) ---");
  await page.goto(`${BASE}/coaching/athletes/${COACH_ATHLETE_ID}/schedule?view=week`, { waitUntil: "networkidle" });
  // The week title/target "+ Add" and each day's own "+ Add" share the
  // same label -- ambiguous on its own, worth noting in the audit. Target
  // a day column specifically by scoping to a heading like "MON".
  const dayAddButtons = page.locator('button:has-text("+ Add"), a:has-text("+ Add")');
  const addCount = await dayAddButtons.count();
  console.log(`[count] "+ Add" affordances visible on week view (ambiguous labeling -- includes both week-target and per-day buttons): ${addCount}`);
  const dayColumnAdd = page.locator("text=MON").locator("..").locator('button:has-text("+ Add")').first();
  const hasDayAdd = await dayColumnAdd.count();
  if (hasDayAdd > 0) {
    await dayColumnAdd.click();
    await page.waitForTimeout(500);
    await shot(page, `${prefix}-quick-create-panel`);

    // D6 repro: fill nothing, click the backdrop, see if a network write fires.
    console.log("--- D6 repro: clicking backdrop without saving ---");
    const requestsBeforeClose: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("localhost:3000")) requestsBeforeClose.push(req.url());
    });
    const backdrop = page.locator(".fixed.inset-0").first();
    await backdrop.click({ position: { x: 5, y: 5 }, force: true }).catch(() => console.log("[note] could not click backdrop directly"));
    await page.waitForTimeout(1000);
    console.log(`[requests] POSTs observed after backdrop click (new workout, no save clicked): ${requestsBeforeClose.length}`, requestsBeforeClose);
  }

  console.log("\n--- Done with coach path ---");
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
