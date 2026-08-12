import "server-only";

import { createServiceRoleClient } from "@/lib/db/service-role";
import { isAdminEmail } from "@/lib/auth/session";
import type { NotificationType } from "@/lib/notifications/types";

// notifications has zero insert policy for regular users (see the RLS
// migration's own comment: "system-generated, inserted via service role")
// -- this is the one and only place that writes a row into it, called
// from whichever Server Action just caused something notification-worthy
// to happen. Reading and marking-read don't need this: notifications_
// select_own/update_own already let a signed-in user do both directly
// with the regular RLS-scoped client (see notification-bell.tsx).
export type { NotificationType };

export async function createNotification({
  userId,
  type,
  content,
  relatedEntityId,
}: {
  userId: string;
  type: NotificationType;
  content: string;
  relatedEntityId?: string | null;
}): Promise<void> {
  const admin = createServiceRoleClient();
  // Best-effort: a failed notification insert shouldn't fail the action
  // that triggered it (posting a comment, reviewing a suggestion) -- the
  // thing that actually happened already succeeded by the time this runs.
  await admin.from("notifications").insert({
    user_id: userId,
    type,
    content,
    related_entity_id: relatedEntityId ?? null,
  });
}

// Admin status is deliberately never stored in the database -- it's a pure
// ADMIN_EMAILS allowlist, checked at request time (see session.ts's own
// comment on why that's intentional). So "notify every admin" can't be a
// normal user_id lookup the way every other notification in this file is;
// it has to re-derive who's an admin the same way session.ts does (real
// auth users, filtered by isAdminEmail), then fan one notification out to
// each of them. This is the one and only place that bridges the env-var
// allowlist to a notifications insert, rather than a second, DB-stored copy
// of "who is admin" that could drift from the real one.
export async function notifyAdmins({
  type,
  content,
  relatedEntityId,
}: {
  type: NotificationType;
  content: string;
  relatedEntityId?: string | null;
}): Promise<void> {
  const admin = createServiceRoleClient();
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 500 });
  const adminIds = (authUsers?.users ?? []).filter((u) => isAdminEmail(u.email ?? null)).map((u) => u.id);
  if (adminIds.length === 0) return;

  await admin.from("notifications").insert(
    adminIds.map((userId) => ({
      user_id: userId,
      type,
      content,
      related_entity_id: relatedEntityId ?? null,
    })),
  );
}
