"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { createNotification } from "@/lib/notifications/create-notification";

export type SendMessageState = { error?: string };

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// coach_athlete_messages_insert_participant RLS already requires
// sender_id = auth.uid() AND the caller be one of the two people on
// coach_athlete_id -- this action's own checks are redundant with that,
// but kept explicit so a bad coachAthleteId fails with a real message
// instead of a bare RLS-denied insert error.
//
// Image upload is service-role-mediated (the message-images bucket has no
// storage.objects INSERT policy for `authenticated`, matching
// uploadAvatarImage's own precedent) -- the participant check above is
// what actually authorizes it, run BEFORE the upload so a bad
// coachAthleteId can't be used to write into an arbitrary folder. Reads
// are real RLS, not app-layer (see message_images_select_participant in
// the migration) -- this action doesn't need to touch that side at all.
export async function sendCoachAthleteMessage(
  coachAthleteId: string,
  _prevState: SendMessageState,
  formData: FormData,
): Promise<SendMessageState> {
  const session = await getAppSession();
  if (!session) return { error: "Sign in first." };

  const body = String(formData.get("body") ?? "").trim();
  const imageEntry = formData.get("image");
  const imageFile = imageEntry instanceof File && imageEntry.size > 0 ? imageEntry : null;
  if (!body && !imageFile) return { error: "Write something or attach an image first." };

  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("coach_id, athlete_id")
    .eq("id", coachAthleteId)
    .maybeSingle<{ coach_id: string; athlete_id: string }>();
  if (!relationship || (relationship.coach_id !== session.userId && relationship.athlete_id !== session.userId)) {
    return { error: "That conversation isn't yours." };
  }

  let imagePath: string | null = null;
  if (imageFile) {
    if (!ALLOWED_IMAGE_TYPES.has(imageFile.type)) {
      return { error: "Unsupported image type. Use PNG, JPEG, WebP, or GIF." };
    }
    if (imageFile.size > MAX_IMAGE_BYTES) {
      return { error: "Image is too large. Keep it under 8 MB." };
    }
    const extension = imageFile.type === "image/jpeg" ? "jpg" : imageFile.type.split("/")[1];
    imagePath = `${coachAthleteId}/${crypto.randomUUID()}.${extension}`;
    const admin = createServiceRoleClient();
    const { error: uploadError } = await admin.storage
      .from("message-images")
      .upload(imagePath, imageFile, { contentType: imageFile.type });
    if (uploadError) return { error: uploadError.message };
  }

  const { error } = await supabase.from("coach_athlete_messages").insert({
    coach_athlete_id: coachAthleteId,
    sender_id: session.userId,
    body: body || null,
    image_path: imagePath,
  });
  if (error) return { error: error.message };

  const recipientId = session.userId === relationship.coach_id ? relationship.athlete_id : relationship.coach_id;
  await createNotification({
    userId: recipientId,
    type: "message_received",
    content: body ? (body.length > 80 ? `${body.slice(0, 80)}…` : body) : "Sent a photo",
    relatedEntityId: coachAthleteId,
  });

  revalidatePath(`/coaching/messages/${coachAthleteId}`);
  return {};
}

// Marks every message sent TO the caller (not by them) in this thread as
// read -- coach_athlete_messages_update_recipient RLS already enforces
// "not the sender," this just scopes the update to the unread ones.
export async function markThreadRead(coachAthleteId: string): Promise<void> {
  const session = await getAppSession();
  if (!session) return;

  const supabase = await createClient();
  await supabase
    .from("coach_athlete_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("coach_athlete_id", coachAthleteId)
    .is("read_at", null)
    .neq("sender_id", session.userId);
}
