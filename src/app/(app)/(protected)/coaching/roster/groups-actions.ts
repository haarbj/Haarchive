"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";

// training_groups / training_group_members (see
// 20261013010000_private_coaching_training_groups.sql) already carry full
// RLS -- training_groups_all_own scopes every create/rename/delete to the
// calling coach, and training_group_members_all_own additionally requires
// coaches_this_athlete(athlete_id), so a coach can only ever place their own
// real roster athletes into their own groups. That's why this file uses the
// RLS-respecting createClient() (same as ../../coach/groups-actions.ts's
// unrelated team-coaching groups, the closest existing analog for this
// exact "coach-owned group CRUD + membership" shape) rather than the
// service-role client this directory's own actions.ts reaches for elsewhere
// -- there's no RLS gap here to work around.
//
// A side effect of leaning on RLS: an update/delete against a group or
// membership row the caller doesn't own doesn't error, it just matches zero
// rows (Postgres' normal RLS behavior for UPDATE/DELETE). Every mutation
// below re-selects the row it just touched and treats "nothing came back"
// as the authorization failure, rather than trusting a rowCount-less
// success.

const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Enter a group name.").max(100, "Keep the group name under 100 characters."),
  description: z.string().trim().max(500, "Keep the description under 500 characters.").optional(),
});

export type CreateGroupState = { error?: string };

export async function createGroup(_prevState: CreateGroupState, formData: FormData): Promise<CreateGroupState> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const rawDescription = formData.get("description");
  const parsed = createGroupSchema.safeParse({
    name: formData.get("name"),
    description: typeof rawDescription === "string" && rawDescription.trim() ? rawDescription : undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const { error } = await supabase.from("training_groups").insert({
    coach_id: session.userId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/coaching/roster");
  return {};
}

export async function renameGroup(groupId: string, name: string): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const trimmed = name.trim();
  if (!trimmed) return { error: "Enter a group name." };
  if (trimmed.length > 100) return { error: "Keep the group name under 100 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_groups")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", groupId)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "That group isn't yours." };

  revalidatePath("/coaching/roster");
  return {};
}

// Removes the group and its membership rows (cascade on training_groups'
// own FK) -- never touches an athlete's profile, schedule, or any other
// coaching data, since nothing else references a group.
export async function deleteGroup(groupId: string): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("training_groups").delete().eq("id", groupId).select("id").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "That group isn't yours." };

  revalidatePath("/coaching/roster");
  return {};
}

export async function addGroupMember(groupId: string, athleteId: string): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase.from("training_group_members").insert({ group_id: groupId, athlete_id: athleteId });
  if (error) {
    // unique (group_id, athlete_id)
    if (error.code === "23505") return { error: "That athlete is already in this group." };
    // training_group_members_all_own's with-check -- either the group
    // isn't the caller's, or the athlete isn't currently on the caller's
    // roster (coaches_this_athlete fails).
    if (/row-level security|new row violates/i.test(error.message)) {
      return { error: "That athlete isn't on your roster, or this isn't your group." };
    }
    return { error: error.message };
  }

  revalidatePath("/coaching/roster");
  return {};
}

export async function removeGroupMember(memberId: string): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_group_members")
    .delete()
    .eq("id", memberId)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "That membership doesn't exist." };

  revalidatePath("/coaching/roster");
  return {};
}
