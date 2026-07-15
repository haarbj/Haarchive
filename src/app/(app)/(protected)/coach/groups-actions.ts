"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";

export type CreateGroupState = { error?: string };

export async function createGroup(_prevState: CreateGroupState, formData: FormData): Promise<CreateGroupState> {
  const session = await getAppSession();
  if (!session?.isCoach || !session.coachTeamId) return { error: "Not authorized." };

  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) return { error: "Enter a group name." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("groups")
    .insert({ team_id: session.coachTeamId, name: name.trim(), created_by: session.userId });
  if (error) {
    if (error.code === "23505") return { error: "A group with this name already exists." };
    return { error: error.message };
  }

  revalidatePath("/coach/groups");
  return {};
}

export type RenameGroupState = { error?: string; success?: boolean };

export async function renameGroup(_prevState: RenameGroupState, formData: FormData): Promise<RenameGroupState> {
  const session = await getAppSession();
  if (!session?.isCoach) return { error: "Not authorized." };

  const groupId = formData.get("groupId");
  const name = formData.get("name");
  if (typeof groupId !== "string" || !groupId) return { error: "Missing group." };
  if (typeof name !== "string" || !name.trim()) return { error: "Enter a group name." };

  const supabase = await createClient();
  const { error } = await supabase.from("groups").update({ name: name.trim() }).eq("id", groupId);
  if (error) {
    if (error.code === "23505") return { error: "A group with this name already exists." };
    return { error: error.message };
  }

  revalidatePath("/coach/groups");
  revalidatePath(`/coach/groups/${groupId}`);
  return { success: true };
}

export type DeleteGroupState = { error?: string };

export async function deleteGroup(groupId: string): Promise<DeleteGroupState> {
  const session = await getAppSession();
  if (!session?.isCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) return { error: error.message };

  revalidatePath("/coach/groups");
  return {};
}

export type GroupMembershipState = { error?: string };

export async function addAthleteToGroup(groupId: string, athleteId: string): Promise<GroupMembershipState> {
  const session = await getAppSession();
  if (!session?.isCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase.from("group_memberships").insert({ group_id: groupId, user_id: athleteId });
  if (error) {
    if (error.code === "23505") return {}; // already a member -- treat as success, not an error
    return { error: error.message };
  }

  revalidatePath(`/coach/groups/${groupId}`);
  return {};
}

export async function removeAthleteFromGroup(groupId: string, athleteId: string): Promise<GroupMembershipState> {
  const session = await getAppSession();
  if (!session?.isCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("group_memberships")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", athleteId);
  if (error) return { error: error.message };

  revalidatePath(`/coach/groups/${groupId}`);
  return {};
}
