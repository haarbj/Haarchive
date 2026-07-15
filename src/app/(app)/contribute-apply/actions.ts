"use server";

import { getAppSession } from "@/lib/auth/session";
import { getOrCreateAnonId } from "@/lib/anon-id";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { submitContributorApplicationSchema } from "@/lib/validation/contributor-application";

const RATE_LIMIT_WINDOW_HOURS = 24;
const RATE_LIMIT_MAX = 2;

// Same hybrid identity as questions/contact_messages (see those migrations'
// comments) -- an applicant doesn't need an account yet to apply.
async function resolveIdentity(): Promise<{ userId: string | null; anonId: string | null }> {
  const session = await getAppSession();
  if (session) return { userId: session.userId, anonId: null };
  return { userId: null, anonId: await getOrCreateAnonId() };
}

export type SubmitContributorApplicationState = { error?: string; success?: boolean };

export async function submitContributorApplication(
  _prevState: SubmitContributorApplicationState,
  formData: FormData,
): Promise<SubmitContributorApplicationState> {
  const parsed = submitContributorApplicationSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    contributionTypes: formData.getAll("contributionTypes"),
    background: formData.get("background"),
    topicIdea: formData.get("topicIdea") ?? undefined,
    motivation: formData.get("motivation"),
    website: formData.get("website") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your submission" };
  }

  const { userId, anonId } = await resolveIdentity();
  const admin = createServiceRoleClient();

  const identityColumn = userId ? "user_id" : "anon_id";
  const identityValue = userId ?? anonId;
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("contributor_applications")
    .select("id", { count: "exact", head: true })
    .eq(identityColumn, identityValue as string)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return { error: "You've already submitted an application recently — give it a bit before applying again." };
  }

  const { error } = await admin.from("contributor_applications").insert({
    name: parsed.data.name,
    email: parsed.data.email,
    contribution_types: parsed.data.contributionTypes,
    background: parsed.data.background,
    topic_idea: parsed.data.topicIdea ?? null,
    motivation: parsed.data.motivation,
    user_id: userId,
    anon_id: anonId,
  });

  if (error) return { error: error.message };

  return { success: true };
}
