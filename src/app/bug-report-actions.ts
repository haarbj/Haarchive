"use server";

import { getAppSession } from "@/lib/auth/session";
import { getOrCreateAnonId } from "@/lib/anon-id";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { readablePagePath } from "@/lib/bug-report/metadata";
import { notifyAdmins } from "@/lib/notifications/create-notification";
import { submitBugReportSchema } from "@/lib/validation/bug-report";

const RATE_LIMIT_WINDOW_HOURS = 24;
const RATE_LIMIT_MAX = 5;

const ALLOWED_SCREENSHOT_TYPES = new Set(["image/jpeg"]);
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

// Same hybrid identity as contact/questions -- see contact-actions.ts's own
// comment. A bug report has no reply-to concept the way contact does, so
// this is purely for attaching (or not) a real user_id and for rate-limiting
// anonymous submissions.
async function resolveIdentity(): Promise<{ userId: string | null; anonId: string | null }> {
  const session = await getAppSession();
  if (session) return { userId: session.userId, anonId: null };
  return { userId: null, anonId: await getOrCreateAnonId() };
}

export type SubmitBugReportState = { error?: string; success?: boolean };

export async function submitBugReport(
  _prevState: SubmitBugReportState,
  formData: FormData,
): Promise<SubmitBugReportState> {
  const parsed = submitBugReportSchema.safeParse({
    description: formData.get("description"),
    pageUrl: formData.get("pageUrl"),
    viewportWidth: formData.get("viewportWidth") || undefined,
    viewportHeight: formData.get("viewportHeight") || undefined,
    devicePixelRatio: formData.get("devicePixelRatio") || undefined,
    userAgent: formData.get("userAgent") || undefined,
    website: formData.get("website") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your submission" };
  }

  // The screenshot is optional and validated separately from the Zod
  // schema, same split as uploadArticleImage -- a File isn't a value Zod
  // needs to own, and "no screenshot" is always a valid submission (see the
  // feature's own "must remain usable without a screenshot" requirement).
  const screenshotFile = formData.get("screenshot");
  if (screenshotFile instanceof File && screenshotFile.size > 0) {
    if (!ALLOWED_SCREENSHOT_TYPES.has(screenshotFile.type)) {
      return { error: "Unexpected screenshot format." };
    }
    if (screenshotFile.size > MAX_SCREENSHOT_BYTES) {
      return { error: "Screenshot is too large." };
    }
  }

  const { userId, anonId } = await resolveIdentity();
  const admin = createServiceRoleClient();

  const identityColumn = userId ? "user_id" : "anon_id";
  const identityValue = userId ?? anonId;
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("bug_reports")
    .select("id", { count: "exact", head: true })
    .eq(identityColumn, identityValue as string)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return { error: "You've already reported a few issues recently. Give it a bit before reporting more." };
  }

  // Upload before insert -- a failed upload should fail the whole
  // submission loudly (client keeps its Retry path, per the feature's own
  // "don't silently discard anything" requirement) rather than silently
  // land a report with a screenshot_path that never resolves to anything.
  let screenshotPath: string | null = null;
  if (screenshotFile instanceof File && screenshotFile.size > 0) {
    // Randomized, not user-namespaced -- the bucket is already private and
    // service-role-only, but a guessable/user-scoped path is still worth
    // avoiding on general principle (see the feature's own storage
    // guidance).
    const path = `${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await admin.storage
      .from("bug-report-screenshots")
      .upload(path, screenshotFile, { contentType: "image/jpeg" });
    if (uploadError) return { error: "Couldn't upload the screenshot. Try again." };
    screenshotPath = path;
  }

  const { data: inserted, error } = await admin
    .from("bug_reports")
    .insert({
      description: parsed.data.description,
      page_url: parsed.data.pageUrl,
      viewport_width: parsed.data.viewportWidth ?? null,
      viewport_height: parsed.data.viewportHeight ?? null,
      device_pixel_ratio: parsed.data.devicePixelRatio ?? null,
      user_agent: parsed.data.userAgent ?? null,
      screenshot_path: screenshotPath,
      user_id: userId,
      anon_id: anonId,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Only after the report itself is confirmed persisted -- matches
  // submitQuestion's own "insert succeeds, then notify" ordering exactly.
  // Unlike every existing notifyAdmins call site, this one is wrapped in a
  // try/catch: none of the others need it because a thrown exception here
  // is rare (Supabase's insert() normally returns {error} rather than
  // throwing), but the bug-report feature has an explicit requirement that
  // a successfully submitted report must never be undone by a
  // notification-layer failure, so this narrow try/catch exists to
  // guarantee that specifically for this call site, without changing
  // notifyAdmins/createNotification themselves.
  try {
    await notifyAdmins({
      type: "bug_report_submitted",
      content: `A user reported a bug on ${readablePagePath(parsed.data.pageUrl)}.`,
      relatedEntityId: inserted.id,
    });
  } catch (notifyError) {
    console.error("Failed to notify admins of new bug report", inserted.id, notifyError);
  }

  return { success: true };
}
