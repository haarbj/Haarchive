import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/db/service-role";
import { notifyAdmins } from "@/lib/notifications/create-notification";

// Vercel Cron hits this once a day during an open intake window (see
// vercel.json) -- per-submission notifications alone would be a
// denial-of-service on Brody's attention at real club scale (the task's
// own "at 200 submissions" framing), so this is the default-on summary:
// "N new submissions, M flagged, K interested in 1-on-1" since the last
// digest. "Since the last digest" is tracked via audit_log (no new table
// needed for a once-a-day marker) rather than a time window, so a missed
// cron run never double-counts or drops a day's submissions.
//
// Authenticated by CRON_SECRET (Vercel's own convention for protecting a
// cron-invoked route from being called by anyone else) -- not an
// isPrivateCoach session check, since Vercel's cron invoker has no user
// session at all.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();

  const { data: lastDigest } = await admin
    .from("audit_log")
    .select("created_at")
    .eq("action", "club_intake_digest_sent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ created_at: string }>();
  const since = lastDigest?.created_at ?? new Date(0).toISOString();

  const { data: submissions } = await admin
    .from("club_intake_submissions")
    .select("interested_1on1, readiness_fail, injury_history")
    .gt("created_at", since)
    .returns<{ interested_1on1: boolean; readiness_fail: boolean; injury_history: string | null }[]>();

  const rows = submissions ?? [];
  await admin.from("audit_log").insert({ action: "club_intake_digest_sent", entity_type: "club_intake_submissions", metadata: { count: rows.length } });

  if (rows.length === 0) return NextResponse.json({ sent: false, reason: "no new submissions" });

  const flagged = rows.filter((r) => r.readiness_fail || !!r.injury_history).length;
  const interested1on1 = rows.filter((r) => r.interested_1on1).length;

  await notifyAdmins({
    type: "club_intake_submitted",
    content: `Club intake digest: ${rows.length} new submission${rows.length === 1 ? "" : "s"}, ${flagged} flagged, ${interested1on1} interested in 1-on-1.`,
  });

  return NextResponse.json({ sent: true, count: rows.length, flagged, interested1on1 });
}
