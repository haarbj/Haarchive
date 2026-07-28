import "server-only";

import { createServiceRoleClient } from "@/lib/db/service-role";
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
