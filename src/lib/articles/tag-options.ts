import { createServiceRoleClient } from "@/lib/db/service-role";

export type TagOption = { id: string; name: string };

// Always service-role -- read from the article editor (any content
// contributor) and the admin management page alike, matching
// article_tag_options' own "no RLS policies" design.
export async function loadTagOptions(): Promise<TagOption[]> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("article_tag_options")
    .select("id, name")
    .order("name", { ascending: true })
    .returns<TagOption[]>();
  return data ?? [];
}
