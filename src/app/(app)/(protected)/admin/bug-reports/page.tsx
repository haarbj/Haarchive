import type { Metadata } from "next";

import { createServiceRoleClient } from "@/lib/db/service-role";
import { formatRelativeTime } from "@/lib/format";
import { BugReportStatusForm } from "./status-form";
import { DeleteBugReportButton } from "./delete-bug-report-button";
import type { BugReportStatus } from "./types";
import { BackLink } from "@/components/ui/back-link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Bug Reports",
};

// A row-count cap, not pagination -- keeps the query and the page itself
// bounded without building list pagination for a feature that (by design,
// see the migration's own comment) is meant to stay a small internal
// review inbox, not an open, high-volume ticket queue.
const MAX_REPORTS = 200;
// Long enough for a single admin review session, short enough that a
// leaked/bookmarked link stops working on its own rather than needing a
// separate revocation step.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const STATUS_TONE: Record<BugReportStatus, BadgeTone> = {
  new: "tip",
  investigating: "warning",
  resolved: "success",
  dismissed: "neutral",
};

type BugReport = {
  id: string;
  user_id: string | null;
  anon_id: string | null;
  description: string;
  page_url: string;
  viewport_width: number | null;
  viewport_height: number | null;
  device_pixel_ratio: number | null;
  user_agent: string | null;
  screenshot_path: string | null;
  status: BugReportStatus;
  created_at: string;
};

export default async function AdminBugReportsPage() {
  // bug_reports has zero RLS policies for authenticated/anon by design (see
  // its migration) -- this page is already gated on isAdmin by
  // admin/layout.tsx, so the service-role read here is safe, matching
  // admin/messages' own precedent.
  const admin = createServiceRoleClient();
  const { data: reports } = await admin
    .from("bug_reports")
    .select(
      "id, user_id, anon_id, description, page_url, viewport_width, viewport_height, device_pixel_ratio, user_agent, screenshot_path, status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(MAX_REPORTS)
    .returns<BugReport[]>();

  const rows = reports ?? [];

  // One batched lookup for every distinct reporter, not a query per row --
  // display_name only (never email; the bug_reports table doesn't even
  // store one -- see the migration's own comment on why not).
  const reporterIds = [...new Set(rows.map((r) => r.user_id).filter((id): id is string => !!id))];
  const { data: profiles } = reporterIds.length
    ? await admin
        .from("profiles")
        .select("id, display_name")
        .in("id", reporterIds)
        .returns<{ id: string; display_name: string }[]>()
    : { data: [] };
  const displayNameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  // Screenshots live in a private bucket -- a signed URL is generated here,
  // server-side, only for admin eyes already gated by this page's own
  // isAdmin check, and expires on its own rather than staying valid forever.
  const screenshotUrlById = new Map<string, string>();
  for (const report of rows) {
    if (!report.screenshot_path) continue;
    const { data } = await admin.storage
      .from("bug-report-screenshots")
      .createSignedUrl(report.screenshot_path, SIGNED_URL_TTL_SECONDS);
    if (data?.signedUrl) screenshotUrlById.set(report.id, data.signedUrl);
  }

  return (
    <Container variant="dashboard">
      <BackLink href="/admin">Back to Admin</BackLink>
      <Heading>Bug Reports</Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Everything submitted through the site&rsquo;s &ldquo;Report a Bug&rdquo; control, newest first.
      </p>

      <div className="mt-10 space-y-4">
        {rows.length > 0 ? (
          rows.map((report) => {
            const reporterLabel = report.user_id
              ? (displayNameById.get(report.user_id) ?? "Signed-in reporter")
              : "Anonymous reporter";
            const screenshotUrl = screenshotUrlById.get(report.id);

            return (
              <Card key={report.id} padding="md">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone={STATUS_TONE[report.status]}>{report.status}</Badge>
                      <span className="text-sm font-semibold text-zinc-900 dark:text-white">{reporterLabel}</span>
                    </div>
                    <a
                      href={report.page_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-1 block max-w-md truncate text-sm text-zinc-600 underline decoration-black/20 underline-offset-2 hover:decoration-black/60 dark:text-zinc-300 dark:decoration-white/30 dark:hover:decoration-white/70"
                    >
                      {report.page_url}
                    </a>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatRelativeTime(report.created_at)}</p>
                </div>

                <p className="mt-3 text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">
                  {report.description}
                </p>

                {screenshotUrl ? (
                  <a href={screenshotUrl} target="_blank" rel="noreferrer noopener" className="mt-3 block">
                    {/* eslint-disable-next-line @next/next/no-img-element --
                        a signed Supabase Storage URL, not a local asset
                        next/image can optimize (same convention as
                        article-hero.tsx's contributor avatars). */}
                    <img
                      src={screenshotUrl}
                      alt={`Screenshot submitted with this bug report of ${report.page_url}`}
                      className="max-h-80 rounded-lg border border-black/10 dark:border-white/10"
                    />
                  </a>
                ) : (
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">No screenshot attached.</p>
                )}

                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  {report.viewport_width && report.viewport_height
                    ? `${report.viewport_width}×${report.viewport_height}`
                    : "Viewport unknown"}
                  {report.device_pixel_ratio ? ` · ${report.device_pixel_ratio}x DPR` : ""}
                  {report.user_agent ? ` · ${report.user_agent}` : ""}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <BugReportStatusForm id={report.id} status={report.status} />
                  <DeleteBugReportButton id={report.id} />
                </div>
              </Card>
            );
          })
        ) : (
          <EmptyState>No bug reports yet.</EmptyState>
        )}
      </div>
    </Container>
  );
}
