#!/usr/bin/env -S npx tsx
// One-time loader for a club intake cycle row -- see club-intake.ts and
// the app/(app)/club-interest/[token] route this feeds. Not run in CI,
// same documented manual-invoke convention as seed-canyon-program.ts.
//
// Writes via a service-role client, not a Server Action -- a standalone
// script has no request-scoped session/cookies to call one with (same
// reasoning as seed-fueling-fridays-1.ts's own comment).
//
// Usage:
//   npm run seed:club-intake-cycle -- --label="Nashville Spring 2027" \
//     --race-name="St. Jude Rock 'n' Roll Nashville Marathon" \
//     --race-date=2027-04-24 --deadline=2026-11-01T23:59:59-05:00 \
//     --created-by-email=brody@example.com

import { createClient } from "@supabase/supabase-js";

function createServiceRoleClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

async function resolveUserIdByEmail(admin: ReturnType<typeof createServiceRoleClient>, email: string): Promise<string> {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (!data.nextPage) break;
    page = data.nextPage;
  }
  throw new Error(`No user found for email ${email}`);
}

async function main() {
  const label = arg("label");
  const raceName = arg("race-name");
  const raceDate = arg("race-date");
  const deadline = arg("deadline");
  const createdByEmail = arg("created-by-email");
  if (!label || !raceName || !raceDate || !deadline) {
    throw new Error("Usage: --label= --race-name= --race-date= --deadline= [--created-by-email=]");
  }

  const admin = createServiceRoleClient();
  const createdBy = createdByEmail ? await resolveUserIdByEmail(admin, createdByEmail) : null;

  const { data, error } = await admin
    .from("club_intake_cycles")
    .insert({ label, race_name: raceName, race_date: raceDate, deadline_at: deadline, created_by: createdBy })
    .select("id, token")
    .single();
  if (error) throw new Error(error.message);

  console.log(`Created cycle ${data.id}`);
  console.log(`Token: ${data.token}`);
  console.log(`Form URL: /club-interest/${data.token}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
